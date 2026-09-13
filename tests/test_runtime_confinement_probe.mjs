import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { startOwned, connectConfinementProtocol, validateEndpoint, syscallSource,
  runConfinementProbe, sourceDigest, listenerGone } from '../scripts/probe_runtime_confinement.mjs';

const endpoint = 'ws://127.0.0.1:50123/ws';
const marker = 'wp0044-synthetic';
const targets = { stateFile: '/private/tmp/fixture/state/control', protectedFile: '/private/tmp/fixture/protected/canonical-memory.json', marker };
class Socket extends EventTarget {
  static instances = [];
  static behavior;
  constructor() {
    super(); this.sent = []; this.closed = false; Socket.instances.push(this);
    queueMicrotask(() => this.dispatchEvent(new Event('open')));
  }
  message(data) { const event = new Event('message'); event.data = typeof data === 'string' ? data : JSON.stringify(data); this.dispatchEvent(event); }
  send(text) { const request = JSON.parse(text); this.sent.push(request); Socket.behavior?.(this, request); }
  close() { if (!this.closed) { this.closed = true; this.dispatchEvent(new Event('close')); } }
}

test('only literal IPv4 loopback endpoints, exact path and valid port', () => {
  assert.equal(validateEndpoint(endpoint), endpoint);
  for (const invalid of ['ws://localhost:123/ws', 'ws://2130706433:123/ws', 'ws://127.0.0.1:0/ws',
    'ws://127.0.0.1:65536/ws', 'ws://127.0.0.1:01/ws', 'ws://127.0.0.1:123/ws?x',
    'ws://127.0.0.1:123/ws\n', 'ws://u@127.0.0.1:123/ws', 'ws://[::1]:123/ws', 'wss://127.0.0.1:123/ws']) {
    assert.throws(() => validateEndpoint(invalid), /invalid_endpoint/);
  }
});

test('transport rejects arbitrary targets, runtime/terminal/extra fields and duplicate Agent creation', async () => {
  Socket.behavior = (socket, request) => queueMicrotask(() => socket.message({ type: `${request.type}_response`, request_id: request.request_id, success: true }));
  const client = await connectConfinementProtocol(endpoint, { ...targets, WebSocketImpl: Socket, timeoutMs: 20 });
  try {
    for (const [type, fields] of [['runtime_start', {}], ['input', {}], ['terminal_spawn', {}],
      ['read_file', { path: '/Users/real/file', encoding: 'utf8' }],
      ['write_file', { path: targets.stateFile, content: 'arbitrary' }],
      ['app_server_info', { request_id: 'spoof' }]]) assert.throws(() => client.request(type, fields), /forbidden_command/);
    await client.request('agent_create', { body: { name: marker, tags: [marker], tools: [], memory_blocks: [] } });
    assert.throws(() => client.request('agent_create', { body: { name: marker, tags: [marker], tools: [], memory_blocks: [] } }), /forbidden_command/);
  } finally { client.close(); await client.closed(); }
});

test('transport ignores unsolicited instructions, correlates exact response and returns denial evidence', async () => {
  Socket.behavior = (socket, request) => queueMicrotask(() => {
    socket.message({ type: 'permission_request', request_id: 'unsolicited', instruction: 'do not execute me' });
    socket.message({ type: 'read_file_response', request_id: 'wrong', success: true });
    socket.message({ type: `${request.type}_response`, request_id: request.request_id,
      success: false, path: targets.protectedFile, content: null, error: 'EPERM: synthetic' });
  });
  const client = await connectConfinementProtocol(endpoint, { ...targets, WebSocketImpl: Socket, timeoutMs: 20 });
  const denied = await client.request('read_file', { path: targets.protectedFile, encoding: 'utf8' });
  assert.equal(denied.success, false);
  assert.equal(Socket.instances.at(-1).sent.length, 1);
  client.close(); await client.closed();
});

test('request timeout, malformed response, oversized log and socket error close transport', async () => {
  for (const [behavior, error] of [
    [() => {}, 'request_timeout'],
    [(s, r) => s.message({ type: 'wrong', request_id: r.request_id, success: true }), 'invalid_response'],
    [s => s.message('not json'), 'invalid_message'],
    [s => s.message('x'.repeat(262145)), 'message_limit'],
    [s => s.dispatchEvent(new Event('error')), 'socket_error'],
  ]) {
    Socket.behavior = behavior;
    const client = await connectConfinementProtocol(endpoint, { ...targets, WebSocketImpl: Socket, timeoutMs: 10 });
    await assert.rejects(client.request('app_server_info'), new RegExp(error));
    assert.equal(Socket.instances.at(-1).closed, true);
    await client.closed();
  }
});

