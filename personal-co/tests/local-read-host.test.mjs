import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { request as httpRequest } from 'node:http';
import { createHash } from 'node:crypto';
import { startLocalReadHost } from '../server/local-read-host.mjs';
import { RUNTIME_PIN } from '../server/runtime-sandbox.mjs';
import { createConversationReader } from '../server/conversation-reader.mjs';
import { openChatOperationStore } from '../server/chat-operation-store.mjs';
import { createLocalReadClient } from '../src/services/local-read-client.mjs';

const capability = 'b'.repeat(64); // Explicit public synthetic browser-only token.
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0049-unit-'));
  const config = { dependencyRoot: path.join(root, 'node_modules'), stateRoot: path.join(root, 'state'),
    protectedRoot: path.join(root, 'protected'), webRoot: path.join(root, 'web') };
  for (const directory of Object.values(config)) await fs.mkdir(directory, { mode: 0o700 });
  await fs.mkdir(path.join(config.webRoot, '_expo'), { mode: 0o700 });
  await fs.mkdir(path.join(config.webRoot, '_expo/static'), { mode: 0o700 });
  await fs.writeFile(path.join(config.webRoot, 'index.html'), '<!doctype html><title>Synthetic fixture</title>', { mode: 0o600 });
  await fs.writeFile(path.join(config.webRoot, '_expo/static/app.js'), '/* public fixture */', { mode: 0o600 });
  t.diagnostic(`Retained synthetic fixture: ${root}`); return config;
}
function fakeSession(behavior = {}) {
  const done = deferred(); let phase = 'ready'; let closes = 0; const calls = [];
  const session = { ready: behavior.ready ?? Promise.resolve({ agentId: 'agent-synthetic' }), terminal: done.promise,
    status: () => ({ phase }),
    async listConversations(input, options) {
      calls.push({ input, options });
      return behavior.list ? behavior.list(input, options) : { items: [{ id: 'conv-1', summary: '<script>text</script>',
        createdAt: null, lastMessageAt: null, secret: 'PRIVATE_CANARY' }], cursor: null };
    },
    async listMessages(id, input, options) {
      calls.push({ id, input, options });
      return { items: [{ id: 'message-1', role: 'assistant', content: '中文', date: null, secret: 'PRIVATE_CANARY' }], cursor: null, omittedAttachments: true };
    },
    async close() { closes++; phase = 'closed'; const result = { cleanup: { confirmed: !behavior.unclean } }; done.resolve(result); return result; },
  };
  return { session, calls, fail: () => done.resolve({ cleanup: { confirmed: false } }), get closes() { return closes; } };
}
function request(host, pathname = '/api/local/status', { method = 'POST', headers = {}, body = '{}', rawHeaders } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(host.origin);
    const req = httpRequest({ hostname: '127.0.0.1', port: url.port, path: pathname, method,
      headers: rawHeaders ?? { Host: url.host, Origin: host.origin, Authorization: `Bearer ${capability}`,
        'Content-Type': 'application/json', ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolve({ status: res.statusCode,
        headers: res.headers, text: Buffer.concat(chunks).toString('utf8') })); res.on('error', reject);
    }); req.on('error', reject); req.end(body);
  });
}
async function hostFixture(t, behavior = {}, seams = {}) {
  const config = await fixture(t); const fake = fakeSession(behavior);
  const host = await startLocalReadHost(config, {}, { capability, makeSession(captured) {
    assert.equal(captured.retainedOnly, true); assert.equal(captured.stateRoot, config.stateRoot); return fake.session;
  }, ...seams });
  t.after(() => host.close()); return { config, fake, host };
}

test('real HTTP host forces retainedOnly, exposes fixed projected reads and security headers', async t => {
  const { host, fake } = await hostFixture(t);
  assert.deepEqual(Object.keys(host).sort(), ['agentId', 'close', 'launchUrl', 'origin', 'terminal']);
  const status = await request(host); assert.equal(status.status, 200);
  assert.deepEqual(JSON.parse(status.text).data, { phase: 'ready', agentId: 'agent-synthetic', chatEnabled: false, activeOperationId: null });
  const list = await request(host, '/api/local/conversations', { body: JSON.stringify({ search: '中文' }) });
  assert.ok(!list.text.includes('PRIVATE_CANARY')); assert.equal(JSON.parse(list.text).data.items[0].summary, '<script>text</script>');
  const messages = await request(host, '/api/local/messages', { body: '{"conversationId":"conv-1"}' });
  assert.equal(JSON.parse(messages.text).data.omittedAttachments, true); assert.ok(!messages.text.includes('PRIVATE_CANARY'));
  assert.equal(fake.calls.length, 2); assert.equal(status.headers['cache-control'], 'no-store');
  assert.equal(status.headers['referrer-policy'], 'no-referrer'); assert.equal(status.headers['access-control-allow-origin'], undefined);
  assert.ok(status.headers['content-security-policy'].includes("script-src 'self'"));
  const closing = host.close(); assert.equal(closing, host.close()); assert.equal((await closing).confirmed, true);
  assert.equal(await host.terminal, await closing); await assert.rejects(request(host));
});

