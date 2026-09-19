import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID, createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createManagedReadSession, initializeManagedReadSession } from '../server/managed-read-session.mjs';
import { createAuthenticatedAppServer } from '../server/authenticated-app-server.mjs';
import { startOwned, validateEndpoint, listenerGone } from '../server/runtime-process.mjs';
import { RUNTIME_PIN } from '../server/runtime-sandbox.mjs';

const { WebSocketServer } = createRequire(new URL('../server/package.json', import.meta.url))('ws');
const endpoint = 'ws://127.0.0.1:50234/ws';
const TAG = 'personal-co-v1';
const agentId = 'agent-synthetic-existing';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const config = () => ({ dependencyRoot: '/private/tmp/wp0047-test-install/node_modules',
  stateRoot: `/private/tmp/wp0047-test-${randomUUID()}/state`, protectedRoot: `/private/tmp/wp0047-test-${randomUUID()}/protected`, agentId });
const spec = roots => ({ command: '/usr/bin/sandbox-exec', args: ['-p', '(deny default)'],
  options: { cwd: roots.stateRoot, env: {}, stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: true } });
const code = expected => failure => {
  assert.equal(failure.message, 'Managed read session failed.'); assert.equal(failure.code, expected);
  assert.equal(failure.cause, undefined); return true;
};
function controlledProcess(options = {}) {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
  child.pid = options.noPid ? undefined : 987123;
  let alive = true; let starts = 0; const signals = [];
  const close = () => { alive = false; child.emit('close', 0, null); };
  const log = value => child.stdout.emit('data', Buffer.from(value));
  const start = launch => {
    starts++;
    return startOwned(launch, { startupMs: 20, stopMs: 5, maxLogBytes: 512,
      spawnImpl(command, args, spawnOptions) {
        assert.equal(command, '/usr/bin/sandbox-exec'); assert.equal(spawnOptions.shell, false);
        assert.equal(spawnOptions.detached, true); assert.deepEqual(args, launch.args);
        queueMicrotask(() => {
          if (options.childError) { child.emit('error', new Error('PRIVATE_PROCESS_ERROR')); if (!options.noClose) close(); }
          else if (options.log !== undefined) log(options.log);
          else log(`Listening on ws://127.0.0.1:50234\nWebSocket: ${endpoint}\n`);
        });
        return child;
      },
      signalGroup(pid, signal) {
        assert.equal(pid, -987123); signals.push(signal);
        if (options.stopFailure) throw Object.assign(new Error('PRIVATE_SIGNAL_FAILURE'), { code: 'EACCES' });
        if (!alive) throw Object.assign(new Error('gone'), { code: 'ESRCH' });
        if (signal === 'SIGKILL' || (signal === 'SIGTERM' && !options.ignoreTerm)) close();
      },
    });
  };
  return { child, close, log, start, signals, get starts() { return starts; } };
}
function authFixture(behavior = {}) {
  const closure = deferred(); const calls = []; let disposals = 0; let clientCloses = 0;
  let socketClosed = false;
  const client = {
    closed: closure.promise,
    async close() { clientCloses++; socketClosed = true; closure.resolve(behavior.cleanupFailure ? false : true); },
    async request(type, fields, options) {
      calls.push({ type, fields });
      if (socketClosed) throw new Error('PRIVATE_CLOSED');
      if (behavior.request) { const result = await behavior.request(type, fields, options); if (result !== undefined) return result; }
      if (type === 'agent_list') return { success: true, agents: behavior.agents ?? [{ id: agentId, tags: [TAG] }] };
      if (type === 'conversation_list') return { success: true, conversations: [{ id: 'conv-1', agent_id: agentId, summary: '中文', tags: [] }] };
      if (type === 'conversation_retrieve') return { success: true, conversation: { id: fields.conversation_id, agent_id: agentId } };
      if (type === 'conversation_messages_list') return { success: true, messages: [], next_before: null, has_more: false };
      throw new Error('unexpected_command');
    },
  };
  const makeAuth = async roots => {
    if (behavior.validationFailure) throw new Error('PRIVATE_VALIDATION');
    if (behavior.factoryGate) await behavior.factoryGate.promise;
    return { launchSpec: spec(roots),
      async connect(value, options) {
        assert.equal(value, endpoint);
        if (behavior.connectFailure) throw new Error('PRIVATE_AUTH_ERROR');
        if (behavior.connectGate) await behavior.connectGate.promise;
        return client;
      },
      async dispose() { disposals++; await client.close(); if (behavior.cleanupFailure) throw new Error('PRIVATE_DISPOSE'); },
    };
  };
  return { makeAuth, client, calls, get disposals() { return disposals; }, get clientCloses() { return clientCloses; } };
}
function sessionFixture(behavior = {}, processOptions = {}, suppliedConfig = config(), managerOptions = {}) {
  const auth = authFixture(behavior); const process = controlledProcess(processOptions); const events = [];
  const session = createManagedReadSession(suppliedConfig, managerOptions, { makeAuth: auth.makeAuth,
    start: process.start, checkListenerGone: async value => { assert.equal(value, endpoint); return true; },
    startupMs: 100, cleanupMs: 100, observe: value => events.push(value) });
  return { auth, process, events, session, config: suppliedConfig };
}

