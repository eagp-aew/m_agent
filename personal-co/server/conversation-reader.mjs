import { randomUUID } from 'node:crypto';

const TAG = 'personal-co-v1';
const retained = row => row.tags.includes('personal-co-retained-v1')
  && !row.tags.includes('privacy:temporary') && !row.tags.includes('privacy:excluded');
const PAGE = 20;
const MAX_ROWS = 1000;
const MAX_CURSORS = 32;
class ReaderError extends Error {
  constructor(code) { super('Conversation read failed.'); this.code = code; }
}
const check = (value, code = 'INVALID_DATA') => { if (!value) throw new ReaderError(code); };
const entityId = value => typeof value === 'string' && value.length <= 128 && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.exec(value)?.[0] === value;
// Kept aligned with the transport's distinct native projected-message policy.
const messageId = value => typeof value === 'string' && value.length <= 320 && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?::(?:assistant|reasoning):(?:0|[1-9][0-9]{0,5})|:tool:[^\x00-\x1f\x7f\u2028\u2029]{1,128}:request)?$/.exec(value)?.[0] === value;
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function get(value, key, fallback) {
  check(plain(value));
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor) return fallback;
  check(descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
  return descriptor.value;
}
function options(value, keys) {
  check(plain(value), 'INVALID_INPUT');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === 'string' && keys.includes(key) && descriptor.enumerable
      && Object.hasOwn(descriptor, 'value'), 'INVALID_INPUT');
  }
  return value;
}
function string(value, max) { check(typeof value === 'string' && value.length <= max); return value; }
function tags(value = []) {
  check(Array.isArray(value) && value.length <= 32 && Object.keys(value).length === value.length);
  return Object.freeze(value.map(value => string(value, 256)));
}
function date(value = null) {
  if (value === null) return null;
  check(typeof value === 'string' && value.length <= 64 && Number.isFinite(Date.parse(value)));
  return value;
}
function conversation(row, agentId, expectedId) {
  const id = get(row, 'id');
  check(entityId(id) && (!expectedId || id === expectedId) && get(row, 'agent_id') === agentId, 'OWNERSHIP_CHANGED');
  const hidden = get(row, 'hidden');
  check(hidden === undefined || hidden === false, 'HIDDEN_CONVERSATION');
  const summary = get(row, 'summary', null);
  return Object.freeze({ id, summary: summary === null ? null : string(summary, 8192), tags: tags(get(row, 'tags')),
    createdAt: date(get(row, 'created_at')), updatedAt: date(get(row, 'updated_at')),
    lastMessageAt: date(get(row, 'last_message_at')) });
}
function visibleMessage(row, agentId, conversationId, originalUser) {
  const id = get(row, 'id');
  check(messageId(id) && get(row, 'agent_id') === agentId
    && get(row, 'conversation_id') === conversationId, 'OWNERSHIP_CHANGED');
  const type = get(row, 'message_type');
  check(typeof type === 'string' && type.length <= 128);
  if (type !== 'user_message' && type !== 'assistant_message') return { id, display: null, omitted: false };
  const content = get(row, 'content');
  if (type === 'user_message' && originalUser) {
    const original = originalUser({ agentId, conversationId, messageId: id, otid: get(row, 'otid'), content });
    check(original === null || (typeof original === 'string' && original.length <= 16384));
    return { id, omitted: original === null, display: Object.freeze({ id, role: 'user',
      content: original === null ? '［原始用户文本未验证，已隐藏］' : original, date: date(get(row, 'date')) }) };
  }
  let output = '';
  let omitted = false;
  if (typeof content === 'string') output = string(content, 65536);
  else {
    check(Array.isArray(content) && content.length <= 128 && Object.keys(content).length === content.length);
    for (const part of content) {
      if (get(part, 'type') === 'text') output += string(get(part, 'text'), 65536);
      else omitted = true;
      check(output.length <= 65536);
    }
  }
  return { id, omitted, display: Object.freeze({ id, role: type === 'user_message' ? 'user' : 'assistant',
    content: output, date: date(get(row, 'date')) }) };
}

