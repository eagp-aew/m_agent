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
const operationId = '12345678-1234-4234-8234-123456789012';
const tick = () => new Promise(resolve => setImmediate(resolve));
function chatFixture(t, behavior = {}) {
  let state; let record = behavior.record ?? null; let active = null; const calls = [];
  const client = createLocalReadClient({ origin, capability }, { fetchImpl: async (url, options) => {
    const route = url.split('/').at(-1); const input = JSON.parse(options.body); calls.push({ route, input });
    assert.equal(options.headers.Authorization, `Bearer ${capability}`);
    const override = await behavior.request?.(route, input); if (override !== undefined) return response(override);
    if (route === 'status') return response({ phase: 'ready', agentId: 'agent-1', chatEnabled: true, activeOperationId: active });
    if (route === 'conversations') return response(page([item('conv-1'), item('conv-2')]));
    if (route === 'messages') return response({ ...page(), omittedAttachments: false });
    if (route === 'pending') return response({ items: record?.status === 'unknown' ? [record] : [] });
    if (route === 'operation' || route === 'recover-create') return response(record);
    if (route === 'submit') {
      record = { operationId: input.operationId, kind: input.kind, status: 'unknown', conversationId: input.conversationId ?? null,
        failure: null, ...(input.kind === 'create' ? { title: input.title } : { text: input.text }) };
      return response(record);
    }
    if (route === 'context-preview') return response({ agentId: 'agent-1', revision: 0, digest: 'a'.repeat(64), more: false, omitted: 0,
      items: [1, 2, 3, 4, 5].map(n => ({ id: String(n).repeat(64), source: 'PROFILE', text: 'evidence', epistemicState: 'unknown' })) });
    assert.fail(`unexpected ${route}`);
  } });
  const controller = createLocalReadController(client, next => { state = next; }, { makeId: () => operationId, pollMs: 5 });
  t.after(() => controller.disconnect());
  return { controller, client, calls, get state() { return state; }, get record() { return record; }, set record(value) { record = value; }, set active(value) { active = value; } };
}

test('actual client/controller captures one immutable request, preserves switched/edited drafts and clears only exact completion', async t => {
  const gate = deferred(); let submitted;
  const f = chatFixture(t, { request(route, input) { if (route === 'submit') { submitted = input; return gate.promise; } } });
  await f.controller.start(); await f.controller.select('conv-1'); f.controller.editDraft('original');
  const sending = f.controller.send(); await f.controller.send(); await tick(); assert.equal(f.calls.filter(row => row.route === 'submit').length, 1);
  f.controller.editDraft('newer edit'); await f.controller.select('conv-2'); f.controller.editDraft('other draft');
  f.record = { operationId, kind: 'send', text: submitted.text, status: 'completed', conversationId: 'conv-1', failure: null };
  gate.resolve(f.record); await sending;
  assert.equal(f.state.selected, 'conv-2'); assert.equal(f.state.drafts['conv-1'], 'newer edit'); assert.equal(f.state.drafts['conv-2'], 'other draft');
  assert.equal(f.controller.needsDisconnectConfirmation(), true);
  f.controller.disconnect(); assert.deepEqual(f.state.drafts, {});
  const exact = chatFixture(t); await exact.controller.start(); await exact.controller.select('conv-1'); exact.controller.editDraft('unchanged');
  await exact.controller.send(); exact.record = { ...exact.record, status: 'completed' }; await exact.controller.refreshOperation();
  assert.equal(exact.state.drafts['conv-1'], '');
});

test('lost response retains original UUID/draft, pending reconnect recovers text, and never timer-resends unknown', async t => {
  const unknown = { operationId, kind: 'send', text: 'retained original', status: 'unknown', conversationId: 'conv-1', failure: null };
  const f = chatFixture(t, { request(route) { if (route === 'submit') { f.record = unknown; throw new Error('response lost'); } } });
  await f.controller.start(); await f.controller.select('conv-1'); f.controller.editDraft(unknown.text); await f.controller.send();
  assert.equal(f.state.drafts['conv-1'], unknown.text); assert.equal(f.state.operation.operationId, operationId);
  await f.controller.send(); await f.controller.refreshOperation();
  const count = f.calls.length; await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(f.calls.length, count);
  assert.equal(f.calls.filter(row => row.route === 'submit').length, 1);
  const reopened = chatFixture(t, { record: unknown }); await reopened.controller.start();
  assert.equal(reopened.state.operation.text, unknown.text); assert.equal(reopened.state.operation.status, 'unknown');
  assert.equal(reopened.calls.filter(row => row.route === 'submit').length, 0);
});