test('managed ready/read/close composes ownership and exposes only bounded sanitized handles', async () => {
  const f = sessionFixture();
  assert.equal(f.session.status().phase, 'starting');
  await assert.rejects(f.session.listConversations(), code('NOT_READY'));
  assert.equal(await f.session.ready, undefined); assert.equal(f.session.status().phase, 'ready');
  assert.deepEqual(Object.keys(f.session).sort(), ['close', 'listConversations', 'listMessages', 'ready', 'status', 'terminal']);
  assert.ok(!JSON.stringify(f.session).includes('PRIVATE'));
  assert.equal((await f.session.listConversations()).items[0].summary, '中文');
  assert.deepEqual((await f.session.listMessages('conv-1')).items, []);
  const closing = f.session.close(); assert.equal(closing, f.session.close());
  assert.equal(f.session.status().phase, 'closing');
  const terminal = await closing;
  assert.equal(terminal, await f.session.terminal); assert.equal(terminal.cleanup.confirmed, true);
  assert.equal(terminal.cleanup.listenerGone, true); assert.equal(terminal.phase, 'closed');
  assert.ok(f.process.signals.includes('SIGTERM')); assert.ok(f.auth.disposals >= 1);
  await assert.rejects(f.session.listMessages('conv-1'), code('NOT_READY'));
  const again = sessionFixture({}, {}, f.config); await again.session.ready; await again.session.close();
});

test('roots-only initialization shares lifecycle, returns identity only, and closes preparation', async () => {
  const { agentId: ignored, ...roots } = config(); const auth = authFixture(); const child = controlledProcess();
  let closed = 0; let resolved = 0;
  const session = initializeManagedReadSession(roots, {}, { makeAuth: auth.makeAuth, start: child.start,
    checkListenerGone: async () => true, prepare: async captured => {
      assert.deepEqual(captured, roots); assert.equal(child.starts, 0);
      return { async resolve(client) { assert.equal(client, auth.client); resolved++; return { agentId }; }, async close() { closed++; } };
    } });
  assert.deepEqual(await session.ready, { agentId }); assert.equal(resolved, 1);
  assert.deepEqual(Object.keys(session).sort(), ['close', 'listConversations', 'listMessages', 'ready', 'status', 'terminal']);
  assert.equal((await session.close()).cleanup.confirmed, true); assert.equal(closed, 1);
  assert.throws(() => initializeManagedReadSession(config()), code('INVALID_CONFIG'));
});