/**
 * Trusted host library over an already-authenticated borrowed client. No HTTP,
 * browser authentication, Agent creation, storage or provider execution.
 * Each operation checks the unique native-visible tagged Agent before and after
 * fetching. Native inventory excludes hidden Agent records; this is not a claim
 * that no hidden records exist on disk. Exact trusted Agent binding is required.
 * History also checks named conversation ownership/visibility before and after.
 * Those observations are not a transactional snapshot or browser authorization.
 *
 * Display strings remain untrusted text: render as text, never HTML/instructions.
 * Only user/assistant text survives projection; omittedAttachments reports any
 * non-text visible content. Internal-only pages still return their continuation.
 * retainedOnly opts into positive retained-tag admission and rejects temporary,
 * excluded and unmarked histories. This trusted-host tagging convention is not
 * deletion or complete temporary-session enforcement. Default false preserves
 * existing host callers; browser brokers must force true.
 *
 * Pages are descending. Lists use one-row lookahead; history follows the pinned
 * native next_before/has_more contract. Continuations start at the previous
 * penultimate row and require its final row as a validated, discarded overlap.
 * Cursors are opaque, consumed on successful return only, and bound
 * to this reader plus exact search/conversation. Limits are per reader: 1000 raw
 * data rows, 32 retained cursors and 4 pending borrowed RPCs. There is no
 * auto-scanning or retry; a page is not dispatched without its full row budget.
 * close/abort invalidate delivery without closing the borrowed client; an RPC
 * already dispatched may complete under its transport deadline. close is final.
 */
