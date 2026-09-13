import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { createAuthenticatedAppServer } from '../server/authenticated-app-server.mjs';
import { RUNTIME_PIN } from '../server/runtime-sandbox.mjs';
import { startOwned, listenerGone } from '../../scripts/probe_runtime_confinement.mjs';

const requireHost = createRequire(new URL('../server/package.json', import.meta.url));
const { WebSocket, WebSocketServer } = requireHost('ws');
const digest = value => createHash('sha256').update(value).digest('hex');
const url = 'ws://127.0.0.1:54321/ws';
const baseSpec = Object.freeze({ command: '/usr/bin/sandbox-exec', args: Object.freeze(['-p', '(deny default)', '/usr/local/bin/node', 'synthetic.js', 'server']),
  options: Object.freeze({ cwd: '/private/tmp/synthetic/state', env: Object.freeze({ PATH: '/usr/bin:/bin' }) }) });
const info = { backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
  capabilities: { agent_management: true, conversation_management: true, memory_management: true, runtime_start: true, split_channels: false } };
const response = (request, extra = {}) => ({ type: `${request.type}_response`, request_id: request.request_id, success: true,
  ...(request.type === 'app_server_info' ? info : request.type === 'agent_list' ? { agents: [] }
    : request.type === 'conversation_list' ? { conversations: [] }
      : request.type === 'agent_retrieve' ? { agent: { id: request.agent_id } }
        : request.type === 'conversation_retrieve' ? { conversation: { id: request.conversation_id } }
          : { messages: [], next_before: null, has_more: false }), ...extra });
const code = expected => failure => {
  assert.equal(failure.message, 'App Server connection failed.');
  assert.equal(failure.code, expected); assert.equal(failure.cause, undefined); return true;
};

function mockTransport(behavior = {}) {
  const sockets = [];
  class FakeSocket extends EventEmitter {
    constructor(address, options) {
      super(); this.address = address; this.options = options; this.sent = []; this.closed = false;
      sockets.push(this);
      queueMicrotask(() => behavior.open ? behavior.open(this) : this.emit('open'));
    }
    message(message, binary = false) {
      this.emit('message', Buffer.from(typeof message === 'string' ? message : JSON.stringify(message)), binary);
    }
    send(payload, callback) {
      const request = JSON.parse(payload); this.sent.push(request);
      if (behavior.send) behavior.send(this, request, callback);
      else { callback?.(); queueMicrotask(() => this.message(response(request))); }
    }
    terminate() { if (!this.closed) { this.closed = true; queueMicrotask(() => this.emit('close', 1006, Buffer.from('upstream-private-close'))); } }
  }
  return { sockets, WebSocketImpl: FakeSocket };
}
async function factory(transport = mockTransport(), extra = {}) {
  return createAuthenticatedAppServer({}, { makeSandbox: async () => baseSpec,
    WebSocketImpl: transport.WebSocketImpl, handshakeMs: 30, requestMs: 30, ...extra });
}

test('factory composes native auth flags, creates fresh private capability after validation and does no spawning', async () => {
  const transport = mockTransport(); const a = await factory(transport); const b = await factory(transport);
  assert.equal(transport.sockets.length, 0);
  assert.deepEqual(a.launchSpec.args.slice(0, baseSpec.args.length), baseSpec.args);
  assert.deepEqual(a.launchSpec.args.slice(-4, -1), ['--ws-auth', 'capability-token', '--ws-token-sha256']);
  assert.ok(a.launchSpec.args.at(-1) !== b.launchSpec.args.at(-1));
  assert.equal(a.launchSpec.options, baseSpec.options);
  const client = await a.connect(url); const socket = transport.sockets[0];
  const capability = socket.options.headers.Authorization.slice(7);
  assert.ok(/^[a-f0-9]{64}$/.test(capability));
  assert.ok(digest(capability) === a.launchSpec.args.at(-1));
  assert.ok(!JSON.stringify(a).includes(capability) && !JSON.stringify(client).includes(capability));
  assert.deepEqual(Object.keys(socket.options.headers), ['Authorization']);
  assert.equal(socket.address, url); assert.equal(socket.options.agent, false);
  assert.equal(socket.options.followRedirects, false); assert.equal(socket.options.maxRedirects, 0);
  assert.equal(socket.options.perMessageDeflate, false); assert.equal(socket.options.skipUTF8Validation, false);
  assert.equal(socket.options.maxPayload, 1048576); assert.equal(socket.options.maxFragments, 64);
  assert.equal(socket.options.maxBufferedChunks, 64); assert.equal(socket.options.autoPong, true);
  assert.equal(socket.sent[0].type, 'app_server_info');
  await a.dispose(); await b.dispose(); assert.ok(socket.closed);
  await assert.rejects(a.connect(url), code('DISPOSED'));
  await assert.rejects(createAuthenticatedAppServer({}, { makeSandbox: async () => { throw new Error('private validation text'); } }), code('LAUNCH_VALIDATION_FAILED'));
});

