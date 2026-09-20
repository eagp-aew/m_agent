import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createAuthenticatedAppServer } from '../server/authenticated-app-server.mjs';
import { createConversationReader } from '../server/conversation-reader.mjs';

const { WebSocketServer } = createRequire(new URL('../server/package.json', import.meta.url))('ws');
const AGENT = 'agent-personal-1';
const TAG = 'personal-co-v1';
const DATE = '2026-09-13T01:02:03.000Z';
const conversation = id => ({ id, agent_id: AGENT, summary: `中文会话 ${id}`, tags: ['学习'],
  created_at: DATE, updated_at: DATE, last_message_at: null });
const message = (id, type = 'assistant_message', conversationId = 'conv-1') => ({ id,
  agent_id: AGENT, conversation_id: conversationId, message_type: type, date: DATE,
  content: [{ type: 'text', text: `中文内容 ${id}` }], secret: 'INTERNAL_SECRET', reasoning: 'INTERNAL_REASONING' });
const page = (messages, has_more = false) => ({ messages, next_before: messages.at(-1)?.id ?? null, has_more });
const code = expected => failure => {
  assert.equal(failure.message, 'Conversation read failed.'); assert.equal(failure.code, expected);
  assert.equal(failure.cause, undefined); assert.ok(!JSON.stringify(failure).includes('INTERNAL')); return true;
};
function fixture(override = () => undefined) {
  const calls = []; let closed = 0;
  const client = { async request(type, fields) {
    calls.push({ type, fields: structuredClone(fields) });
    const extra = await override(type, fields, calls);
    if (extra !== undefined) return structuredClone({ success: true, ...extra });
    if (type === 'agent_list') return { success: true, agents: [{ id: AGENT, tags: [TAG] }] };
    if (type === 'conversation_list') return { success: true, conversations: [conversation('conv-1'), conversation('conv-2')] };
    if (type === 'conversation_retrieve') return { success: true, conversation: conversation(fields.conversation_id) };
    if (type === 'conversation_messages_list') return { success: true, ...page([message('message-1')]) };
    throw new Error('Unexpected synthetic command.');
  }, close() { closed++; } };
  return { client, calls, get closed() { return closed; }, reader: createConversationReader(client, { agentId: AGENT }) };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

test('retained-only admission filters raw pages without losing empty-page continuation', async () => {
  const rows = Array.from({ length: 23 }, (_, index) => ({ ...conversation(`conv-${index}`),
    tags: index === 20 ? ['personal-co-retained-v1'] : index === 21 ? ['personal-co-retained-v1', 'privacy:temporary'] : [] }));
  const f = fixture((type, fields) => type === 'conversation_list' ? {
    conversations: fields.query.after ? rows.slice(19) : rows.slice(0, 21),
  } : undefined);
  const reader = createConversationReader(f.client, { agentId: AGENT, retainedOnly: true });
  const first = await reader.listConversations(); assert.deepEqual(first.items, []); assert.ok(first.cursor);
  const second = await reader.listConversations({ cursor: first.cursor });
  assert.deepEqual(second.items.map(row => row.id), ['conv-20']); assert.equal(second.cursor, null); reader.close();
  assert.throws(() => createConversationReader(f.client, { agentId: AGENT, retainedOnly: 'true' }), code('INVALID_INPUT'));
  assert.throws(() => createConversationReader(f.client, { agentId: AGENT, retainedOnly: null }), code('INVALID_INPUT'));
});

test('retained-only history rejects unknown/temporary/excluded and rechecks privacy before delivery', async () => {
  for (const changed of [false, true]) for (const tags of [[], ['privacy:temporary'], ['personal-co-retained-v1', 'privacy:excluded']]) {
    let fetched = false;
    const f = fixture(type => {
      if (type === 'conversation_messages_list') fetched = true;
      if (type === 'conversation_retrieve') return { conversation: { ...conversation('conv-1'),
        tags: changed && !fetched ? ['personal-co-retained-v1'] : tags } };
    });
    const reader = createConversationReader(f.client, { agentId: AGENT, retainedOnly: true });
    await assert.rejects(reader.listMessages('conv-1'), code('PRIVACY_EXCLUDED')); assert.equal(fetched, changed); reader.close();
  }
});

test('list returns only immutable bounded display fields with same-Agent pre/post inventory checks', async () => {
  const f = fixture(type => type === 'conversation_list' ? { conversations: [
    { ...conversation('conv-1'), configuration: 'INTERNAL_CONFIG', tools: ['INTERNAL_TOOL'], hidden: false },
    { id: 'conv-2', agent_id: AGENT, summary: null },
  ] } : undefined);
  const output = await f.reader.listConversations({ search: '中文' });
  assert.deepEqual(output.items[1], { id: 'conv-2', summary: null, tags: [], createdAt: null, updatedAt: null, lastMessageAt: null });
  assert.equal(output.items[0].summary, '中文会话 conv-1'); assert.equal(output.cursor, null);
  assert.ok(!JSON.stringify(output).includes('INTERNAL'));
  assert.ok(Object.isFrozen(output) && Object.isFrozen(output.items) && Object.isFrozen(output.items[0].tags));
  assert.deepEqual(f.calls.map(call => call.type), ['agent_list', 'conversation_list', 'agent_list']);
  assert.deepEqual(f.calls[0].fields, { query: { tags: [TAG], limit: 2 } });
  assert.deepEqual(f.calls[1].fields, { query: { agent_id: AGENT, limit: 21, summary_search: '中文' } });
  f.reader.close(); assert.equal(f.closed, 0);
});

test('message projection omits internal canaries and visible attachments, preserving only user/assistant text', async () => {
  const rows = [message('message-1', 'user_message'), message('message-2:assistant:2'),
    message('message-2:reasoning:0', 'reasoning_message'), message('message-2:tool:call.id:request', 'approval_request_message'),
    message('message-3', 'system_message'), message('message-4', 'summary_message'), message('message-5', 'tool_return_message')];
  rows[0].content.push({ type: 'image', source: { data: 'INTERNAL_BASE64' } });
  rows[1].content.push({ type: 'text', text: '<script>untrusted text</script>' });
  const f = fixture(type => type === 'conversation_messages_list' ? page(rows) : undefined);
  const output = await f.reader.listMessages('conv-1');
  assert.deepEqual(output.items.map(item => item.role), ['user', 'assistant']);
  assert.equal(output.omittedAttachments, true); assert.equal(output.cursor, null);
  assert.ok(output.items[1].content.endsWith('<script>untrusted text</script>'));
  assert.ok(!JSON.stringify(output).includes('INTERNAL'));
  assert.deepEqual(Object.keys(output.items[0]).sort(), ['content', 'date', 'id', 'role']);
  assert.deepEqual(f.calls.map(call => call.type), ['agent_list', 'conversation_retrieve', 'conversation_messages_list', 'agent_list', 'conversation_retrieve']);
  assert.deepEqual(f.calls[2].fields.query, { agent_id: AGENT, limit: 20, order: 'desc' });
});

test('unique native-visible tagged Agent gate rejects zero, duplicate, wrong, missing-tag and malformed inventory', async () => {
  for (const agents of [[], [{ id: AGENT, tags: [TAG] }, { id: 'agent-other', tags: [TAG] }],
    [{ id: 'agent-other', tags: [TAG] }], [{ id: AGENT, tags: [] }], null, [{}]]) {
    const f = fixture(type => type === 'agent_list' ? { agents } : undefined);
    await assert.rejects(f.reader.listConversations(), code('AGENT_IDENTITY_CHANGED'));
    assert.equal(f.calls.length, 1);
  }
});

test('list, retrieved conversation and all raw history rows must have exact ownership and non-hidden conversation', async () => {
  for (const [stage, override, expected] of [
    ['conversation_list', { conversations: [{ ...conversation('conv-1'), agent_id: 'agent-other' }] }, 'OWNERSHIP_CHANGED'],
    ['conversation_list', { conversations: [{ ...conversation('conv-1'), hidden: true }] }, 'HIDDEN_CONVERSATION'],
    ['conversation_retrieve', { conversation: { ...conversation('conv-1'), agent_id: 'agent-other' } }, 'OWNERSHIP_CHANGED'],
    ['conversation_retrieve', { conversation: { ...conversation('conv-2') } }, 'OWNERSHIP_CHANGED'],
    ['conversation_retrieve', { conversation: { ...conversation('conv-1'), hidden: true } }, 'HIDDEN_CONVERSATION'],
    ['conversation_messages_list', page([{ ...message('m-1:reasoning:0', 'reasoning_message'), agent_id: 'agent-other' }]), 'OWNERSHIP_CHANGED'],
    ['conversation_messages_list', page([{ ...message('m-1'), conversation_id: 'conv-2' }]), 'OWNERSHIP_CHANGED'],
  ]) {
    const f = fixture(type => type === stage ? override : undefined);
    await assert.rejects(stage === 'conversation_list' ? f.reader.listConversations() : f.reader.listMessages('conv-1'), code(expected));
  }
});

test('identity and conversation changes after content fetch suppress all delivery', async () => {
  for (const change of ['agent', 'owner', 'hidden']) {
    let fetched = false;
    const f = fixture(type => {
      if (type === 'conversation_messages_list') fetched = true;
      if (fetched && change === 'agent' && type === 'agent_list') return { agents: [{ id: 'agent-other', tags: [TAG] }] };
      if (fetched && type === 'conversation_retrieve') return { conversation: { ...conversation('conv-1'),
        ...(change === 'owner' ? { agent_id: 'agent-other' } : { hidden: true }) } };
    });
    await assert.rejects(f.reader.listMessages('conv-1'), code(change === 'agent' ? 'AGENT_IDENTITY_CHANGED' : change === 'owner' ? 'OWNERSHIP_CHANGED' : 'HIDDEN_CONVERSATION'));
  }
});

test('lookahead is validated but not consumed; issued cursors are bound to reader/kind/search/conversation and single successful use', async () => {
  const all = Array.from({ length: 22 }, (_, i) => conversation(`conv-${i + 1}`));
  const dispatch = (type, fields) => type === 'conversation_list'
    ? { conversations: all.slice(fields.query.after ? all.findIndex(row => row.id === fields.query.after) + 1 : 0).slice(0, fields.query.limit) } : undefined;
  const f = fixture(dispatch); const other = fixture(dispatch);
  const first = await f.reader.listConversations({ search: '中文' });
  assert.equal(first.items.length, 20); assert.equal(first.cursor.length, 36); assert.ok(!first.cursor.includes('conv'));
  await assert.rejects(other.reader.listConversations({ search: '中文', cursor: first.cursor }), code('INVALID_CURSOR'));
  await assert.rejects(f.reader.listMessages('conv-1', { cursor: first.cursor }), code('INVALID_CURSOR'));
  await assert.rejects(f.reader.listConversations({ search: 'different', cursor: first.cursor }), code('INVALID_CURSOR'));
  const second = await f.reader.listConversations({ search: '中文', cursor: first.cursor });
  assert.deepEqual(second.items.map(row => row.id), ['conv-21', 'conv-22']); assert.equal(second.cursor, null);
  await assert.rejects(f.reader.listConversations({ search: '中文', cursor: first.cursor }), code('INVALID_CURSOR'));
});

test('missing list anchors reject native restart after hidden, deleted or search-removed rows and preserve the cursor', async () => {
  for (const change of ['hidden', 'deleted', 'search']) {
    for (const index of [19, 18]) {
      const original = Array.from({ length: 21 }, (_, i) => conversation(`old-${i}`));
      let source = structuredClone(original);
      const f = fixture((type, fields) => {
        if (type !== 'conversation_list') return;
        const query = fields.query;
        const filtered = source.filter(row => !row.hidden && row.summary.includes(query.summary_search));
        const start = query.after ? filtered.findIndex(row => row.id === query.after) + 1 : 0;
        return { conversations: filtered.slice(start, start + query.limit) };
      });
      const first = await f.reader.listConversations({ search: '中文' });
      assert.deepEqual(first.items.map(row => row.id), original.slice(0, 20).map(row => row.id));
      if (change === 'hidden') source[index].hidden = true;
      if (change === 'deleted') source.splice(index, 1);
      if (change === 'search') source[index].summary = 'no longer matches';
      source.unshift(...Array.from({ length: 21 }, (_, i) => conversation(`new-${i}`)));
      await assert.rejects(f.reader.listConversations({ search: '中文', cursor: first.cursor }), code('NONADVANCING_PAGE'));
      source = original;
      const retry = await f.reader.listConversations({ search: '中文', cursor: first.cursor });
      assert.deepEqual(retry.items.map(row => row.id), ['old-20']); assert.equal(retry.cursor, null);
      assert.equal(f.calls.filter(call => call.type === 'conversation_list').length, 3);
    }
  }
});

test('missing history anchors reject native restart with unseen new messages and preserve the cursor', async () => {
  for (const index of [19, 18]) {
    const original = Array.from({ length: 21 }, (_, i) => message(`old-${i}:assistant:2`));
    let source = [...original];
    const f = fixture((type, fields) => {
      if (type !== 'conversation_messages_list') return;
      // Descending equivalent of native before filtering followed by reversal.
      const start = fields.query.before ? source.findIndex(row => row.id === fields.query.before) + 1 : 0;
      const remaining = source.slice(start);
      return page(remaining.slice(0, fields.query.limit), remaining.length > fields.query.limit);
    });
    const first = await f.reader.listMessages('conv-1');
    source.splice(index, 1);
    source.unshift(...Array.from({ length: 21 }, (_, i) => message(`new-${i}:assistant:2`)));
    await assert.rejects(f.reader.listMessages('conv-1', { cursor: first.cursor }), code('NONADVANCING_PAGE'));
    source = original;
    const retry = await f.reader.listMessages('conv-1', { cursor: first.cursor });
    assert.deepEqual(retry.items.map(row => row.id), ['old-20:assistant:2']); assert.equal(retry.cursor, null);
    assert.equal(f.calls.filter(call => call.type === 'conversation_messages_list').length, 3);
  }
});

test('overlap continuations preserve page sizes, lookahead and terminal native metadata', async () => {
  for (const kind of ['conversations', 'messages']) {
    for (const count of [40, 41]) {
      const rows = Array.from({ length: count }, (_, i) => kind === 'conversations'
        ? conversation(`row-${i}`) : message(`row-${i}:reasoning:0`, 'reasoning_message'));
      const command = kind === 'conversations' ? 'conversation_list' : 'conversation_messages_list';
      const f = fixture((type, fields) => {
        if (type !== command) return;
        const boundary = fields.query.after ?? fields.query.before;
        const remaining = rows.slice(boundary ? rows.findIndex(row => row.id === boundary) + 1 : 0);
        const batch = remaining.slice(0, fields.query.limit);
        return kind === 'conversations' ? { conversations: batch } : page(batch, remaining.length > batch.length);
      });
      const read = cursor => kind === 'conversations' ? f.reader.listConversations({ cursor })
        : f.reader.listMessages('conv-1', { cursor });
      const first = await read(); const second = await read(first.cursor);
      const outputs = [first, second];
      assert.equal(Boolean(second.cursor), count === 41);
      if (second.cursor) outputs.push(await read(second.cursor));
      assert.equal(outputs.at(-1).cursor, null);
      assert.deepEqual(outputs.flatMap(output => output.items.map(row => row.id)),
        kind === 'conversations' ? rows.map(row => row.id) : []);
      const calls = f.calls.filter(call => call.type === command);
      assert.deepEqual(calls.map(call => call.fields.query.limit),
        kind === 'conversations' ? (count === 41 ? [21, 22, 22] : [21, 22]) : (count === 41 ? [20, 21, 21] : [20, 21]));
      assert.equal(calls[1].fields.query.after ?? calls[1].fields.query.before, rows[18].id);
      if (calls[2]) assert.equal(calls[2].fields.query.after ?? calls[2].fields.query.before, rows[38].id);
    }
  }
});

test('overlap-only terminal pages are empty while missing, foreign or duplicated overlap fails closed', async () => {
  for (const kind of ['conversations', 'messages']) {
    const rows = Array.from({ length: 21 }, (_, i) => kind === 'conversations'
      ? conversation(`row-${i}`) : message(`row-${i}:assistant:2`));
    for (const mode of ['terminal', 'missing', 'foreign', 'duplicate', 'metadata']) {
      const command = kind === 'conversations' ? 'conversation_list' : 'conversation_messages_list';
      const f = fixture((type, fields) => {
        if (type !== command) return;
        const resumed = fields.query.after ?? fields.query.before;
        let batch = rows.slice(0, fields.query.limit);
        if (resumed) batch = mode === 'missing' ? [] : [{ ...rows[19], ...(mode === 'foreign' ? { agent_id: 'agent-other' } : {}) }];
        if (resumed && mode === 'duplicate') batch.push(rows[19]);
        return kind === 'conversations' ? { conversations: batch }
          : { ...page(batch, !resumed || mode === 'metadata'), ...(resumed && mode === 'metadata' ? { next_before: null } : {}) };
      });
      const read = cursor => kind === 'conversations' ? f.reader.listConversations({ cursor })
        : f.reader.listMessages('conv-1', { cursor });
      const first = await read();
      if (mode === 'terminal' || (mode === 'metadata' && kind === 'conversations')) {
        const next = await read(first.cursor); assert.deepEqual(next.items, []); assert.equal(next.cursor, null);
      } else await assert.rejects(read(first.cursor), code(mode === 'foreign' ? 'OWNERSHIP_CHANGED'
        : mode === 'metadata' ? 'INVALID_PAGINATION' : 'NONADVANCING_PAGE'));
    }
  }
});

test('internal-only full history preserves raw continuation and terminal non-null native next_before is valid', async () => {
  const internal = Array.from({ length: 20 }, (_, i) => message(`m-${20 - i}:reasoning:0`, 'reasoning_message'));
  const f = fixture((type, fields) => type === 'conversation_messages_list'
    ? fields.query.before ? page([internal.at(-1), message('m-0:assistant:2')]) : page(internal, true) : undefined);
  const first = await f.reader.listMessages('conv-1');
  assert.deepEqual(first.items, []); assert.ok(first.cursor); assert.equal(first.omittedAttachments, false);
  await assert.rejects(f.reader.listMessages('conv-2', { cursor: first.cursor }), code('INVALID_CURSOR'));
  const second = await f.reader.listMessages('conv-1', { cursor: first.cursor });
  assert.equal(second.items[0].id, 'm-0:assistant:2'); assert.equal(second.cursor, null);
  assert.equal(f.calls.filter(call => call.type === 'conversation_messages_list')[1].fields.query.before, 'm-2:reasoning:0');
});

test('duplicates, repeated pages and malformed pagination fail without silently completing history', async () => {
  for (const data of [{ messages: null, next_before: null, has_more: false },
    page([message('m-1'), message('m-1')]), { ...page([message('m-1')]), next_before: 'm-wrong' },
    page([message('m-1')], true), { ...page([]), has_more: true }, { ...page([]), has_more: 'false' }]) {
    const f = fixture(type => type === 'conversation_messages_list' ? data : undefined);
    await assert.rejects(f.reader.listMessages('conv-1'), failure => {
      assert.ok(['INVALID_DATA', 'NONADVANCING_PAGE', 'INVALID_PAGINATION'].includes(failure.code)); return true;
    });
  }
  const rows = Array.from({ length: 20 }, (_, i) => message(`m-${i}:reasoning:0`, 'reasoning_message'));
  const f = fixture(type => type === 'conversation_messages_list' ? page(rows, true) : undefined);
  const first = await f.reader.listMessages('conv-1');
  await assert.rejects(f.reader.listMessages('conv-1', { cursor: first.cursor }), code('NONADVANCING_PAGE'));
});

test('failed fetch preserves an issued cursor for an explicit retry', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => message(`m-${20 - i}:reasoning:0`, 'reasoning_message'));
  let fail = true;
  const f = fixture((type, fields) => {
    if (type !== 'conversation_messages_list') return;
    if (!fields.query.before) return page(rows, true);
    if (fail) { fail = false; throw new Error('INTERNAL upstream failure'); }
    return page([rows.at(-1), message('m-0')]);
  });
  const first = await f.reader.listMessages('conv-1');
  await assert.rejects(f.reader.listMessages('conv-1', { cursor: first.cursor }), code('READ_FAILED'));
  assert.equal((await f.reader.listMessages('conv-1', { cursor: first.cursor })).items[0].id, 'm-0');
});