export function createConversationReader(client, config) {
  options(config, ['agentId', 'retainedOnly', 'originalUser']);
  const agentId = config.agentId;
  const retainedOnly = config.retainedOnly === undefined ? false : config.retainedOnly;
  check(typeof retainedOnly === 'boolean', 'INVALID_INPUT');
  const originalUser = config.originalUser;
  check(originalUser === undefined || typeof originalUser === 'function', 'INVALID_INPUT');
  check(entityId(agentId) && client && typeof client.request === 'function', 'INVALID_INPUT');
  const request = client.request.bind(client);
  const cursors = new Map();
  const pendingReads = new Set();
  const closing = new AbortController();
  let closed = false;
  let busy = false;
  let scanned = 0;

  function alive(signal) { check(!closed, 'CLOSED'); check(!signal.aborted, 'ABORTED'); }
  async function rpc(type, fields, signal) {
    alive(signal);
    check(pendingReads.size < 4, 'BUSY');
    let timer;
    let abort;
    try {
      const pending = Promise.resolve().then(() => { alive(signal); return request(type, fields); });
      pendingReads.add(pending);
      void pending.then(() => pendingReads.delete(pending), () => pendingReads.delete(pending));
      const result = await Promise.race([
        pending,
        new Promise((_, reject) => {
          abort = () => reject(new ReaderError(closed ? 'CLOSED' : 'ABORTED'));
          signal.addEventListener('abort', abort, { once: true });
          timer = setTimeout(() => reject(new ReaderError('READ_TIMEOUT')), 5000);
        }),
      ]);
      alive(signal); check(get(result, 'success') === true, 'READ_FAILED');
      return result;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  }
  async function identity(signal) {
    const result = await rpc('agent_list', { query: { tags: [TAG], limit: 2 } }, signal);
    const agents = get(result, 'agents');
    check(Array.isArray(agents) && agents.length === 1 && get(agents[0], 'id') === agentId
      && tags(get(agents[0], 'tags')).includes(TAG), 'AGENT_IDENTITY_CHANGED');
  }
  async function ownConversation(conversationId, signal) {
    const result = await rpc('conversation_retrieve', { conversation_id: conversationId }, signal);
    const row = conversation(get(result, 'conversation'), agentId, conversationId);
    check(!retainedOnly || retained(row), 'PRIVACY_EXCLUDED');
    return row;
  }
  function pageState(kind, binding, cursor) {
    if (cursor === undefined) return { kind, binding, native: undefined, seen: new Set() };
    check(typeof cursor === 'string' && cursor.length === 36, 'INVALID_CURSOR');
    const state = cursors.get(cursor);
    check(state && state.kind === kind && state.binding === binding, 'INVALID_CURSOR');
    return { ...state, token: cursor };
  }
  function account(rows, state, count) {
    check(Array.isArray(rows) && rows.length <= count);
    scanned += rows.length;
    check(scanned <= MAX_ROWS, 'SCAN_LIMIT');
    if (state.overlap) check(rows.length > 0 && get(rows[0], 'id') === state.overlap, 'NONADVANCING_PAGE');
    const current = new Set();
    for (const [index, row] of rows.entries()) {
      const id = get(row, 'id');
      check(!(state.seen.has(id) && !(index === 0 && id === state.overlap)) && !current.has(id), 'NONADVANCING_PAGE');
      current.add(id);
    }
  }
  function issue(state, native, ids) {
    const seen = new Set([...state.seen, ...ids]);
    if (native !== null) {
      check(native !== state.native && seen.has(native), 'NONADVANCING_PAGE');
      check(cursors.size - (state.token ? 1 : 0) < MAX_CURSORS, 'CURSOR_LIMIT');
    }
    const token = native === null ? null : randomUUID();
    if (state.token) cursors.delete(state.token);
    if (token) cursors.set(token, { kind: state.kind, binding: state.binding, native, overlap: ids.at(-1), seen });
    return token;
  }
  function operation(kind, binding, input, callOptions, work) {
    try {
      options(callOptions, ['signal']);
      const external = callOptions.signal;
      check(external === undefined || external instanceof AbortSignal, 'INVALID_INPUT');
      const signal = external ? AbortSignal.any([closing.signal, external]) : closing.signal;
      alive(signal); check(!busy, 'BUSY');
      const state = pageState(kind, binding, input.cursor);
      state.limit = (kind === 'messages' ? PAGE : PAGE + 1) + (state.overlap ? 1 : 0);
      check(scanned + state.limit <= MAX_ROWS, 'SCAN_LIMIT');
      busy = true;
      return work(state, signal).catch(failure => {
        throw failure instanceof ReaderError ? failure : new ReaderError('READ_FAILED');
      }).finally(() => { busy = false; });
    } catch (failure) { return Promise.reject(failure instanceof ReaderError ? failure : new ReaderError('INVALID_INPUT')); }
  }
  return Object.freeze({
    listConversations(input = {}, callOptions = {}) {
      try {
        options(input, ['search', 'cursor']);
        const search = input.search === undefined ? '' : input.search;
        check(typeof search === 'string' && search.length <= 256 && !/[\x00-\x1f\x7f]/.test(search), 'INVALID_INPUT');
        return operation('conversations', search, { cursor: input.cursor }, callOptions, async (state, signal) => {
          await identity(signal);
          const response = await rpc('conversation_list', { query: { agent_id: agentId, limit: state.limit,
            ...(search ? { summary_search: search } : {}), ...(state.native ? { after: state.native } : {}) } }, signal);
          const rows = get(response, 'conversations'); account(rows, state, state.limit);
          // Validate overlap and lookahead ownership before discarding either.
          const projected = rows.map(row => conversation(row, agentId)).slice(state.overlap ? 1 : 0);
          const displayed = projected.slice(0, PAGE);
          await identity(signal); alive(signal);
          const cursor = issue(state, projected.length > PAGE ? displayed.at(-2).id : null, displayed.map(row => row.id));
          return Object.freeze({ items: Object.freeze(retainedOnly ? displayed.filter(retained) : displayed), cursor });
        });
      } catch { return Promise.reject(new ReaderError('INVALID_INPUT')); }
    },
    listMessages(conversationId, input = {}, callOptions = {}) {
      try {
        check(entityId(conversationId), 'INVALID_INPUT'); options(input, ['cursor']);
        return operation('messages', conversationId, { cursor: input.cursor }, callOptions, async (state, signal) => {
          await identity(signal); await ownConversation(conversationId, signal);
          const response = await rpc('conversation_messages_list', { conversation_id: conversationId,
            query: { agent_id: agentId, limit: state.limit, order: 'desc', ...(state.native ? { before: state.native } : {}) } }, signal);
          const rows = get(response, 'messages'); account(rows, state, state.limit);
          const rawProjected = rows.map(row => visibleMessage(row, agentId, conversationId, originalUser));
          const next = get(response, 'next_before'); const more = get(response, 'has_more');
          check(typeof more === 'boolean' && next === (rawProjected.at(-1)?.id ?? null)
            && (!more || rawProjected.length === state.limit), 'INVALID_PAGINATION');
          const projected = rawProjected.slice(state.overlap ? 1 : 0);
          await identity(signal); await ownConversation(conversationId, signal); alive(signal);
          const cursor = issue(state, more ? projected.at(-2).id : null, projected.map(row => row.id));
          return Object.freeze({ items: Object.freeze(projected.flatMap(item => item.display ? [item.display] : [])),
            cursor, omittedAttachments: projected.some(item => item.omitted) });
        });
      } catch { return Promise.reject(new ReaderError('INVALID_INPUT')); }
    },
    close() { if (!closed) { closed = true; cursors.clear(); closing.abort(); } },
  });
}