test('fixed authenticated chat HTTP routes bind real durable receipts, exact DTO and escaped byte limits', async t => {
  const config = await fixture(t); const fake = fakeSession();
  const store = openChatOperationStore({ directory: config.protectedRoot, agentId: 'agent-synthetic' });
  let dispatches = 0; let recoveries = 0;
  fake.session.chat = {
    submit(value) { const reserved = store.reserve(value); if (reserved.dispatchAllowed) dispatches++; return reserved.record; },
    get: id => store.get(id), listPending: () => store.listPending(),
    recoverCreate(id) { recoveries++; return store.get(id); },
    previewContext: async () => ({ agentId: 'agent-synthetic', revision: 0, digest: 'a'.repeat(64), more: false, omitted: 0,
      items: [{ id: 'b'.repeat(64), source: 'PROFILE', text: 'Quoted evidence', epistemicState: 'unknown', private: 'CANARY' }], private: 'CANARY' }),
  };
  const host = await startLocalReadHost({ ...config, chat: { providerPort: 12345, model: 'lmstudio/synthetic' } }, {}, { capability, makeSession: () => fake.session });
  t.after(async () => { await host.close(); store.close(); });
  const client = createLocalReadClient({ origin: host.origin, capability }, { fetchImpl: (url, options) =>
    fetch(url, { ...options, headers: { ...options.headers, Origin: host.origin } }) });
  t.after(() => client.disconnect());
  assert.equal((await client.status()).chatEnabled, true);
  const creation = { operationId: '12345678-1234-4234-8234-123456789012', kind: 'create', title: 'Original retained title' };
  assert.equal((await client.submit(creation)).status, 'unknown'); await client.submit(creation); assert.equal(dispatches, 1);
  const pending = await client.pending(); assert.equal(pending.items[0].title, creation.title);
  assert.ok(!JSON.stringify(pending).includes('terminal')); assert.equal((await client.operation(creation.operationId)).status, 'unknown');
  await client.recoverCreate(creation.operationId); assert.equal(recoveries, 1); assert.equal(dispatches, 1);
  const record = store.get(creation.operationId); store.completeCreate({ operationId: creation.operationId, conversationId: 'conv-1', operationTag: record.operationTag });
  const sending = { operationId: '22345678-1234-4234-8234-123456789012', kind: 'send', conversationId: 'conv-1', text: '\u0001'.repeat(16384) };
  assert.ok(Buffer.byteLength(JSON.stringify(sending)) > 65536);
  assert.equal((await client.submit(sending)).text, sending.text); assert.equal(dispatches, 2);
  const preview = await client.previewContext(); assert.equal(preview.items[0].epistemicState, 'unknown'); assert.ok(!JSON.stringify(preview).includes('CANARY'));
  for (const [route, input] of [['submit', { ...sending, model: 'forbidden' }], ['submit', { ...sending, text: 'x'.repeat(16385) }],
    ['submit', { ...sending, context: { revision: 0, digest: 'a'.repeat(64), items: [], system: 'forbidden' } }],
    ['operation', { operationId: sending.operationId, agentId: 'foreign' }], ['pending', { path: 'forbidden' }],
    ['context-preview', { query: 'x'.repeat(4097) }], ['recover-create', { operationId: 'bad' }]]) {
    assert.ok((await request(host, `/api/local/${route}`, { body: JSON.stringify(input) })).status >= 400);
  }
  for (const route of ['submit', 'operation', 'pending', 'recover-create', 'context-preview']) {
    assert.equal((await request(host, `/api/local/${route}`, { method: 'GET', body: '' })).status, 403);
    assert.equal((await request(host, `/api/local/${route}`, { headers: { Origin: 'http://foreign.invalid' } })).status, 403);
  }
  assert.equal(dispatches, 2);
});