test('endpoint and custom header rejection happen before socket creation', async () => {
  const transport = mockTransport(); const host = await factory(transport);
  for (const invalid of ['ws://localhost:123/ws', 'ws://2130706433:123/ws', 'ws://127.0.0.1:0/ws',
    'ws://127.0.0.1:65536/ws', 'ws://127.0.0.1:01/ws', 'ws://127.0.0.1:123/ws?token=x',
    'ws://127.0.0.1:123/ws#x', 'ws://127.0.0.1:123/ws\n', 'ws://u@127.0.0.1:123/ws',
    'ws://[::1]:123/ws', 'wss://127.0.0.1:123/ws', 'ws://127.0.0.1:123/']) {
    await assert.rejects(host.connect(invalid), code('INVALID_ENDPOINT'));
  }
  await assert.rejects(host.connect(url, { headers: { Authorization: 'synthetic' } }), code('INVALID_REQUEST'));
  assert.equal(transport.sockets.length, 0); await host.dispose();
});

test('handshake 401/403/redirect and upstream errors expose only static errors and close sockets', async () => {
  for (const status of [401, 403, 302, 500]) {
    let destroyed = 0;
    const transport = mockTransport({ open: socket => socket.emit('unexpected-response', { destroy: () => destroyed++ },
      { statusCode: status, headers: { location: 'https://must-not-follow.invalid/' }, destroy: () => destroyed++ }) });
    const host = await factory(transport);
    await assert.rejects(host.connect(url), code([401, 403].includes(status) ? 'AUTH_REJECTED' : 'HANDSHAKE_REJECTED'));
    assert.equal(destroyed, 2); assert.equal(transport.sockets.length, 1); assert.ok(transport.sockets[0].closed);
    await host.dispose();
  }
  const transport = mockTransport({ open: socket => socket.emit('error', new Error('upstream private error')) });
  const host = await factory(transport); await assert.rejects(host.connect(url), code('SOCKET_ERROR')); await host.dispose();
});

test('ready client requires native version/local backend/protocol and capability identity', async () => {
  for (const extra of [{ letta_code_version: '0.32.6' }, { backend: 'cloud' }, { protocol_version: 2 }, { capabilities: {} }]) {
    const transport = mockTransport({ send: (socket, request) => queueMicrotask(() => socket.message(response(request, extra))) });
    const host = await factory(transport); await assert.rejects(host.connect(url), code('RUNTIME_MISMATCH')); await host.dispose();
  }
});

test('read-only RPC supports bounded pinned shapes and correlates overlapping replies out of order', async () => {
  const waiting = [];
  const transport = mockTransport({ send: (socket, request) => {
    if (request.type === 'app_server_info') queueMicrotask(() => socket.message(response(request)));
    else waiting.push(request);
  } });
  const host = await factory(transport); const client = await host.connect(url); const socket = transport.sockets[0];
  const requests = [
    ['agent_list', { query: { limit: 2, after: 'agent-1', query_text: 'synthetic', tags: ['tag'] } }],
    ['agent_retrieve', { agent_id: 'agent-1' }],
    ['conversation_list', { query: { agent_id: 'agent-1', limit: 3, summary_search: 'synthetic' } }],
    ['conversation_retrieve', { conversation_id: 'local-conv-1' }],
    ['conversation_messages_list', { conversation_id: 'local-conv-1', query: { limit: 4, before: 'message-2', order: 'asc' } }],
  ];
  const results = requests.map(([type, input]) => client.request(type, input));
  for (const request of waiting.reverse()) socket.message(response(request));
  const returned = await Promise.all(results);
  assert.deepEqual(returned.map(item => item.type), requests.map(([type]) => `${type}_response`));
  assert.equal(new Set(socket.sent.map(item => item.request_id)).size, socket.sent.length);
  await host.dispose();
});