test('abort preserves a cursor without publishing a replacement; abandoned borrowed reads stay bounded', async () => {
  const rows = Array.from({ length: 20 }, (_, i) => message(`m-${20 - i}:reasoning:0`, 'reasoning_message'));
  const started = deferred(); const release = deferred(); let hold = true;
  const f = fixture(async (type, fields) => {
    if (type !== 'conversation_messages_list') return;
    if (!fields.query.before) return page(rows, true);
    if (hold) { started.resolve(); await release.promise; }
    return page([rows.at(-1), message('m-0')]);
  });
  const first = await f.reader.listMessages('conv-1'); const controller = new AbortController();
  const pending = f.reader.listMessages('conv-1', { cursor: first.cursor }, { signal: controller.signal });
  await started.promise; controller.abort(); await assert.rejects(pending, code('ABORTED'));
  hold = false; release.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await f.reader.listMessages('conv-1', { cursor: first.cursor })).items[0].id, 'm-0');
  const waiting = []; const abandoned = fixture(async type => {
    if (type === 'agent_list' && waiting.length < 4) { const gate = deferred(); waiting.push(gate); await gate.promise; }
  });
  for (let i = 0; i < 4; i++) {
    const abort = new AbortController(); const operation = abandoned.reader.listConversations({}, { signal: abort.signal });
    await new Promise(resolve => setImmediate(resolve)); abort.abort(); await assert.rejects(operation, code('ABORTED'));
  }
  await assert.rejects(abandoned.reader.listConversations(), code('BUSY'));
  assert.equal(abandoned.calls.length, 4);
  waiting.forEach(gate => gate.resolve()); await new Promise(resolve => setImmediate(resolve));
  assert.equal((await abandoned.reader.listConversations()).items.length, 2);
  abandoned.reader.close(); assert.equal(abandoned.closed, 0);
});

