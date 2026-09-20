import { isDeepStrictEqual } from 'node:util';
import { captureContextQuery, previewChatContext, compileChatContext } from './local-chat-context.mjs';

const error = code => Object.assign(new Error('Local chat operation failed.'), { code });
const check = (value, code = 'UNCERTAIN') => { if (!value) throw error(code); };
const entity = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value && value !== 'default';
const messageId = value => typeof value === 'string' && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?::(?:assistant|reasoning):(?:0|[1-9][0-9]{0,5})|:tool:[^\x00-\x1f\x7f\u2028\u2029]{1,128}:request)?$/.exec(value)?.[0] === value;
const emptySettings = value => value === undefined || value === null
  || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
function safeAgent(agent, agentId) {
  check(agent?.id === agentId && Array.isArray(agent.tags) && agent.tags.includes('personal-co-v1'));
  check(emptySettings(agent.model_settings), 'PREDISPATCH');
}
function ownConversation(row, agentId, model, expectedId) {
  check(entity(row?.id) && (!expectedId || row.id === expectedId) && row.agent_id === agentId
    && (row.hidden === undefined || row.hidden === false) && Array.isArray(row.tags)
    && row.tags.length <= 32 && row.tags.every(tag => typeof tag === 'string' && tag.length <= 256)
    && row.tags.includes('personal-co-retained-v1') && !row.tags.includes('privacy:temporary')
    && !row.tags.includes('privacy:excluded'), 'PREDISPATCH');
  check(row.model === model && emptySettings(row.model_settings), 'PREDISPATCH');
  return row;
}
function page(response, agentId, conversationId) {
  const rows = response?.messages;
  check(response?.success === true && Array.isArray(rows) && rows.length <= 20
    && typeof response.has_more === 'boolean' && (!response.has_more || rows.length === 20)
    && response.next_before === (rows.at(-1)?.id ?? null));
  check(rows.every(row => messageId(row?.id) && row.agent_id === agentId && row.conversation_id === conversationId
    && typeof row.message_type === 'string' && row.message_type.length <= 128)
    && new Set(rows.map(row => row.id)).size === rows.length);
  return rows;
}
function originalUser(content, text) {
  if (typeof content === 'string') return content === text;
  // Pinned native reminder injection preserves the untouched original final
  // text part. Binding is exact OTID/Agent/conversation; never generic stripping.
  return Array.isArray(content) && content.length >= 1 && content.length <= 128
    && content.every(part => part?.type === 'text' && typeof part.text === 'string' && Buffer.byteLength(part.text) <= 65536)
    && content.at(-1).text === text;
}
// Match the existing reader's visible projection bounds on this new interval,
// not the entire history. Non-text attachment objects are omitted by the reader.
function visibleText(row) {
  check(row.date === undefined || row.date === null
    || (typeof row.date === 'string' && row.date.length <= 64 && Number.isFinite(Date.parse(row.date))));
  const content = row.content;
  if (typeof content === 'string') { check(content.length <= 65536); return content; }
  check(Array.isArray(content) && content.length <= 128);
  let output = '';
  for (const part of content) {
    check(part !== null && typeof part === 'object' && !Array.isArray(part));
    if (part.type === 'text') { check(typeof part.text === 'string' && part.text.length <= 65536); output += part.text; }
    check(output.length <= 65536);
  }
  return output;
}

/** Host-private context admission. The managed owner supplies one exclusive bootstrap
 * lease, bound durable store, fresh authenticated channels and lifetime stop.
 * Context is explicitly selected per message from a fresh canonical snapshot;
 * no automatic freshness or truth assertion. No recovery sends or delivery
 * cancellation option. HTTP/browser exposure is still a later integration.
 */