test('late preparation, preparation rejection with retained lock, and close failure preserve cleanup truth', async () => {
  for (const kind of ['late', 'reject-unclean', 'close-unclean', 'unsettled']) {
    const { agentId: ignored, ...roots } = config(); const auth = authFixture(); const child = controlledProcess();
    const gate = deferred(); let closed = 0;
    const session = initializeManagedReadSession(roots, {}, { makeAuth: auth.makeAuth, start: child.start,
      checkListenerGone: async () => true, cleanupMs: 100, prepare: async () => {
        if (kind === 'late' || kind === 'unsettled') await gate.promise;
        if (kind === 'reject-unclean') throw Object.assign(new Error('PRIVATE_LOCK'), { code: 'CLEANUP_FAILED' });
        return { async resolve() { return { agentId }; }, async close() { closed++; if (kind === 'close-unclean') throw new Error('PRIVATE_CLOSE'); } };
      } });
    if (kind === 'close-unclean') await session.ready;
    else await tick();
    const closing = session.close(); if (kind === 'late') gate.resolve();
    const result = await closing; assert.equal(result.cleanup.confirmed, kind === 'late');
    if (kind !== 'close-unclean') assert.equal(child.starts, 0);
    if (kind !== 'late') assert.throws(() => initializeManagedReadSession(roots), code('STATE_IN_USE'));
    if (kind === 'unsettled') { gate.resolve(); await tick(); }
    if (kind !== 'reject-unclean') assert.ok(closed >= 1);
  }
});

test('bootstrap resolution after cleanup deadline still closes preparation without readiness or lease release', async () => {
  const { agentId: ignored, ...roots } = config(); const auth = authFixture(); const child = controlledProcess();
  const gate = deferred(); const entered = deferred(); let closed = 0;
  const session = initializeManagedReadSession(roots, {}, { makeAuth: auth.makeAuth, start: child.start,
    checkListenerGone: async () => true, cleanupMs: 20, prepare: async () => ({
      async resolve() { entered.resolve(); await gate.promise; return { agentId }; }, async close() { closed++; },
    }) });
  await entered.promise; const result = await session.close(); assert.equal(result.cleanup.confirmed, false);
  assert.equal(closed, 0); gate.resolve(); await tick(); assert.equal(closed, 1);
  assert.throws(() => initializeManagedReadSession(roots), code('STATE_IN_USE'));
  assert.equal(session.status().phase, 'failed'); await assert.rejects(session.ready, code('CLOSED'));
});

test('managed initialization with real bootstrap files reopens one identity without manual provisioning', async t => {
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0048-managed-'));
  const roots = { dependencyRoot: '/private/tmp/wp0047-test-install/node_modules',
    stateRoot: path.join(root, 'state'), protectedRoot: path.join(root, 'protected') };
  await fs.mkdir(roots.stateRoot, { mode: 0o700 }); await fs.mkdir(roots.protectedRoot, { mode: 0o700 });
  let agents = []; let creations = 0; let bytes;
  for (let run = 0; run < 2; run++) {
    const auth = authFixture({ request: async type => {
      if (type === 'agent_list') return { success: true, agents };
      if (type === 'agent_retrieve') return { success: true, agent: agents[0] };
      if (type === 'conversation_list') return { success: true, conversations: [] };
    } });
    auth.client.createAssistantAgent = async marker => {
      creations++; agents = [{ id: agentId, tags: [TAG, marker, 'native-memfs'] }];
      return { success: true, agent: agents[0] };
    };
    const child = controlledProcess();
    const session = initializeManagedReadSession(roots, {}, { makeAuth: auth.makeAuth,
      start: child.start, checkListenerGone: async () => true });
    try {
      assert.deepEqual(await session.ready, { agentId }); assert.deepEqual((await session.listConversations()).items, []);
      const current = await fs.readFile(path.join(roots.protectedRoot, 'canonical-memory.json'));
      if (run === 0) bytes = current; else assert.deepEqual(current, bytes);
    } finally { assert.equal((await session.close()).cleanup.confirmed, true); }
  }
  assert.equal(creations, 1); t.diagnostic(`Retained synthetic fixture: ${root}`);
});

test('stateRoot lease rejects duplicates and input authority is captured before awaits', async () => {
  const initial = config(); const original = { ...initial }; const gate = deferred(); const auth = authFixture({ factoryGate: gate });
  let captured; const process = controlledProcess();
  const session = createManagedReadSession(initial, {}, { makeAuth: roots => { captured = roots; return auth.makeAuth(roots); },
    start: process.start, checkListenerGone: async () => true, startupMs: 100, cleanupMs: 100 });
  initial.agentId = 'agent-other'; initial.stateRoot = '/private/tmp/changed/state';
  assert.throws(() => createManagedReadSession(original), code('STATE_IN_USE'));
  await tick(); assert.ok(Object.isFrozen(captured)); assert.equal(captured.stateRoot, original.stateRoot);
  gate.resolve(); await session.ready; await session.close();
  let getter = false;
  assert.throws(() => createManagedReadSession({ ...config(), get agentId() { getter = true; return agentId; } }), code('INVALID_CONFIG'));
  assert.equal(getter, false);
});

