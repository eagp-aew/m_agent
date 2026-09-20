import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeLocalLaunch, createLocalReadClient, createLocalReadController } from '../src/services/local-read-client.mjs';

const capability = 'a'.repeat(64); // Public synthetic credential, never native.
const origin = 'http://127.0.0.1:12345';
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const response = data => new Response(JSON.stringify({ ok: true, data }), { headers: { 'Content-Type': 'application/json' } });
const item = id => ({ id, summary: '<script>untrusted</script>', createdAt: null, lastMessageAt: null });
const page = (items = [], cursor = null) => ({ items, cursor });
const token = '12345678-1234-1234-1234-123456789012';

test('explicit local launch strips fragment synchronously, refresh recovers help, legacy untouched', () => {
  const changes = []; const history = { replaceState: (...args) => changes.push(args) };
  const location = { origin, pathname: '/', search: '?local=1', hash: `#capability=${capability}` };
  const launch = consumeLocalLaunch(location, history); assert.equal(changes[0][2], '/?local=1');
  assert.equal(launch.capability, capability);
  assert.deepEqual(consumeLocalLaunch({ ...location, hash: '' }, history), { local: true });
  assert.deepEqual(consumeLocalLaunch({ ...location, search: '', hash: '#legacy' }, history), { local: false });
  assert.equal(changes.length, 2);
  assert.deepEqual(consumeLocalLaunch(location, { replaceState() { throw new Error('PRIVATE'); } }), { local: true });
  assert.deepEqual(consumeLocalLaunch({ ...location, origin: 'https://foreign.invalid' }, history), { local: true });
});

test('client uses header-only same-origin POST, projects data and clears capability on disconnect', async () => {
  const calls = []; const client = createLocalReadClient({ origin, capability }, { fetchImpl: async (url, options) => {
    calls.push({ url, options }); return response({ ...page([item('conv-1')]), private: 'CANARY' });
  } });
  const result = await client.listConversations({ search: '中文' });
  assert.equal(result.items[0].summary, '<script>untrusted</script>'); assert.ok(!JSON.stringify(result).includes('CANARY'));
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${capability}`); assert.ok(!calls[0].url.includes(capability));
  assert.equal(calls[0].options.credentials, 'omit'); assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer'); client.disconnect();
  await assert.rejects(client.status(), { code: 'DISCONNECTED' }); assert.equal(calls.length, 1);
});

test('client rejects malformed/oversized/error replies without raw errors or empty-success substitution', async () => {
  for (const make of [() => response({ items: null, cursor: null }), () => response({ ...page(), cursor: 'bad' }),
    () => response({ ...page(), items: [item('conv-1'), item('conv-1')] }),
    () => new Response('PRIVATE_ERROR', { status: 403 }), () => response({ ...page(), extra: 'x'.repeat(2097152) })]) {
    const client = createLocalReadClient({ origin, capability }, { fetchImpl: async () => make() });
    await assert.rejects(client.listConversations(), error => { assert.ok(!error.message.includes('PRIVATE')); return true; }); client.disconnect();
  }
});

test('read cancellation and disconnect suppress responses even when a mock fetch ignores abort', async () => {
  const gate = deferred(); const client = createLocalReadClient({ origin, capability }, { fetchImpl: () => gate.promise });
  const abort = new AbortController(); const reading = client.status({ signal: abort.signal }); abort.abort();
  gate.resolve(response({ phase: 'ready', agentId: 'agent-1' })); await assert.rejects(reading, { code: 'ABORTED' });
  client.disconnect();
});

test('controller guards repeated start, stale search/selection and unknown continuation outcomes', async () => {
  let state; let statuses = 0; const lists = []; const histories = [];
  const client = { async status() { statuses++; return { agentId: 'agent-1' }; },
    listConversations(input) { const gate = deferred(); lists.push({ input, gate }); return gate.promise; },
    listMessages(id, input) { const gate = deferred(); histories.push({ id, input, gate }); return gate.promise; }, disconnect() {} };
  const controller = createLocalReadController(client, value => { state = value; });
  const start = controller.start(); await controller.start(); await Promise.resolve(); assert.equal(statuses, 1);
  controller.changeSearch('新'); const next = controller.loadList();
  lists[1].gate.resolve(page([item('conv-new')], token)); await next;
  lists[0].gate.resolve(page([item('conv-old')])); await start; assert.equal(state.conversations[0].id, 'conv-new');
  const a = controller.select('conv-new'); const b = controller.select('conv-other');
  histories[1].gate.resolve({ ...page([{ id: 'm2', role: 'assistant', content: '新', date: null },
    { id: 'm1', role: 'user', content: '旧', date: null }], token), omittedAttachments: true }); await b;
  histories[0].gate.resolve({ ...page([{ id: 'stale', role: 'assistant', content: '不可显示', date: null }]), omittedAttachments: false }); await a;
  assert.deepEqual(state.messages.map(row => row.id), ['m1', 'm2']); assert.equal(state.selected, 'conv-other');
  const more = controller.moreHistory(); assert.equal(state.historyCursor, null);
  histories[2].gate.reject(new Error('PRIVATE')); await more; assert.ok(state.historyError); assert.equal(state.messages.length, 2);
  await controller.moreHistory(); assert.equal(histories.length, 3);
  const moreList = controller.loadList(true); lists[2].gate.reject(new Error('PRIVATE')); await moreList;
  await controller.loadList(true); assert.equal(lists.length, 3); assert.ok(state.listError);
  controller.disconnect(); assert.equal(state.phase, 'disconnected'); assert.deepEqual(state.messages, []); assert.deepEqual(state.conversations, []);
});