test('HTTP response loss after synchronous reservation never cancels or redispatches chat', async t => {
  const config = await fixture(t); const fake = fakeSession();
  const store = openChatOperationStore({ directory: config.protectedRoot, agentId: 'agent-synthetic' });
  let req; let submissions = 0; let dispatches = 0; const entered = deferred();
  fake.session.chat = { submit(value) { submissions++; const reserved = store.reserve(value); if (reserved.dispatchAllowed) dispatches++;
    req.destroy(); entered.resolve(); return reserved.record; }, get: id => store.get(id), listPending: () => store.listPending() };
  const host = await startLocalReadHost({ ...config, chat: { providerPort: 12345, model: 'lmstudio/synthetic' } }, {}, { capability, makeSession: () => fake.session });
  t.after(async () => { await host.close(); store.close(); });
  const value = { operationId: '32345678-1234-4234-8234-123456789012', kind: 'create', title: 'kept' };
  const url = new URL(host.origin);
  req = httpRequest({ hostname: '127.0.0.1', port: url.port, path: '/api/local/submit', method: 'POST',
    headers: { Origin: host.origin, Authorization: `Bearer ${capability}`, 'Content-Type': 'application/json' } });
  req.on('error', () => {}); req.end(JSON.stringify(value)); await entered.promise; await tick();
  assert.equal(store.get(value.operationId).status, 'unknown'); assert.equal(fake.closes, 0);
  const result = await request(host, '/api/local/operation', { body: JSON.stringify({ operationId: value.operationId }) });
  assert.equal(JSON.parse(result.text).data.title, value.title); assert.equal(submissions, 1); assert.equal(dispatches, 1);
});

test('auth, exact Origin/Host, duplicate headers, cookies, queries and OPTIONS never reach session reads', async t => {
  const { host, fake } = await hostFixture(t);
  for (const headers of [{ Authorization: 'Bearer wrong' }, { Origin: 'http://evil.invalid' },
    { Host: 'localhost:1' }, { Cookie: 'capability=synthetic' }, { Origin: '' }, { Authorization: '' }]) {
    const result = await request(host, '/api/local/conversations', { headers }); assert.equal(result.status, 403);
  }
  for (const name of ['Host', 'Origin', 'Authorization']) {
    const standard = { Host: new URL(host.origin).host, Origin: host.origin, Authorization: `Bearer ${capability}`, 'Content-Type': 'application/json' };
    const rawHeaders = Object.entries(standard).flat(); rawHeaders.push(name, standard[name]);
    const result = await request(host, '/api/local/conversations', { rawHeaders }).catch(() => null);
    assert.ok(result === null || result.status >= 400);
  }
  for (const [pathname, method] of [['/api/local/status', 'OPTIONS'], ['/api/local/status?capability=synthetic', 'POST'], ['/api/local/unknown', 'POST']]) {
    const result = await request(host, pathname, { method }); assert.ok(result.status >= 400); assert.equal(result.headers['access-control-allow-origin'], undefined);
  }
  assert.equal(fake.calls.length, 0);
});

test('malformed/extra input and body bounds fail closed; response errors remain static', async t => {
  const { host, fake } = await hostFixture(t);
  for (const body of ['{bad', '{"agentId":"spoof"}', '[]', '{"search":42}', JSON.stringify({ search: 'x'.repeat(4097) })]) {
    const result = await request(host, '/api/local/conversations', { body }).catch(() => null);
    assert.ok(result === null || result.status >= 400);
  }
  assert.equal(fake.calls.length, 0);
  const untrusted = await hostFixture(t, { list: () => { throw new Error('PRIVATE_UPSTREAM_ROOT_TOKEN'); } });
  const result = await request(untrusted.host, '/api/local/conversations'); assert.equal(result.status, 400);
  assert.ok(!result.text.includes('PRIVATE')); assert.equal(JSON.parse(result.text).ok, false);
});

test('static index and required assets only, no maps/private/traversal/link or API fallback', async t => {
  const { host, config } = await hostFixture(t);
  const get = pathname => request(host, pathname, { method: 'GET', body: '' });
  assert.equal((await get('/?local=1')).status, 200); assert.equal((await get('/_expo/static/app.js')).status, 200);
  await fs.symlink(path.join(config.webRoot, '_expo/static/app.js'), path.join(config.webRoot, '_expo/static/link.js'));
  for (const pathname of ['/metadata.json', '/.env', '/_expo/static/../index.html', '/_expo/static/%2e%2e/index.html',
    '/_expo/static/app.js.map', '/_expo/static/link.js', '/api/private', '/?token=x']) assert.ok((await get(pathname)).status >= 400);
  await assert.rejects(startLocalReadHost({ ...config, webRoot: config.stateRoot }, {}, { makeSession: () => { throw new Error('not reached'); } }), { code: 'START_FAILED' });
});