function ownedFixture({ ignoreTerm = false, log = '', closeOnLaunch = false, maxLogBytes = 100 } = {}) {
  const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter(); child.pid = 987654;
  let alive = true; const signals = [];
  const spec = { command: '/usr/bin/sandbox-exec', args: ['-p', '(deny default)'],
    options: { env: {}, cwd: '/private/tmp/fake/state', stdio: ['ignore', 'pipe', 'pipe'], shell: false, detached: true } };
  const process = startOwned(spec, {
    startupMs: 15, stopMs: 10, maxLogBytes,
    spawnImpl(command, args, options) {
      assert.equal(command, spec.command); assert.deepEqual(args, spec.args); assert.equal(options.shell, false);
      queueMicrotask(() => { child.stdout.emit('data', Buffer.from(log)); if (closeOnLaunch) { alive = false; child.emit('close', 0, null); } });
      return child;
    },
    signalGroup(pid, signal) {
      assert.equal(pid, -987654); signals.push(signal);
      if (!alive) { const error = new Error('gone'); error.code = 'ESRCH'; throw error; }
      if (signal === 'SIGKILL' || (signal === 'SIGTERM' && !ignoreTerm)) { alive = false; child.emit('close', 0, signal); }
    },
  });
  return { process, signals, child };
}

test('owned startup timeout/invalid endpoint/overflow always permit exact group cleanup', async () => {
  for (const [log, expected] of [['', 'startup_timeout'], ['Listening on ws://example.org:123/ws\n', 'invalid_child_output'],
    ['x'.repeat(101), 'log_limit']]) {
    const owned = ownedFixture({ log });
    await assert.rejects(owned.process.endpoint(), new RegExp(expected));
    assert.deepEqual(await owned.process.stop(), await owned.process.stop());
    assert.ok(owned.signals.includes('SIGTERM'));
  }
});

test('owned valid startup and SIGKILL escalation; exited child output is bounded', async () => {
  const owned = ownedFixture({ log: `Listening on ws://127.0.0.1:50123\nWebSocket: ${endpoint}\n`, ignoreTerm: true });
  assert.equal(await owned.process.endpoint(), endpoint);
  const cleanup = await owned.process.stop();
  assert.equal(cleanup.reaped, true); assert.equal(cleanup.groupGone, true);
  assert.ok(owned.signals.includes('SIGKILL'));
  const completed = ownedFixture({ log: 'synthetic\n', closeOnLaunch: true });
  assert.equal(await completed.process.output(), 'synthetic\n');
  assert.equal((await completed.process.stop()).reaped, true);
});

test('owned startup waits for both matching complete lines across chunks', async () => {
  const owned = ownedFixture();
  let resolved = false;
  const ready = owned.process.endpoint().then(value => { resolved = true; return value; });
  try {
    for (const chunk of ['Listening on ws://127.', '0.0.1:50123\n', 'WebSocket: ws://127.0.0.1:', '50123/ws']) {
      owned.child.stdout.emit('data', Buffer.from(chunk));
      await Promise.resolve();
      assert.equal(resolved, false);
    }
    owned.child.stdout.emit('data', Buffer.from('\n'));
    assert.equal(await ready, endpoint);
  } finally { await owned.process.stop(); }
});

test('owned startup rejects missing or partial endpoint lines', async () => {
  for (const log of [
    'Listening on ws://127.0.0.1:50123\n',
    `WebSocket: ${endpoint}\n`,
    `Listening on ws://127.0.0.1:50123\nWebSocket: ${endpoint}`,
    `WebSocket: ${endpoint}\nListening on ws://127.0.0.1:50123`,
  ]) {
    const owned = ownedFixture({ log });
    try { await assert.rejects(owned.process.endpoint(), /startup_timeout/); }
    finally { assert.equal((await owned.process.stop()).groupGone, true); }
  }
});