test('validation failure, auth failure and missing/wrong/duplicate Agent never become ready and clean owned resources', async () => {
  for (const behavior of [{ validationFailure: true }, { connectFailure: true }, { agents: [] },
    { agents: [{ id: 'agent-other', tags: [TAG] }] }, { agents: [{ id: agentId, tags: [] }] },
    { agents: [{ id: agentId, tags: [TAG] }, { id: 'agent-other', tags: [TAG] }] }]) {
    const f = sessionFixture(behavior);
    await assert.rejects(f.session.ready, code(behavior.validationFailure || behavior.connectFailure ? 'STARTUP_FAILED' : 'AGENT_MISMATCH'));
    const result = await f.session.terminal; assert.equal(result.cleanup.confirmed, true);
    assert.equal(f.process.starts, behavior.validationFailure ? 0 : 1);
    assert.ok(!JSON.stringify(result).includes('PRIVATE'));
  }
});

test('startup timeout, process error and bad endpoint trigger terminal cleanup', async () => {
  for (const options of [{ log: '' }, { childError: true }, { log: 'Listening on ws://wrong.invalid:1\n' }]) {
    const f = sessionFixture({}, options);
    await assert.rejects(f.session.ready);
    assert.equal((await f.session.terminal).cleanup.confirmed, true);
    assert.equal(f.session.status().phase, 'closed');
  }
});

test('no-PID error is never signalled and incomplete reaping retains lease', async () => {
  for (const noClose of [false, true]) {
    const f = sessionFixture({}, { childError: true, noPid: true, noClose });
    await assert.rejects(f.session.ready); const terminal = await f.session.terminal;
    assert.deepEqual(f.process.signals, []);
    assert.equal(terminal.cleanup.confirmed, !noClose);
    if (noClose) assert.throws(() => createManagedReadSession(f.config), code('STATE_IN_USE'));
  }
});

test('post-ready spontaneous child exit, child error, log overflow and invalid announcements invalidate idle sessions', async () => {
  for (const trigger of [f => f.process.close(), f => f.process.child.emit('error', new Error('PRIVATE')),
    f => f.process.log('x'.repeat(513)), f => f.process.log(`WebSocket: ${endpoint}\n`),
    f => f.process.log('Listening on ws://127.0.0.1:12345\n')]) {
    const f = sessionFixture(); await f.session.ready; trigger(f);
    const result = await f.session.terminal;
    assert.equal(result.cleanup.confirmed, true); assert.ok(['PROCESS_FAILED', 'PROCESS_EXITED'].includes(result.reason));
    await assert.rejects(f.session.listConversations(), code('NOT_READY'));
  }
});

test('idle socket closure and lifetime abort clean session; per-read abort leaves it ready', async () => {
  const socket = sessionFixture(); await socket.session.ready; await socket.auth.client.close();
  assert.equal((await socket.session.terminal).reason, 'SOCKET_CLOSED');
  const lifetime = new AbortController(); const owned = sessionFixture({}, {}, config(), { signal: lifetime.signal });
  await owned.session.ready; lifetime.abort(); assert.equal((await owned.session.terminal).reason, 'ABORTED');
  const gate = deferred(); let blocked = true;
  const f = sessionFixture({ request: async type => { if (type === 'conversation_list' && blocked) await gate.promise; } });
  await f.session.ready; const abort = new AbortController();
  const reading = f.session.listConversations({}, { signal: abort.signal }); await tick(); abort.abort();
  await assert.rejects(reading, code('READ_ABORTED')); assert.equal(f.session.status().phase, 'ready');
  blocked = false; gate.resolve(); await tick(); assert.equal((await f.session.listConversations()).items.length, 1);
  await f.session.close();
});