test('rejects mutations, files, tools, extra fields, invalid IDs/cursors/limits and accessor inputs without sending', async () => {
  const transport = mockTransport(); const host = await factory(transport); const client = await host.connect(url);
  for (const type of ['input', 'runtime_start', 'read_file', 'agent_create', 'conversation_update', 'terminal_spawn']) {
    await assert.rejects(client.request(type), code('FORBIDDEN_COMMAND'));
  }
  const invalid = [['app_server_info', { request_id: 'spoof' }], ['agent_retrieve', { agent_id: 'default' }],
    ['conversation_retrieve', { conversation_id: '../real' }], ['agent_list', { query: { limit: 101 } }],
    ['agent_list', { query: { limit: 0 } }], ['agent_list', { query: { after: 'x'.repeat(129) } }],
    ['agent_list', { query: { include: ['agent.secrets'] } }], ['agent_list', { query: { tags: Array(11).fill('x') } }],
    ['agent_list', { query: { tags: [,'x'] } }], ['conversation_list', { query: { order: 'sideways' } }],
    ['agent_list', { query: { name: 'ignored upstream' } }], ['agent_list', { query: { match_all_tags: false } }],
    ['conversation_list', { query: { archive_status: 'archived' } }], ['conversation_list', { query: { order: 'asc' } }]];
  for (const [type, input] of invalid) await assert.rejects(client.request(type, input), code('INVALID_REQUEST'));
  for (const ending of ['\n', '\r', '\u2028', '\u2029']) {
    await assert.rejects(client.request('agent_retrieve', { agent_id: `agent-1${ending}` }), code('INVALID_REQUEST'));
    await assert.rejects(client.request('agent_list', { query: { after: `agent-1${ending}` } }), code('INVALID_REQUEST'));
  }
  let invoked = false;
  const getter = { get agent_id() { invoked = true; return 'agent-1'; } };
  await assert.rejects(client.request('agent_retrieve', getter), code('INVALID_REQUEST')); assert.equal(invoked, false);
  assert.equal(transport.sockets[0].sent.length, 1); await host.dispose();
});

test('mismatched envelope, malformed/missing arrays, identity mismatch, oversized/binary/deep JSON fail closed', async () => {
  const cases = [
    [r => ({ ...response(r), type: 'wrong' }), 'INVALID_RESPONSE'],
    [r => ({ ...response(r), success: 'yes' }), 'INVALID_RESPONSE'],
    [r => ({ ...response(r), agents: null }), 'INVALID_RESPONSE'],
    [r => ({ ...response(r), agents: [{}] }), 'INVALID_RESPONSE'],
    [r => ({ ...response(r), agents: Array.from({ length: 21 }, (_, i) => ({ id: `agent-${i}` })) }), 'INVALID_RESPONSE'],
    [r => ({ ...response(r), success: false, error: 'upstream private' }), 'SERVER_REJECTED'],
    [() => 'bad json', 'INVALID_MESSAGE'], [() => 'x'.repeat(1048577), 'INVALID_MESSAGE'],
    [() => '['.repeat(10000) + '0' + ']'.repeat(10000), 'INVALID_MESSAGE'],
  ];
  for (const [make, expected] of cases) {
    const transport = mockTransport({ send: (socket, request) => queueMicrotask(() => socket.message(request.type === 'app_server_info' ? response(request) : make(request))) });
    const host = await factory(transport); const client = await host.connect(url);
    await assert.rejects(client.request('agent_list'), code(expected)); await host.dispose();
  }
  for (const type of ['agent_retrieve', 'conversation_retrieve', 'conversation_messages_list']) {
    const transport = mockTransport({ send: (socket, request) => queueMicrotask(() => socket.message(request.type === 'app_server_info' ? response(request)
      : response(request, { agent: { id: 'wrong' }, conversation: { id: 'wrong' }, next_before: 123 }))) });
    const host = await factory(transport); const client = await host.connect(url);
    await assert.rejects(client.request(type, type === 'agent_retrieve' ? { agent_id: 'agent-1' } : { conversation_id: 'conv-1' }), code('INVALID_RESPONSE'));
    await host.dispose();
  }
  const transport = mockTransport({ send: (socket, request) => queueMicrotask(() => socket.message(response(request), true)) });
  const host = await factory(transport); await assert.rejects(host.connect(url), code('INVALID_MESSAGE')); await host.dispose();
});