test('disconnect aborts only its read; four pending requests bound work; timeout and shutdown revoke', async t => {
  const entered = deferred(); const signals = []; const gates = [];
  const { host, fake } = await hostFixture(t, { list(_input, { signal }) {
    signals.push(signal); const gate = deferred(); gates.push(gate); entered.resolve(); return gate.promise;
  } }, { requestMs: 80 });
  const readings = Array.from({ length: 4 }, () => request(host, '/api/local/conversations').catch(() => null));
  await entered.promise; await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal((await request(host)).status, 429);
  await Promise.all(readings); assert.ok(signals.every(signal => signal.aborted)); assert.equal(fake.closes, 0);
  assert.equal(signals.length, 1); // Canceled queued deliveries never dispatch.
  const queuedAgain = request(host, '/api/local/conversations').catch(() => null);
  await queuedAgain; assert.equal(signals.length, 1); // Hung active work cannot grow dispatches.
  assert.equal((await request(host)).status, 200);
  const result = await host.close(); assert.equal(result.confirmed, true); for (const gate of gates) gate.resolve({ items: [], cursor: null });
});

test('startup cancellation waits for late bind and uncertain managed cleanup remains explicit', async t => {
  const config = await fixture(t); const fake = fakeSession(); const entered = deferred(); const gate = deferred(); const abort = new AbortController();
  let address; let finished = false;
  const opening = startLocalReadHost(config, { signal: abort.signal }, { capability, makeSession: () => fake.session,
    listen: async server => { entered.resolve(); await gate.promise;
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); address = `http://127.0.0.1:${server.address().port}`;
    } });
  const rejected = assert.rejects(opening, { code: 'START_FAILED' }).then(() => { finished = true; });
  await entered.promise; abort.abort(); await tick(); assert.equal(finished, false); gate.resolve(); await rejected;
  await assert.rejects(request({ origin: address })); assert.equal(fake.closes, 1);
  const bad = await hostFixture(t, { unclean: true }); assert.equal((await bad.host.close()).confirmed, false);
});

test('actual disconnected browser cancels only delivery, and oversized projected responses fail bounded', async t => {
  const entered = deferred(); let readSignal; const gate = deferred();
  const { host, fake } = await hostFixture(t, { list(_input, { signal }) { readSignal = signal; entered.resolve(); return gate.promise; } });
  const url = new URL(host.origin);
  const req = httpRequest({ hostname: '127.0.0.1', port: url.port, path: '/api/local/conversations', method: 'POST',
    headers: { Origin: host.origin, Authorization: `Bearer ${capability}`, 'Content-Type': 'application/json' } });
  req.on('error', () => {}); req.end('{}'); await entered.promise; req.destroy();
  await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(readSignal.aborted, true); assert.equal(fake.closes, 0);
  gate.resolve({ items: [], cursor: null }); await tick(); assert.equal((await request(host)).status, 200);
  const big = await hostFixture(t); big.fake.session.listMessages = async () => ({
    items: Array.from({ length: 20 }, (_, index) => ({ id: `message-${index}`, role: 'assistant', content: '界'.repeat(65536), date: null })),
    cursor: null, omittedAttachments: false,
  });
  const result = await request(big.host, '/api/local/messages', { body: '{"conversationId":"conv-1"}' });
  assert.equal(result.status, 400); assert.deepEqual(JSON.parse(result.text), { ok: false, error: 'RESPONSE_LIMIT' });
});

test('passive session termination closes HTTP without a subsequent browser request', async t => {
  const { host, fake } = await hostFixture(t); fake.fail();
  assert.equal((await host.terminal).httpClosed, true); await assert.rejects(request(host));
});

test('rapid history selection waits boundedly for canceled real-reader delivery without replay', async t => {
  const slow = deferred(); const entered = deferred(); const reads = [];
  const reader = createConversationReader({ async request(type, fields) {
    if (type === 'agent_list') return { success: true, agents: [{ id: 'agent-synthetic', tags: ['personal-co-v1'] }] };
    if (type === 'conversation_retrieve') return { success: true, conversation: {
      id: fields.conversation_id, agent_id: 'agent-synthetic', tags: ['personal-co-retained-v1'],
    } };
    reads.push(fields.conversation_id);
    if (fields.conversation_id === 'conv-slow') { entered.resolve(); await slow.promise; }
    return { success: true, messages: [], next_before: null, has_more: false };
  } }, { agentId: 'agent-synthetic', retainedOnly: true });
  const { host, fake } = await hostFixture(t); fake.session.listMessages = (...args) => reader.listMessages(...args);
  const url = new URL(host.origin);
  const old = httpRequest({ hostname: '127.0.0.1', port: url.port, path: '/api/local/messages', method: 'POST',
    headers: { Origin: host.origin, Authorization: `Bearer ${capability}`, 'Content-Type': 'application/json' } });
  old.on('error', () => {}); old.end('{"conversationId":"conv-slow"}'); await entered.promise;
  const latest = request(host, '/api/local/messages', { body: '{"conversationId":"conv-fast"}' });
  await new Promise(resolve => setTimeout(resolve, 20)); old.destroy();
  try {
    const result = await latest; assert.equal(result.status, 200); assert.deepEqual(JSON.parse(result.text).data.items, []);
    assert.deepEqual(reads, ['conv-slow', 'conv-fast']); assert.equal(fake.closes, 0);
  } finally { slow.resolve(); reader.close(); }
});