test('terminal transition promptly suppresses a pending read', async () => {
  const gate = deferred(); const f = sessionFixture({ request: async type => { if (type === 'conversation_list') await gate.promise; } });
  await f.session.ready;
  const reading = f.session.listConversations(); await tick(); const closed = f.session.close();
  await assert.rejects(reading, code('NOT_READY')); gate.resolve();
  assert.equal((await closed).cleanup.confirmed, true);
});

test('abort before startup and close before awaiting ready have internally observed readiness rejection', async () => {
  const abort = new AbortController(); abort.abort();
  const f = sessionFixture({}, {}, config(), { signal: abort.signal });
  const terminal = await f.session.terminal; assert.equal(terminal.reason, 'ABORTED'); assert.equal(f.process.starts, 0);
  await assert.rejects(f.session.ready, code('ABORTED'));
  const immediate = sessionFixture(); await immediate.session.close(); await tick();
  await assert.rejects(immediate.session.ready, code('CLOSED')); assert.equal(immediate.process.starts, 0);
});

test('late factory and connection completions remain terminal and are disposed before lease release', async () => {
  for (const kind of ['factoryGate', 'connectGate']) {
    const gate = deferred(); const f = sessionFixture({ [kind]: gate });
    await tick(); const closed = f.session.close();
    assert.throws(() => createManagedReadSession(f.config), code('STATE_IN_USE'));
    gate.resolve(); const terminal = await closed;
    assert.equal(terminal.cleanup.confirmed, true); assert.equal(f.process.starts, kind === 'factoryGate' ? 0 : 1);
    assert.ok(f.auth.clientCloses >= 1); assert.equal(f.session.status().phase, 'closed');
    const again = sessionFixture({}, {}, f.config); await again.session.ready; await again.session.close();
  }
});

test('unsettled startup and uncertain auth/process/listener cleanup are bounded and retain leases', async () => {
  const gate = deferred(); const f = sessionFixture({ factoryGate: gate }); await tick();
  const started = performance.now();
  const terminal = await f.session.close(); assert.equal(terminal.phase, 'failed'); assert.ok(terminal.errors.includes('STARTUP_UNSETTLED'));
  assert.ok(performance.now() - started >= 80); assert.ok(performance.now() - started < 1000);
  assert.throws(() => createManagedReadSession(f.config), code('STATE_IN_USE'));
  gate.resolve(); await tick(); assert.equal(f.process.starts, 0); assert.ok(f.auth.disposals > 0);
  for (const [behavior, processOptions] of [[{ cleanupFailure: true }, {}], [{}, { stopFailure: true }]]) {
    const bad = sessionFixture(behavior, processOptions); await bad.session.ready;
    assert.equal((await bad.session.close()).cleanup.confirmed, false);
    assert.throws(() => createManagedReadSession(bad.config), code('STATE_IN_USE'));
  }
  const roots = config(); const auth = authFixture(); const process = controlledProcess();
  const listener = createManagedReadSession(roots, {}, { makeAuth: auth.makeAuth, start: process.start,
    checkListenerGone: async () => { throw new Error('PRIVATE_LISTENER_ERROR'); }, startupMs: 100, cleanupMs: 100 });
  await listener.ready; assert.equal((await listener.close()).cleanup.confirmed, false);
  assert.throws(() => createManagedReadSession(roots), code('STATE_IN_USE'));
});

test('helper passive failure is sanitized without endpoint polling and successful output remains compatible', async () => {
  const controlled = controlledProcess(); const child = controlled.start(spec(config()));
  await child.endpoint(); controlled.log(`WebSocket: ${endpoint}\n`);
  assert.deepEqual(await child.failed, { code: 'invalid_child_output' }); await child.stop();
  const complete = controlledProcess({ log: 'synthetic output\n' }); const once = complete.start(spec(config()));
  await tick(); complete.close(); assert.equal(await once.output(), 'synthetic output\n'); await once.stop();
});