test('input authority is captured before awaits and close/abort promptly suppress pending delivery without closing borrowed client', async () => {
  for (const cancel of ['close', 'abort']) {
    const waiting = deferred(); const started = deferred();
    const f = fixture(async type => { if (type === 'conversation_list') { started.resolve(); await waiting.promise; } });
    const input = { search: 'original' }; const controller = new AbortController(); const opts = { signal: controller.signal };
    const pending = f.reader.listConversations(input, opts);
    input.search = 'mutated'; opts.signal = new AbortController().signal;
    await started.promise;
    assert.equal(f.calls.find(call => call.type === 'conversation_list').fields.query.summary_search, 'original');
    await assert.rejects(f.reader.listConversations(), code('BUSY'));
    if (cancel === 'close') f.reader.close(); else controller.abort();
    await assert.rejects(pending, code(cancel === 'close' ? 'CLOSED' : 'ABORTED'));
    assert.equal(f.closed, 0); waiting.resolve(); await new Promise(resolve => setImmediate(resolve));
    if (cancel === 'close') await assert.rejects(f.reader.listConversations(), code('CLOSED'));
  }
  const configuration = { agentId: AGENT }; const f = fixture(); const reader = createConversationReader(f.client, configuration);
  configuration.agentId = 'agent-other'; await reader.listMessages('conv-1');
  assert.equal(f.calls.find(call => call.type === 'conversation_messages_list').fields.query.agent_id, AGENT);
});