const otherOperationId = '22345678-1234-4234-8234-123456789012';
const restoredSend = { operationId, kind: 'send', text: 'retained original', status: 'unknown', conversationId: 'conv-1', failure: null };
const restoredCreate = { operationId, kind: 'create', title: 'retained title', status: 'unknown', conversationId: null, failure: null };

for (const route of ['submit', 'operation', 'recover-create']) test(`client binds ${route} response to requested UUID`, async () => {
  const original = route === 'recover-create' ? restoredCreate : restoredSend;
  const client = createLocalReadClient({ origin, capability }, { fetchImpl: async () => response({ ...original,
    operationId: otherOperationId, status: 'completed', conversationId: 'conv-2' }) });
  try {
    await assert.rejects(route === 'submit' ? client.submit({ operationId, kind: 'send', text: original.text, conversationId: 'conv-1' })
      : route === 'operation' ? client.operation(operationId) : client.recoverCreate(operationId), { code: 'RECEIPT_MISMATCH' });
  } finally { client.disconnect(); }
});

for (const [name, original, changed] of [
  ['original A/B repro', restoredSend, { operationId: otherOperationId, conversationId: 'conv-2', text: 'unrelated message' }],
  ['send kind', restoredSend, { kind: 'create', title: 'retained title' }],
  ['send text', restoredSend, { text: 'changed' }],
  ['send conversation', restoredSend, { conversationId: 'conv-2' }],
  ['create kind', restoredCreate, { kind: 'send', text: 'changed' }],
  ['create title', restoredCreate, { title: 'changed' }],
]) test(`restored receipt rejects ${name} without replacing UNKNOWN or allowing mutations`, async t => {
  const f = chatFixture(t, { record: original }); await f.controller.start();
  await f.controller.select('conv-1'); f.controller.editDraft('new draft'); f.controller.editTitle('new title');
  f.record = { ...original, status: 'completed', conversationId: 'conv-1', ...changed };
  await f.controller.refreshOperation();
  assert.deepEqual(f.state.operation, original); assert.ok(f.state.chatError);
  assert.equal(f.state.drafts['conv-1'], 'new draft'); assert.equal(f.state.title, 'new title');
  await f.controller.send(); await f.controller.create();
  assert.equal(f.calls.filter(row => row.route === 'submit').length, 0);
});

for (const [name, changed] of [['UUID', { operationId: otherOperationId }], ['kind', { kind: 'send', text: 'other' }], ['title', { title: 'changed' }]]) {
  test(`restored create recovery rejects changed ${name} and preserves its visible error`, async t => {
    const f = chatFixture(t, { record: restoredCreate, request(route) {
      if (route === 'recover-create') return { ...restoredCreate, status: 'completed', conversationId: 'conv-1', ...changed };
    } });
    await f.controller.start(); f.controller.editTitle('new title'); await f.controller.recoverCreate();
    assert.deepEqual(f.state.operation, restoredCreate); assert.ok(f.state.chatError); assert.equal(f.state.title, 'new title');
    await f.controller.create(); assert.equal(f.calls.filter(row => row.route === 'submit').length, 0);
  });
}