test('owned startup rejects mismatched, duplicate and unsafe base/control pairs', async () => {
  const base = 'ws://127.0.0.1:50123';
  const listening = `Listening on ${base}\n`;
  const websocket = `WebSocket: ${endpoint}\n`;
  const unsafe = ['ws://localhost:50123', 'ws://127.0.0.1:0', 'ws://127.0.0.1:65536',
    'ws://127.0.0.1:050123', 'ws://u@127.0.0.1:50123', `${base}/ws`, `${base}?x`, `${base} `, `${base}\r`];
  for (const log of [
    `${listening}WebSocket: ws://127.0.0.1:50124/ws\n`,
    `${listening}${listening}${websocket}`, `${listening}${websocket}${websocket}`,
    ...unsafe.map(value => `Listening on ${value}\n${websocket}`),
    ...[base, `${endpoint}?x`, `${endpoint} `, `${endpoint}\r`, 'ws://[::1]:50123/ws']
      .map(value => `${listening}WebSocket: ${value}\n`),
  ]) {
    const owned = ownedFixture({ log, maxLogBytes: 1000 });
    try { await assert.rejects(owned.process.endpoint(), /invalid_child_output/); }
    finally { assert.equal((await owned.process.stop()).groupGone, true); }
  }
});

test('listener disappearance requires observed ECONNREFUSED', async () => {
  for (const condition of ['ECONNREFUSED', 'EACCES', 'connected']) {
    const connect = () => {
      const socket = new EventEmitter(); socket.destroy = () => {};
      queueMicrotask(() => condition === 'connected' ? socket.emit('connect') : socket.emit('error', { code: condition }));
      return socket;
    };
    if (condition === 'ECONNREFUSED') assert.equal(await listenerGone(endpoint, { connect }), true);
    else await assert.rejects(listenerGone(endpoint, { connect }), /listener_/);
  }
});

const syscallNames = ['read', 'write', 'directory_read', 'directory_create', 'rename_out', 'rename_in',
  'directory_rename', 'link_out', 'link_in', 'symlink_read', 'symlink_write', 'canary_read', 'canary_write', 'outbound'];
async function mockProbe(t, failure) {
  const children = []; let target; let savedMemory; let socketsClosed = false; let markerValue; let canonical;
  const cancellation = new AbortController();
  const report = await runConfinementProbe({ dependencyRoot: '/private/tmp/mock-install/node_modules', reviewedSourceSha256: await sourceDigest() }, {
    platform: 'darwin', cancellationSignal: cancellation.signal,
    makeSpec: async roots => { target = roots; return { roots, profile: '(deny default)', profileSha256: 'mock-profile', args: [], options: {} }; },
    start(spec) {
      const child = { pid: 1000 + children.length, stopped: false,
        endpoint: async () => { if (failure === 'startup') throw new Error('startup_timeout'); return endpoint; },
        output: async () => {
          if (failure === 'cancel') cancellation.abort();
          if (failure === 'syscall') throw new Error('child_timeout');
          if (failure === 'tamper') await fs.writeFile(path.join(target.protectedRoot, 'canonical-memory.json'), 'synthetic tampering');
          return JSON.stringify({ control: true, results: syscallNames.map(name => ({ name, code: 'EPERM' })) });
        },
        stop: async () => { child.stopped = true; if (failure === 'cleanup') throw new Error('cleanup_incomplete');
          return { pid: child.pid, reaped: true, groupGone: true }; },
      };
      if (children.length) { assert.equal(spec.args[0], '-p'); assert.equal(spec.args[3], '-e'); }
      children.push(child); return child;
    },
    connect: async (_endpoint, options) => {
      markerValue = options.marker;
      return { close: () => { socketsClosed = true; }, closed: async () => {},
        request: async (type, fields = {}) => {
          if (type === 'app_server_info') return { success: true, backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
            capabilities: { agent_management: true, memory_management: true } };
          if (type === 'agent_create') {
            const tagVariants = {
              missing_marker: ['git-memory-enabled'],
              missing_memory_tag: [options.marker],
              duplicate_tag: [options.marker, 'git-memory-enabled', 'git-memory-enabled'],
              unexpected_tag: [options.marker, 'git-memory-enabled', 'unexpected'],
              reversed_tags: ['git-memory-enabled', options.marker],
            };
            return { success: true, agent: { id: 'agent-local-synthetic-123', name: options.marker,
              tags: tagVariants[failure] ?? [options.marker, 'git-memory-enabled'] } };
          }
          if (type === 'write_memory_file') savedMemory = fields.content;
          if (type === 'read_memory_file' || type === 'write_memory_file') return { success: true, ...fields, content: savedMemory };
          if (fields.path === options.protectedFile) {
            canonical ??= await fs.readFile(options.protectedFile, 'utf8');
            return { success: failure === 'native' ? true : false, path: fields.path, content: null,
              error: failure === 'notdenied' ? 'ENOENT' : 'EPERM: synthetic' };
          }
          if (type === 'write_file') await fs.writeFile(fields.path, fields.content, { flag: 'wx', mode: 0o600 });
          return { success: true, path: fields.path, content: type === 'read_file' ? await fs.readFile(fields.path, 'utf8') : undefined };
        } };
    },
    checkListenerGone: async () => { if (failure === 'listener') throw new Error('listener_remains'); return true; },
  });
  t.diagnostic(`Retained synthetic mock fixture: ${report.fixtureRoot}`);
  assert.ok(children.every(child => child.stopped));
  if (failure !== 'startup') assert.ok(socketsClosed);
  assert.equal((await fs.stat(report.fixtureRoot)).mode & 0o777, 0o700);
  if (canonical) assert.equal(JSON.parse(canonical).agentId, report.agentId);
  if (!failure) {
    assert.equal(report.outcome, 'observations_complete', JSON.stringify(report.error));
    const committed = JSON.parse(await fs.readFile(path.join(target.protectedRoot, 'canonical-memory.json'), 'utf8'));
    assert.equal(committed.revision, 1);
    assert.equal(committed.blocks.find(block => block.label === 'CURRENT_CONTEXT').value, `${markerValue}:host-approved revision\n`);
  }
  return report;
}