test('invalid inputs, malformed display fields and hidden accessors are rejected without exposing internal values', async () => {
  const f = fixture(); let invoked = false;
  await assert.rejects(f.reader.listConversations({ get search() { invoked = true; return 'x'; } }), code('INVALID_INPUT'));
  assert.equal(invoked, false); assert.equal(f.calls.length, 0);
  for (const input of [{ limit: 500 }, { search: 'x'.repeat(257) }, { search: null }, { search: 'x\n' }]) {
    await assert.rejects(f.reader.listConversations(input), code('INVALID_INPUT'));
  }
  for (const id of ['default', '../conv', 'conv-1:assistant:2', 'conv-1\n']) await assert.rejects(f.reader.listMessages(id), code('INVALID_INPUT'));
  for (const row of [{ ...conversation('conv-1'), tags: [5] }, { ...conversation('conv-1'), summary: 'x'.repeat(8193) },
    { ...conversation('conv-1'), created_at: 'not a date' }]) {
    const bad = fixture(type => type === 'conversation_list' ? { conversations: [row] } : undefined);
    await assert.rejects(bad.reader.listConversations(), code('INVALID_DATA'));
  }
});

test('cursor retention and total raw-row scans have explicit finite bounds', async () => {
  const rows = Array.from({ length: 21 }, (_, i) => conversation(`conv-${i}`));
  const retained = fixture(type => type === 'conversation_list' ? { conversations: rows } : undefined);
  for (let i = 0; i < 32; i++) assert.ok((await retained.reader.listConversations()).cursor);
  await assert.rejects(retained.reader.listConversations(), code('CURSOR_LIMIT'));
  const scanned = fixture(type => type === 'conversation_messages_list'
    ? page(Array.from({ length: 20 }, (_, i) => message(`m-${i}:reasoning:0`, 'reasoning_message'))) : undefined);
  for (let i = 0; i < 50; i++) await scanned.reader.listMessages('conv-1');
  await assert.rejects(scanned.reader.listMessages('conv-1'), code('SCAN_LIMIT'));
  const history = Array.from({ length: 1001 }, (_, i) => message(`bound-${i}:reasoning:0`, 'reasoning_message'));
  const overlapScans = fixture((type, fields) => {
    if (type !== 'conversation_messages_list') return;
    const start = fields.query.before ? history.findIndex(row => row.id === fields.query.before) + 1 : 0;
    return page(history.slice(start, start + fields.query.limit), true);
  });
  let cursor;
  for (let i = 0; i < 47; i++) cursor = (await overlapScans.reader.listMessages('conv-1', { cursor })).cursor;
  // 20 first-page rows + 46 * 21 continuation rows = 986; reserve the full next 21.
  const calls = overlapScans.calls.length;
  await assert.rejects(overlapScans.reader.listMessages('conv-1', { cursor }), code('SCAN_LIMIT'));
  assert.equal(overlapScans.calls.length, calls);
});