for (const [kind, changed] of [['send', { operationId: otherOperationId }], ['send', { text: 'changed' }],
  ['send', { conversationId: 'conv-2' }], ['send', { kind: 'create', title: 'changed' }],
  ['create', { operationId: otherOperationId }], ['create', { title: 'changed' }]]) {
  test(`new ${kind} rejects submit mismatch ${Object.keys(changed)[0]} and retains captured input`, async t => {
    const original = kind === 'send' ? restoredSend : restoredCreate;
    const f = chatFixture(t, { request(route) {
      if (route === 'submit') return { ...original, status: 'completed', conversationId: 'conv-1', ...changed };
    } });
    await f.controller.start(); await f.controller.select('conv-1');
    f.controller.editDraft(restoredSend.text); f.controller.editTitle(restoredCreate.title);
    await f.controller[kind === 'send' ? 'send' : 'create']();
    assert.deepEqual(f.state.operation, original); assert.ok(f.state.chatError);
    assert.equal(f.state.drafts['conv-1'], restoredSend.text); assert.equal(f.state.title, restoredCreate.title);
    await f.controller.send(); await f.controller.create(); assert.equal(f.calls.filter(row => row.route === 'submit').length, 1);
  });
}

for (const original of [restoredSend, restoredCreate]) test(`valid restored ${original.kind} completion preserves page-local draft ownership`, async t => {
  const f = chatFixture(t, { record: original }); await f.controller.start(); await f.controller.select('conv-1');
  f.controller.editDraft(restoredSend.text); f.controller.editTitle(restoredCreate.title);
  f.record = { ...original, status: 'completed', conversationId: 'conv-1' };
  if (original.kind === 'create') await f.controller.recoverCreate(); else await f.controller.refreshOperation();
  assert.equal(f.state.operation.status, 'completed'); assert.equal(f.state.chatError, '');
  assert.equal(f.state.drafts['conv-1'], restoredSend.text); assert.equal(f.state.title, restoredCreate.title);
  assert.equal(f.calls.filter(row => row.route === 'submit').length, 0);
});

test('valid newly captured create completion clears only its captured title', async t => {
  const f = chatFixture(t); await f.controller.start(); f.controller.editTitle('captured title'); await f.controller.create();
  f.record = { ...f.record, status: 'completed', conversationId: 'conv-1' }; await f.controller.refreshOperation();
  assert.equal(f.state.operation.status, 'completed'); assert.equal(f.state.title, ''); assert.equal(f.state.chatError, '');
});

test('context selection is one-message bounded and create recovery only queries existing result', async t => {
  const f = chatFixture(t); await f.controller.start(); await f.controller.select('conv-1'); f.controller.editDraft('hello');
  await f.controller.previewContext(); for (let n = 1; n <= 5; n++) f.controller.toggleContextItem(String(n).repeat(64));
  assert.equal(f.state.contextIds.length, 4); await f.controller.send();
  assert.equal(f.calls.find(row => row.route === 'submit').input.context.items.length, 4); assert.deepEqual(f.state.contextIds, []);
  const create = chatFixture(t, { record: { operationId, kind: 'create', title: 'retained title', status: 'unknown', conversationId: null, failure: null } });
  await create.controller.start(); await create.controller.recoverCreate();
  assert.equal(create.calls.filter(row => row.route === 'recover-create').length, 1); assert.equal(create.calls.filter(row => row.route === 'submit').length, 0);
});

test('in-flight old status cannot clobber new submission or stall active-only bounded polling', async t => {
  const gate = deferred(); let hold = false;
  const f = chatFixture(t, { request(route) { if (route === 'status' && hold) { hold = false; return gate.promise; } } });
  await f.controller.start(); await f.controller.select('conv-1'); f.controller.editDraft('original');
  hold = true; const old = f.controller.refreshOperation(); await tick();
  f.active = operationId; await f.controller.send();
  gate.resolve({ phase: 'ready', agentId: 'agent-1', chatEnabled: true, activeOperationId: null }); await old; await tick(); await tick();
  assert.equal(f.state.activeOperationId, operationId);
  f.record = { ...f.record, status: 'completed' }; f.active = null;
  await new Promise(resolve => setTimeout(resolve, 25)); assert.equal(f.state.operation.status, 'completed'); assert.equal(f.state.drafts['conv-1'], '');
  const count = f.calls.length; await new Promise(resolve => setTimeout(resolve, 20)); assert.equal(f.calls.length, count);
  assert.equal(f.calls.filter(row => row.route === 'submit').length, 1);
});

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