test('real authenticated loopback ws and reader compose with controlled owned process through full ready/read/close', async t => {
  const server = createServer(); const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => wss.handleUpgrade(request, socket, head, peer => wss.emit('connection', peer)));
  wss.on('connection', peer => peer.on('message', bytes => {
    const request = JSON.parse(bytes.toString());
    const value = request.type === 'app_server_info' ? { backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
      capabilities: { agent_management: true, conversation_management: true, memory_management: true, runtime_start: true, split_channels: false } }
      : request.type === 'agent_list' ? { agents: [{ id: agentId, tags: [TAG] }] }
        : { conversations: [{ id: 'conv-1', agent_id: agentId, summary: '真实本地 WebSocket 合成数据' }] };
    peer.send(JSON.stringify({ type: `${request.type}_response`, request_id: request.request_id, success: true, ...value }));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = `ws://127.0.0.1:${server.address().port}/ws`;
  const process = controlledProcess({ log: `Listening on ${address.slice(0, -3)}\nWebSocket: ${address}\n` });
  let serverClosed = false;
  const session = createManagedReadSession(config(), {}, {
    makeAuth: roots => createAuthenticatedAppServer(roots, { makeSandbox: async () => spec(roots) }),
    start: launch => {
      const owned = process.start(launch);
      return { ...owned, stop: async () => {
        const result = await owned.stop();
        if (!serverClosed) { serverClosed = true; await new Promise(resolve => server.close(resolve)); }
        return result;
      } };
    },
  });
  try {
    await session.ready; assert.equal((await session.listConversations()).items[0].id, 'conv-1');
    assert.equal((await session.close()).cleanup.listenerGone, true);
    t.diagnostic('Real ws/auth/reader; process spawning/signalling controlled, no upstream runtime.');
  } finally {
    await session.close(); for (const peer of wss.clients) peer.terminate();
    await new Promise(resolve => wss.close(resolve)); if (!serverClosed) await new Promise(resolve => server.close(resolve));
  }
});

// Review attestation/change detection only, not authentication or proof of review.
const reviewFiles = ['../server/runtime-process.mjs', '../server/managed-read-session.mjs', './managed-read-session.test.mjs',
  '../server/authenticated-app-server.mjs', './authenticated-app-server.test.mjs', '../../scripts/probe_runtime_confinement.mjs',
  '../server/runtime-sandbox.mjs', '../server/conversation-reader.mjs', '../server/package.json', '../server/package-lock.json',
  '../server/assistant-bootstrap.mjs', '../server/canonical-memory-store.mjs', '../src/domain/app-server-memory-codec.mjs',
  '../src/domain/memory.mjs', '../src/domain/policy.mjs'];
async function reviewDigest() {
  const digest = createHash('sha256');
  for (const file of reviewFiles) digest.update(await fs.readFile(new URL(file, import.meta.url)));
  return digest.digest('hex');
}
test('native managed missing-Agent cleanup (opt-in after independent frozen-source security PASS)', {
  skip: process.env.WP0047_RUN_NATIVE !== '1', timeout: 60000,
}, async t => {
  assert.equal(process.platform, 'darwin');
  assert.ok(process.env.WP0047_REVIEWED_SHA256 === await reviewDigest(), 'Native review digest missing or changed.');
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0047-'));
  const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
  await fs.mkdir(stateRoot, { mode: 0o700 }); await fs.mkdir(protectedRoot, { mode: 0o700 });
  const events = []; const controller = new AbortController(); const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel); t.signal.addEventListener('abort', cancel, { once: true });
  const session = createManagedReadSession({ dependencyRoot: '/private/tmp/personal-co-wp0041.qRnOrc/node_modules',
    stateRoot, protectedRoot, agentId: 'agent-wp0047-does-not-exist' }, { signal: controller.signal }, { observe: event => events.push(event) });
  try {
    await assert.rejects(session.ready, code('AGENT_MISMATCH'));
    const result = await session.terminal;
    assert.equal(result.cleanup.confirmed, true); assert.equal(result.cleanup.listenerGone, true);
    assert.ok(events.some(event => event.type === 'spawned' && Number.isInteger(event.pid)));
    assert.ok(!events.some(event => event.type === 'ready'));
    t.diagnostic(JSON.stringify({ schema: 'wp0047-native-missing-agent-v1', root, pin: RUNTIME_PIN,
      reviewedSourceSha256: await reviewDigest(), events, result }));
  } finally {
    const result = await session.close();
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel); t.signal.removeEventListener('abort', cancel);
    assert.equal(result.cleanup.confirmed, true, 'Native cleanup was not confirmed.');
  }
});