export function createLocalChatOperations({ store, connect, readMemory, agentId, model, stop, signal, operationMs = 180000 }) {
  check(entity(agentId) && typeof model === 'string' && Number.isInteger(operationMs) && operationMs > 0 && operationMs <= 180000);
  let closed = false; let stopping = false; let busy = false; let task = Promise.resolve();
  let previewing = false; let previewTask = Promise.resolve();
  function alive(channel) { check(!closed && !signal.aborted); channel?.assertHealthy(); }
  function stopOwner() {
    closed = true;
    if (stopping) return;
    stopping = true;
    // Never await the owner here: its cleanup drains this operation's task.
    try { void Promise.resolve(stop()).catch(() => {}); } catch { /* Remain closed. */ }
  }
  async function interval(channel, conversationId, baseline) {
    const fresh = []; const seen = new Set(); let before; let overlap;
    for (let count = 0; count < 50; count++) {
      alive();
      const response = await channel.history(conversationId, before);
      const rows = page(response, agentId, conversationId);
      if (overlap) check(rows[0] && isDeepStrictEqual(rows[0], overlap));
      for (const row of rows.slice(overlap ? 1 : 0)) {
        check(!seen.has(row.id)); seen.add(row.id);
        if (baseline && row.id === baseline.id) { check(isDeepStrictEqual(row, baseline)); return fresh.reverse(); }
        fresh.push(row);
      }
      if (!response.has_more) { check(baseline === null); return fresh.reverse(); }
      check(rows.length >= 2);
      const next = rows.at(-2).id; check(next !== before);
      before = next; overlap = rows.at(-1);
    }
    throw error('UNCERTAIN');
  }
  async function execute(record, recovery) {
    let channel; let mutated = false; let completed = false;
    const { request, operationTag } = record;
    const operationId = request.operationId;
    // Deadline stops the runtime even if a test seam or unexpected pending IO
    // never resolves; lifecycle owns bounded reconciliation and store disposal.
    const timer = setTimeout(stopOwner, operationMs);
    try {
      let projection;
      if (request.kind === 'send' && request.context !== undefined) {
        let snapshot;
        // Integrity/ownership failure is not an ordinary stale user selection:
        // no native mutation happened, but ready authority must be revoked.
        try { alive(); snapshot = await readMemory(); alive(); }
        catch {
          if (!closed && !signal.aborted) try { store.recordFailure({ operationId, source: 'predispatch' }); } catch { /* Do not dispatch. */ }
          stopOwner(); return;
        }
        try { projection = compileChatContext(snapshot, agentId, request.context); }
        catch { throw error('PREDISPATCH'); }
      }
      alive(); channel = await connect();
      void channel.failed.then(stopOwner);
      alive(channel);
      if (recovery) {
        const rows = await channel.listConversations();
        check(Array.isArray(rows) && rows.length < 100 && rows.every(row => row?.agent_id === agentId && entity(row.id))
          && new Set(rows.map(row => row.id)).size === rows.length);
        const found = rows.filter(row => Array.isArray(row.tags) && row.tags.includes(operationTag));
        check(found.length === 1);
        const row = ownConversation(await channel.readConversation(found[0].id), agentId, model, found[0].id);
        check(row.summary === request.title && row.tags.length === 2 && row.tags.includes(operationTag));
        alive(channel); await channel.seal(); alive(); channel.assertSealed();
        store.completeCreate({ operationId, conversationId: row.id, operationTag }); completed = true;
        return;
      }
      const agent = await channel.readAgent(); safeAgent(agent, agentId);
      let baseline;
      if (request.kind === 'send') {
        check(agent.model === model, 'PREDISPATCH');
        ownConversation(await channel.readConversation(request.conversationId), agentId, model, request.conversationId);
        const response = await channel.history(request.conversationId);
        const rows = page(response, agentId, request.conversationId);
        baseline = rows[0] ?? null;
        check(baseline !== null || response.has_more === false);
        check(!rows.some(row => row.otid === operationId));
      }
      alive(); mutated = true;
      safeAgent(await channel.prepareAgent(projection), agentId);
      alive();
      if (request.kind === 'create') {
        const created = await channel.createConversation(request.title, operationTag);
        check(entity(created?.id));
        const row = ownConversation(await channel.readConversation(created.id), agentId, model, created.id);
        check(row.summary === request.title && row.tags.length === 2 && row.tags.includes(operationTag));
        alive(channel); await channel.seal(); alive(); channel.assertSealed();
        store.completeCreate({ operationId, conversationId: row.id, operationTag });
      } else {
        ownConversation(await channel.readConversation(request.conversationId), agentId, model, request.conversationId);
        alive();
        await channel.start(request.conversationId);
        alive();
        const terminal = await channel.input(operationId, request.text);
        alive(channel); store.recordTerminal({ operationId, ...terminal });
        if (terminal.error || terminal.stopReason !== 'end_turn') {
          store.recordFailure({ operationId, source: 'terminal' });
          // Terminal failure is known, but inference safety still ends the owner.
          throw error('UNCERTAIN');
        }
        const rows = await interval(channel, request.conversationId, baseline);
        ownConversation(await channel.readConversation(request.conversationId), agentId, model, request.conversationId);
        const users = rows.filter(row => row.message_type === 'user_message');
        check(users.length === 1 && users[0].otid === operationId && originalUser(users[0].content, request.text));
        visibleText(users[0]);
        const userIndex = rows.indexOf(users[0]);
        check(userIndex === 0);
        const replies = rows.filter(row => row.message_type === 'assistant_message');
        check(replies.length >= 1 && replies.length <= 64 && replies.every(row => rows.indexOf(row) > userIndex)
          && replies.every(row => visibleText(row).length > 0)
          && rows.filter(row => row.otid === operationId).length === 1);
        if (projection !== undefined) { alive(channel); safeAgent(await channel.clearContext(), agentId); }
        alive(channel); await channel.seal(); alive(); channel.assertSealed();
        store.completeSend({ operationId, conversationId: request.conversationId,
          userMessageId: users[0].id, assistantMessageIds: replies.map(row => row.id) });
      }
      completed = true;
    } catch (failure) {
      if (!mutated && !recovery && failure?.code === 'PREDISPATCH' && !closed && !signal.aborted) {
        try { alive(channel); store.recordFailure({ operationId, source: 'predispatch' }); completed = true; } catch { /* Keep unknown. */ }
      }
      if (!completed) stopOwner();
    } finally {
      clearTimeout(timer);
      if (channel) try { await channel.close(); } catch { stopOwner(); }
    }
  }
  function launch(record, recovery = false) {
    busy = true;
    task = Promise.resolve().then(() => execute(record, recovery)).finally(() => { busy = false; });
    void task.catch(stopOwner);
  }
  const safeCall = fn => {
    try { return fn(); }
    catch (failure) { throw error(['CONFLICT', 'BUSY', 'INVALID', 'MISSING'].includes(failure?.code) ? failure.code : 'CHAT_UNAVAILABLE'); }
  };
  return Object.freeze({
    previewContext(input = {}) {
      let query;
      try { alive(); check(!previewing, 'BUSY'); query = captureContextQuery(input); }
      catch { return Promise.reject(error('INVALID_CONTEXT')); }
      previewing = true;
      previewTask = (async () => {
        let snapshot;
        try { snapshot = await readMemory(); alive(); }
        catch { stopOwner(); throw error('CONTEXT_UNAVAILABLE'); }
        return previewChatContext(snapshot, agentId, query);
      })().finally(() => { previewing = false; });
      void previewTask.catch(() => {}); return previewTask;
    },
    submit(value) { return safeCall(() => {
      alive();
      // reserve is synchronous and is the only dispatch authority. Duplicate
      // requests remain readable even while the original task is still running.
      check(!busy || store.listPending().length > 0, 'BUSY');
      const reserved = store.reserve(value);
      if (reserved.dispatchAllowed) { check(!busy); launch(reserved.record); }
      return reserved.record;
    }); },
    get: operationId => safeCall(() => store.get(operationId)),
    listPending: () => safeCall(() => store.listPending()),
    recoverCreate(operationId) { return safeCall(() => {
      alive(); check(!busy, 'BUSY');
      const record = store.get(operationId); check(record?.request.kind === 'create', 'INVALID');
      if (record.status === 'unknown') launch(record, true);
      return record;
    }); },
    close() { closed = true; return Promise.allSettled([task, previewTask]).then(() => undefined); },
  });
}