test('real authenticated ws reader composes two conversations, Chinese display text, projected IDs and internal-page continuation', async t => {
  const raw = Array.from({ length: 20 }, (_, i) => message(`m-${20 - i}:reasoning:0`, 'reasoning_message'));
  const f = fixture((type, fields) => type === 'conversation_messages_list' ? (fields.query.before
    ? page([raw.at(-1), { ...message('m-0:assistant:2'), content: [{ type: 'text', text: '你好，继续学习。' }, { type: 'image', data: 'INTERNAL_BASE64' }] }])
    : page(raw, true)) : undefined);
  const server = createServer(); const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => wss.handleUpgrade(request, socket, head, peer => wss.emit('connection', peer)));
  wss.on('connection', peer => peer.on('message', async data => {
    const { type, request_id, ...fields } = JSON.parse(data.toString());
    const result = type === 'app_server_info' ? { success: true, backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
      capabilities: { agent_management: true, conversation_management: true, memory_management: true, runtime_start: true, split_channels: false } }
      : await f.client.request(type, fields);
    peer.send(JSON.stringify({ ...result, type: `${type}_response`, request_id }));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const host = await createAuthenticatedAppServer({}, { makeSandbox: async () => ({ args: [] }) });
  try {
    const client = await host.connect(`ws://127.0.0.1:${server.address().port}/ws`);
    const reader = createConversationReader(client, { agentId: AGENT });
    const listed = await reader.listConversations(); assert.equal(listed.items.length, 2);
    const first = await reader.listMessages('conv-1'); assert.deepEqual(first.items, []); assert.ok(first.cursor);
    const next = await reader.listMessages('conv-1', { cursor: first.cursor });
    assert.equal(next.items[0].content, '你好，继续学习。'); assert.equal(next.omittedAttachments, true);
    assert.ok(!JSON.stringify(next).includes('INTERNAL'));
    reader.close(); assert.deepEqual((await client.request('agent_list')).agents, [{ id: AGENT, tags: [TAG] }]);
    t.diagnostic('Only controlled loopback ws used; no upstream runtime launched.');
  } finally {
    await host.dispose(); for (const peer of wss.clients) peer.terminate();
    await new Promise(resolve => wss.close(resolve)); await new Promise(resolve => server.close(resolve));
  }
});