test('upstream capability echo including escaped JSON is rejected without exposure', async () => {
  const transport = mockTransport({ send: (socket, request) => {
    const token = socket.options.headers.Authorization.slice(7);
    const escaped = token.split('').map(character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
    const payload = JSON.stringify(response(request)).slice(0, -1) + `,"echo":"${escaped}"}`;
    queueMicrotask(() => socket.message(payload));
  } });
  const host = await factory(transport); await assert.rejects(host.connect(url), code('INVALID_RESPONSE')); await host.dispose();
});

test('unsolicited and late messages never resolve a request or trigger instructions; event flood is bounded', async () => {
  const transport = mockTransport(); const host = await factory(transport); const client = await host.connect(url); const socket = transport.sockets[0];
  socket.message(response(socket.sent[0])); // Completed request, now late.
  socket.message({ type: 'permission_request', request_id: 'not-ours', instruction: 'synthetic ignore me' });
  const result = await client.request('agent_list'); assert.deepEqual(result.agents, []);
  assert.equal(socket.sent.length, 2);
  for (let i = 0; i < 31; i++) socket.message({ type: 'unsolicited' });
  await assert.rejects(client.request('agent_list'), code('CLOSED')); assert.ok(socket.closed); await host.dispose();
});

test('timeouts, disconnect, abort and send failures reject pending work and close sockets', async () => {
  const idle = mockTransport({ open: () => {} }); const noHandshake = await factory(idle, { handshakeMs: 5 });
  await assert.rejects(noHandshake.connect(url), code('CONNECT_TIMEOUT')); await noHandshake.dispose();
  for (const trigger of ['timeout', 'disconnect', 'abort', 'callback', 'throw']) {
    const controller = new AbortController();
    const transport = mockTransport({ send: (socket, request, callback) => {
      if (request.type === 'app_server_info') return queueMicrotask(() => socket.message(response(request)));
      if (trigger === 'disconnect') queueMicrotask(() => socket.emit('close', 1000, 'private'));
      if (trigger === 'abort') queueMicrotask(() => controller.abort());
      if (trigger === 'callback') callback(new Error('private send failure'));
      if (trigger === 'throw') throw new Error('private thrown send failure');
    } });
    const host = await factory(transport, { requestMs: 5 }); const client = await host.connect(url);
    const expected = trigger === 'timeout' ? 'REQUEST_TIMEOUT' : trigger === 'disconnect' ? 'DISCONNECTED' : trigger === 'abort' ? 'ABORTED' : 'SEND_FAILED';
    await assert.rejects(client.request('agent_list', {}, { signal: controller.signal }), code(expected)); await host.dispose();
  }
});

test('socket and pending limits, lifetime abort and idempotent disposal include handshaking clients', async () => {
  const transport = mockTransport({ send: (socket, request) => { if (request.type === 'app_server_info') queueMicrotask(() => socket.message(response(request))); } });
  const host = await factory(transport); const controller = new AbortController();
  const a = await host.connect(url, { signal: controller.signal }); await host.connect(url);
  await assert.rejects(host.connect(url), code('CONNECTION_LIMIT'));
  const waiting = Array.from({ length: 8 }, () => a.request('agent_list').catch(failure => failure.code));
  await assert.rejects(a.request('agent_list'), code('PENDING_LIMIT'));
  controller.abort(); assert.deepEqual(await Promise.all(waiting), Array(8).fill('ABORTED'));
  assert.equal(host.dispose(), host.dispose()); await host.dispose(); assert.ok(transport.sockets.every(socket => socket.closed));
  const pendingTransport = mockTransport({ open: () => {} }); const pendingHost = await factory(pendingTransport);
  const opening = pendingHost.connect(url); const rejected = assert.rejects(opening, code('CLOSED'));
  await pendingHost.dispose(); await rejected;
});

async function loopbackServer(t, onUpgrade, onMessage) {
  const server = createServer(); const wss = new WebSocketServer({ noServer: true, perMessageDeflate: false });
  server.on('upgrade', (request, socket, head) => onUpgrade(request, socket, head, wss));
  wss.on('connection', socket => socket.on('message', data => onMessage(socket, JSON.parse(data.toString()))));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => {
    for (const socket of wss.clients) socket.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  return `ws://127.0.0.1:${server.address().port}/ws`;
}

test('real ws8.21.3 loopback transport sends bearer header and handles native-shaped read responses', async t => {
  let observedDigest; let pathOnly; let extensions;
  const address = await loopbackServer(t, (request, socket, head, wss) => {
    observedDigest = digest(request.headers.authorization.slice(7)); pathOnly = request.url; extensions = request.headers['sec-websocket-extensions'];
    wss.handleUpgrade(request, socket, head, connected => wss.emit('connection', connected));
  }, (socket, request) => socket.send(JSON.stringify(response(request))));
  const host = await createAuthenticatedAppServer({}, { makeSandbox: async () => baseSpec });
  try {
    const client = await host.connect(address);
    assert.ok(observedDigest === host.launchSpec.args.at(-1)); assert.equal(pathOnly, '/ws'); assert.equal(extensions, undefined);
    assert.deepEqual((await client.request('agent_list')).agents, []);
  } finally { await host.dispose(); }
  assert.equal(requireHost('ws/package.json').version, '8.21.3');
});

test('real ws rejects HTTP auth errors/redirect without following or exposing response details', async t => {
  for (const status of [401, 403, 302]) {
    let upgrades = 0;
    const address = await loopbackServer(t, (_request, socket) => {
      upgrades++;
      socket.end(`HTTP/1.1 ${status} Synthetic\r\nConnection: close\r\nLocation: http://192.0.2.1/never\r\nContent-Length: 7\r\n\r\nprivate`);
    }, () => {});
    const host = await createAuthenticatedAppServer({}, { makeSandbox: async () => baseSpec });
    try { await assert.rejects(host.connect(address), code(status === 302 ? 'HANDSHAKE_REJECTED' : 'AUTH_REJECTED')); }
    finally { await host.dispose(); }
    assert.equal(upgrades, 1);
  }
});

test('real ws answers more than 32 native heartbeat pings and remains usable', async t => {
  let peer;
  const address = await loopbackServer(t, (request, socket, head, wss) => {
    wss.handleUpgrade(request, socket, head, connected => { peer = connected; wss.emit('connection', connected); });
  }, (socket, request) => socket.send(JSON.stringify(response(request))));
  const host = await createAuthenticatedAppServer({}, { makeSandbox: async () => baseSpec });
  try {
    const client = await host.connect(address);
    let timer;
    await new Promise((resolve, reject) => {
      let pongs = 0;
      timer = setTimeout(() => reject(new Error('Synthetic heartbeat timeout.')), 1000);
      peer.on('pong', () => { if (++pongs === 40) resolve(); });
      for (let i = 0; i < 40; i++) peer.ping('synthetic');
    }).finally(() => clearTimeout(timer));
    assert.deepEqual((await client.request('agent_list')).agents, []);
  } finally { await host.dispose(); }
});

test('real ws enforces the configured fragmented-message bound', async t => {
  const address = await loopbackServer(t, (request, socket, head, wss) => {
    wss.handleUpgrade(request, socket, head, connected => wss.emit('connection', connected));
  }, (socket, request) => {
    if (request.type === 'app_server_info') socket.send(JSON.stringify(response(request)));
    else {
      for (let i = 0; i < 65; i++) socket.send(' ', { fin: false });
      socket.send(' ', { fin: true });
    }
  });
  const host = await createAuthenticatedAppServer({}, { makeSandbox: async () => baseSpec });
  try {
    const client = await host.connect(address);
    await assert.rejects(client.request('agent_list'), code('SOCKET_ERROR'));
  } finally { await host.dispose(); }
});

// Default tests never launch the upstream runtime. This opt-in attests reviewed
// frozen bytes; the digest is NOT authentication or proof a review took place.
const reviewFiles = ['../server/authenticated-app-server.mjs', './authenticated-app-server.test.mjs',
  '../server/package.json', '../server/package-lock.json', '../server/runtime-sandbox.mjs', '../../scripts/probe_runtime_confinement.mjs'];
async function reviewedDigest() {
  const hash = createHash('sha256');
  for (const file of reviewFiles) hash.update(await fs.readFile(new URL(file, import.meta.url)));
  return hash.digest('hex');
}
async function expectNative401(address, authorization) {
  let socket;
  let timer;
  let closeTimer;
  let closed;
  try {
    await new Promise((resolve, reject) => {
      socket = new WebSocket(address, { headers: authorization ? { Authorization: authorization } : {},
        agent: false, followRedirects: false, handshakeTimeout: 5000, perMessageDeflate: false,
        maxPayload: 4096, maxFragments: 8, maxBufferedChunks: 8 });
      closed = new Promise(done => socket.once('close', done));
      socket.on('error', () => {}); // ws reports aborted handshakes after destroy.
      timer = setTimeout(() => reject(new Error('Native denial timed out.')), 5000);
      socket.once('open', () => reject(new Error('Native denied client was accepted.')));
      socket.once('unexpected-response', (request, response) => {
        const denied = response.statusCode === 401;
        response.destroy(); request.destroy();
        denied ? resolve() : reject(new Error('Native denial status mismatch.'));
      });
    });
    return 401;
  } finally {
    clearTimeout(timer);
    socket?.terminate();
    if (closed) await Promise.race([closed, new Promise((_, reject) => {
      closeTimer = setTimeout(() => reject(new Error('Native denial socket cleanup failed.')), 1000);
    })]).finally(() => clearTimeout(closeTimer));
  }
}

test('native capability authentication (opt-in after independent frozen-source security PASS)', {
  skip: process.env.WP0045_RUN_NATIVE !== '1', timeout: 60000,
}, async t => {
  assert.equal(process.platform, 'darwin');
  assert.ok(process.env.WP0045_REVIEWED_SHA256 === await reviewedDigest(), 'Native review digest missing or changed.');
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0045-'));
  const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
  await fs.mkdir(stateRoot, { mode: 0o700 }); await fs.mkdir(protectedRoot, { mode: 0o700 });
  let host; let child; let address; let cleanup; let gone;
  const controller = new AbortController();
  const cancel = () => { controller.abort(); void host?.dispose().catch(() => {}); void child?.stop().catch(() => {}); };
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel); t.signal.addEventListener('abort', cancel, { once: true });
  try {
    host = await createAuthenticatedAppServer({ dependencyRoot: '/private/tmp/personal-co-wp0041.qRnOrc/node_modules', stateRoot, protectedRoot });
    assert.ok(!controller.signal.aborted);
    child = startOwned(host.launchSpec); address = await child.endpoint();
    const missing = await expectNative401(address);
    const wrong = await expectNative401(address, 'Bearer wp0045-known-wrong-synthetic');
    const client = await host.connect(address, { signal: controller.signal });
    assert.deepEqual((await client.request('agent_list', { query: { limit: 1 } })).agents, []);
    t.diagnostic(JSON.stringify({ schema: 'wp0045-native-auth-v1', fixtureRoot: root, pid: child.pid,
      reviewedSourceSha256: await reviewedDigest(), profileSha256: host.launchSpec.profileSha256,
      pin: RUNTIME_PIN, missingBearer: missing, wrongBearer: wrong,
      correctBearer: 'pinned_info_and_empty_agent_list', endpoint: address }));
  } finally {
    // Cleanup stages are independent so a socket failure cannot skip the child.
    const failures = [];
    try { await host?.dispose(); } catch { failures.push('factory_cleanup_failed'); }
    try { cleanup = await child?.stop(); } catch { failures.push('child_cleanup_failed'); }
    try { if (address) gone = await listenerGone(address); } catch { failures.push('listener_cleanup_failed'); }
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel); t.signal.removeEventListener('abort', cancel);
    t.diagnostic(JSON.stringify({ fixtureRoot: root, cleanup, listenerGone: gone, failures }));
    assert.equal(failures.length, 0, 'Native cleanup failed.');
  }
});