// Source+compiled bytes, not an authentication mechanism or proof of review.
const reviewFiles = ['../server/local-read-host.mjs', '../server/local-read-cli.mjs', './local-read-host.test.mjs',
  '../server/conversation-reader.mjs', './conversation-reader.test.mjs', '../server/managed-read-session.mjs', './managed-read-session.test.mjs',
  '../src/services/local-read-client.mjs', '../src/components/LocalAssistant.tsx', './local-read-client.test.mjs', '../App.tsx', '../README.md',
  '../server/assistant-bootstrap.mjs', '../server/authenticated-app-server.mjs', '../server/runtime-process.mjs', '../server/runtime-sandbox.mjs',
  '../server/canonical-memory-store.mjs', '../src/domain/app-server-memory-codec.mjs', '../src/domain/memory.mjs', '../src/domain/policy.mjs',
  '../server/package.json', '../server/package-lock.json', '../package.json', '../package-lock.json', '../index.ts', '../tsconfig.json'];
async function reviewedDigest(webRoot) {
  const hash = createHash('sha256');
  for (const file of reviewFiles) hash.update(await fs.readFile(new URL(file, import.meta.url)));
  const index = await fs.readFile(path.join(webRoot, 'index.html'));
  hash.update(index);
  const scripts = [...index.toString().matchAll(/src="(\/_expo\/static\/js\/web\/[A-Za-z0-9_.-]+\.js)"/g)].map(match => match[1]).sort();
  assert.equal(scripts.length, 1, 'Expected reviewed Expo bundle.');
  for (const file of scripts) hash.update(await fs.readFile(path.join(webRoot, file)));
  return hash.digest('hex');
}
test('native local browser host status and empty retained list (opt-in after frozen security review)', {
  skip: process.env.WP0049_RUN_NATIVE !== '1', timeout: 90000,
}, async t => {
  const webRoot = await fs.realpath(process.env.WP0049_WEB_ROOT ?? new URL('../dist', import.meta.url).pathname);
  assert.equal(process.platform, 'darwin'); assert.equal(process.env.WP0049_REVIEWED_SHA256, await reviewedDigest(webRoot));
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0049-native-'));
  const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
  await fs.mkdir(stateRoot, { mode: 0o700 }); await fs.mkdir(protectedRoot, { mode: 0o700 });
  const abort = new AbortController(); const cancel = () => abort.abort(); const events = [];
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel); t.signal.addEventListener('abort', cancel, { once: true });
  let host;
  try {
    host = await startLocalReadHost({ dependencyRoot: process.env.WP0049_DEPENDENCY_ROOT ?? '/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules',
      stateRoot, protectedRoot, webRoot }, { signal: abort.signal }, { observe: event => events.push(event) });
    const bearer = new URL(host.launchUrl).hash.slice('#capability='.length);
    const headers = { Authorization: `Bearer ${bearer}` };
    const status = await request(host, '/api/local/status', { headers }); assert.equal(status.status, 200);
    const list = await request(host, '/api/local/conversations', { headers }); assert.equal(list.status, 200);
    assert.deepEqual(JSON.parse(list.text).data.items, []);
    assert.equal((await request(host, '/api/local/status', { headers: { Authorization: 'Bearer wrong' } })).status, 403);
    const cleanup = await host.close(); assert.equal(cleanup.confirmed, true);
    t.diagnostic(JSON.stringify({ schema: 'wp0049-native-read-host-v1', root, webRoot, pin: RUNTIME_PIN, agentId: host.agentId,
      origin: host.origin, reviewedSourceSha256: await reviewedDigest(webRoot), events, cleanup }));
  } finally {
    const cleanup = await host?.close(); process.off('SIGINT', cancel); process.off('SIGTERM', cancel); t.signal.removeEventListener('abort', cancel);
    if (cleanup) assert.equal(cleanup.confirmed, true);
  }
});