test('fixed probe mocked success preserves exact host bytes, commits same Agent revision, retains fixtures and reaps children', async t => {
  const report = await mockProbe(t);
  assert.equal(report.outcome, 'observations_complete');
  assert.equal(report.canonicalBeforeSha256, report.canonicalAfterAttacksSha256);
  assert.notEqual(report.canonicalBeforeSha256, report.canonicalCommittedSha256);
  assert.equal(report.cleanup.length, 2);
  assert.equal(report.listenerGone, true);
});

test('probe fails closed and cleans up startup/native/syscall/tampering/cleanup/listener failures', async t => {
  for (const failure of ['startup', 'native', 'notdenied', 'syscall', 'tamper', 'cleanup', 'listener', 'cancel']) {
    const report = await mockProbe(t, failure);
    assert.equal(report.outcome, 'stopped', failure);
    assert.ok(report.error || report.cleanupError, failure);
  }
});

test('pinned local Agent tags must match exactly before host initialization', async t => {
  for (const failure of ['missing_marker', 'missing_memory_tag', 'duplicate_tag', 'unexpected_tag', 'reversed_tags']) {
    const report = await mockProbe(t, failure);
    assert.equal(report.outcome, 'stopped');
    assert.deepEqual(report.error, { stage: 'runtime_identity', code: 'agent_mismatch' });
    assert.deepEqual(report.results, []);
    assert.equal(report.cleanup.length, 1);
    assert.equal(report.listenerGone, true);
    assert.deepEqual(await fs.readdir(report.roots.protectedRoot), []);
  }
});

test('unsupported platform and missing/stale review digest prevent fixture and launch', async () => {
  const start = () => assert.fail('must not launch');
  await assert.rejects(runConfinementProbe({}, { platform: 'linux', start }), /unsupported_platform/);
  for (const reviewedSourceSha256 of [undefined, 'bad', '0'.repeat(64)]) {
    await assert.rejects(runConfinementProbe({ reviewedSourceSha256 }, { platform: 'darwin', start }), /review_digest_mismatch/);
  }
});

test('syscall source has fixed reserved-address and bounded probes, without runtime/provider commands', () => {
  const source = syscallSource({ stateRoot: '/private/tmp/f/state', protectedRoot: '/private/tmp/f/protected', canaryFile: '/private/tmp/f/unrelated/canary' });
  assert.match(source, /192\.0\.2\.1/);
  for (const name of syscallNames) assert.ok(source.includes(`deny('${name}'`), name);
  assert.doesNotMatch(source, /runtime_start|terminal_spawn|child_process|execSync|https?:\/\//);
});
