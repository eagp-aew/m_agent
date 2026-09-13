import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEndpoint, validateReceipt, connectProtocol, runProbe } from '../scripts/probe_app_server_contract.mjs';

const ENDPOINT = 'ws://127.0.0.1:4500/ws';
function fixture(options = {}) {
  const state = options.state ?? { agent: undefined, conversation: undefined, memory: new Map() };
  const commands = [];
  const sockets = [];
  class Socket extends EventTarget {
    constructor(endpoint) {
      super(); this.endpoint = endpoint; this.closed = false; sockets.push(this);
      if (!options.noOpen) queueMicrotask(() => this.dispatchEvent(new Event('open')));
    }
    close() { this.closed = true; }
    send(raw) {
      const command = JSON.parse(raw);
      commands.push(command);
      if (options.socketError) { queueMicrotask(() => this.dispatchEvent(new Event('error'))); return; }
      if (options.ignore?.(command)) return;
      let body = {};
      switch (command.type) {
        case 'app_server_info': body = { backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
          capabilities: { agent_management: true, conversation_management: true, memory_management: true, runtime_start: true, split_channels: false } }; break;
        case 'agent_list': body = { agents: state.agent ? [state.agent] : [] }; break;
        case 'agent_create': state.agent = { ...command.body, id: 'agent-synthetic' }; body = { agent: state.agent }; break;
        case 'agent_retrieve': body = { agent: state.agent }; break;
        case 'conversation_create': state.conversation = { ...command.body, id: 'conv-local-1' }; body = { conversation: state.conversation }; break;
        case 'conversation_update': Object.assign(state.conversation, command.body); body = { conversation: state.conversation }; break;
        case 'conversation_retrieve': body = { conversation: state.conversation }; break;
        case 'conversation_list': body = { conversations: state.conversation ? [state.conversation] : [] }; break;
        case 'write_memory_file': state.memory.set(command.path, command.content); body = { agent_id: command.agent_id, path: command.path, committed: true }; break;
        case 'read_memory_file': body = { agent_id: command.agent_id, path: command.path, encoding: 'utf8', content: state.memory.get(command.path) ?? null }; break;
        default: throw new Error('unexpected fixture command');
      }
      let response = structuredClone({ type: `${command.type}_response`, request_id: command.request_id, success: true, ...body });
      response = options.transform?.(command, response, state, commands) ?? response;
      queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: typeof response === 'string' ? response : JSON.stringify(response) })));
    }
  }
  return { state, commands, sockets, WebSocketImpl: Socket };
}
function run(mock, extra = {}) { return runProbe({ endpoint: ENDPOINT, WebSocketImpl: mock.WebSocketImpl, timeoutMs: 100, ...extra }); }
function writes(mock) { return mock.commands.filter(command => ['agent_create', 'conversation_create', 'conversation_update', 'write_memory_file'].includes(command.type)); }

test('accepts only literal canonical numeric loopback WebSocket URLs', () => {
  assert.equal(validateEndpoint(ENDPOINT), ENDPOINT);
  assert.equal(validateEndpoint('ws://127.0.0.1:80/ws'), 'ws://127.0.0.1:80/ws');
  assert.equal(validateEndpoint('ws://[::1]:4500/ws'), 'ws://[::1]:4500/ws');
  for (const bad of ['http://127.0.0.1:4500/ws', 'wss://127.0.0.1:4500/ws', 'ws://localhost:4500/ws',
    'ws://127.1:4500/ws', 'ws://2130706433:4500/ws', 'ws://0x7f000001:4500/ws', 'ws://0177.0.0.1:4500/ws',
    'ws://127.0.0.2:4500/ws', 'ws://127.0.0.1:0/ws', 'ws://127.0.0.1:65536/ws', 'ws://127.0.0.1:04500/ws',
    'ws://127.0.0.1:4500/ws?token=x', 'ws://127.0.0.1:4500/ws#x', 'ws://user:pass@127.0.0.1:4500/ws',
    'ws://127.0.0.1:4500/ws/../ws', 'ws://127.0.0.1:4500', ' ws://127.0.0.1:4500/ws',
    'ws://[::ffff:127.0.0.1]:4500/ws', 'ws://127.0.0.1:4500/ws\n', undefined]) {
    assert.throws(() => validateEndpoint(bad), /invalid_endpoint/, String(bad));
  }
});

test('validates endpoint and timeout before constructing a socket', async () => {
  const mock = fixture();
  await assert.rejects(connectProtocol('ws://example.com:4500/ws', mock), /invalid_endpoint/);
  await assert.rejects(connectProtocol(ENDPOINT, { ...mock, timeoutMs: Infinity }), /invalid_timeout/);
  assert.equal(mock.sockets.length, 0);
});

test('import performs no WebSocket connection or probe work', async () => {
  const original = globalThis.WebSocket;
  globalThis.WebSocket = class { constructor() { throw new Error('import must not connect'); } };
  try { await import('../scripts/probe_app_server_contract.mjs?import-safety-test'); }
  finally { globalThis.WebSocket = original; }
});

test('connect timeout closes the owned socket', async () => {
  const mock = fixture({ noOpen: true });
  await assert.rejects(connectProtocol(ENDPOINT, { ...mock, timeoutMs: 5 }), /connect_timeout/);
  assert.equal(mock.sockets[0].closed, true);
});

test('rejects forbidden commands and extra envelope fields before send', async () => {
  const mock = fixture(); const client = await connectProtocol(ENDPOINT, mock);
  for (const type of ['input', 'runtime_start', 'delete_memory_file', 'agent_delete', 'shell', 'external_tool_call_response', '__proto__']) {
    assert.throws(() => client.request(type), /forbidden_command/);
  }
  assert.throws(() => client.request('app_server_info', { request_id: 'override' }), /forbidden_field/);
  assert.throws(() => client.request('app_server_info', { auth: 'secret' }), /forbidden_field/);
  assert.equal(mock.commands.length, 0); client.close();
});

test('read-only transport rejects every mutation', async () => {
  const mock = fixture(); const client = await connectProtocol(ENDPOINT, { ...mock, readOnly: true });
  for (const type of ['agent_create', 'conversation_create', 'conversation_update', 'write_memory_file']) {
    assert.throws(() => client.request(type), /forbidden_command/);
  }
  assert.equal(mock.commands.length, 0); client.close();
});

test('wrong correlation cannot settle a request and causes bounded timeout', async () => {
  const mock = fixture({ transform: (command, response) => ({ ...response, request_id: 'not-the-request' }) });
  const result = await run(mock, { timeoutMs: 5 });
  assert.equal(result.error, 'request_timeout'); assert.equal(writes(mock).length, 0);
  assert.equal(mock.sockets[0].closed, true);
});

for (const [name, options, expected] of [
  ['server error', { transform: (c, r) => ({ ...r, success: false, error: 'SECRET_DO_NOT_PRINT' }) }, 'server_rejected'],
  ['wrong response type', { transform: (c, r) => ({ ...r, type: 'external_tool_call_request' }) }, 'unexpected_response'],
  ['nonboolean success', { transform: (c, r) => ({ ...r, success: 'true' }) }, 'invalid_response'],
  ['malformed JSON', { transform: () => '{' }, 'invalid_message'],
  ['socket error', { socketError: true }, 'socket_error'],
  ['no response', { ignore: () => true }, 'request_timeout'],
]) {
  test(`${name} stops without mutation or echoing server details`, async () => {
    const mock = fixture(options); const result = await run(mock, { timeoutMs: 5 });
    assert.equal(result.error, expected); assert.equal(writes(mock).length, 0);
    assert.equal(JSON.stringify(result).includes('SECRET_DO_NOT_PRINT'), false);
    assert.equal(mock.sockets[0].closed, true);
  });
}

test('happy synthetic roundtrip verifies exact identities and six files', async () => {
  const mock = fixture(); const result = await run(mock);
  assert.equal(result.outcome, 'observations_complete');
  assert.equal(result.results.length, 4); assert.equal(result.receipt.memory_written, true);
  assert.equal(result.restart_process_observed, false); assert.equal(result.unresolved.length, 6);
  assert.equal(result.status, undefined); assert.equal(mock.state.memory.size, 6);
  assert.equal(writes(mock).length, 9);
  assert.deepEqual(validateReceipt(result.receipt), result.receipt);
  for (let i = 0; i < mock.commands.length; i++) {
    const command = mock.commands[i];
    if (['conversation_create', 'write_memory_file'].includes(command.type)) assert.equal(mock.commands[i - 1].type, 'agent_retrieve');
    if (command.type === 'conversation_update') {
      assert.equal(mock.commands[i - 1].type, 'conversation_retrieve');
      assert.equal(mock.commands[i - 2].type, 'agent_retrieve');
    }
  }
  assert.equal(mock.sockets[0].closed, true);
});

test('API backend, wrong version, or malformed capabilities stops before creation', async () => {
  for (const change of [{ backend: 'api' }, { letta_code_version: '0.33.0' }, { protocol_version: 2 }, { capabilities: {} }]) {
    const mock = fixture({ transform: (c, r) => c.type === 'app_server_info' ? { ...r, ...change } : r });
    assert.equal((await run(mock)).error, 'runtime_contract_mismatch'); assert.equal(writes(mock).length, 0);
  }
});

test('a preexisting marker prevents Agent creation', async () => {
  const mock = fixture({ transform: (c, r) => c.type === 'agent_list' ? { ...r, agents: [{}] } : r });
  assert.equal((await run(mock)).error, 'marker_not_fresh'); assert.equal(writes(mock).length, 0);
});

test('wrong created Agent tags or invalid ID prevents all subsequent mutations', async () => {
  for (const change of [{ tags: [] }, { id: '../other' }, { name: 'actual-user-agent' }]) {
    const mock = fixture({ transform: (c, r) => c.type === 'agent_create' ? { ...r, agent: { ...r.agent, ...change } } : r });
    assert.equal((await run(mock)).error, 'agent_ownership_mismatch'); assert.equal(writes(mock).length, 1);
  }
});

test('ownership recheck before each write catches mid-run identity drift', async () => {
  const mock = fixture({ transform: (c, r, state, commands) => c.type === 'agent_retrieve' && commands.some(x => x.type === 'write_memory_file')
    ? { ...r, agent: { ...r.agent, id: 'agent-other' } } : r });
  assert.equal((await run(mock)).error, 'agent_ownership_mismatch');
  assert.equal(mock.commands.filter(c => c.type === 'write_memory_file').length, 1);
});

test('conversation identity/binding/summary/tags mismatches stop before update', async () => {
  for (const change of [{ agent_id: 'agent-other' }, { id: 'default' }, { summary: 'wrong' }, { tags: [] }]) {
    const mock = fixture({ transform: (c, r) => c.type === 'conversation_create' ? { ...r, conversation: { ...r.conversation, ...change } } : r });
    assert.equal((await run(mock)).error, 'conversation_readback_mismatch');
    assert.equal(mock.commands.some(c => c.type === 'conversation_update'), false);
  }
});

test('post-update conversation readback mismatch prevents memory writes', async () => {
  const mock = fixture({ transform: (c, r) => c.type === 'conversation_update' ? { ...r, conversation: { ...r.conversation, summary: 'stale' } } : r });
  assert.equal((await run(mock)).error, 'conversation_readback_mismatch');
  assert.equal(mock.state.memory.size, 0);
});

test('duplicate or wrong listed conversation fails exact identity checks', async () => {
  for (const duplicate of [true, false]) {
    const mock = fixture({ transform: (c, r) => c.type === 'conversation_list'
      ? { ...r, conversations: duplicate ? [...r.conversations, ...r.conversations] : [{ ...r.conversations[0], id: 'other' }] } : r });
    const result = await run(mock);
    assert.equal(result.outcome, 'stopped'); assert.equal(mock.state.memory.size, 0);
  }
});

test('wrong memory write identity or readback stops without subsequent file writes', async () => {
  for (const target of ['write_memory_file', 'read_memory_file']) {
    const mock = fixture({ transform: (c, r) => c.type === target ? { ...r, path: 'wrong', content: 'wrong' } : r });
    assert.equal((await run(mock)).error, 'memory_readback_mismatch'); assert.equal(mock.state.memory.size, 1);
  }
});

test('unsupported memory capability is explicit rather than fabricated success', async () => {
  const mock = fixture({ transform: (c, r) => c.type === 'app_server_info' ? { ...r, capabilities: { ...r.capabilities, memory_management: false } } : r });
  const result = await run(mock); assert.equal(result.receipt.memory_written, false);
  assert.equal(result.results.at(-1).observation, 'not_observed'); assert.equal(mock.state.memory.size, 0);
});

test('restart receipt validates shape and cannot inject paths, target URLs or content', async () => {
  const original = await run(fixture());
  for (const change of [{ agent_id: '../bad' }, { conversation_id: 'default' }, { run_id: 'not-uuid' },
    { memory_written: 'true' }, { version: '0.1' }, { content: 'injected' }, { endpoint: 'ws://evil/ws' }, { path: '../private' }]) {
    const mock = fixture(); await assert.rejects(run(mock, { mode: 'verify', receipt: { ...original.receipt, ...change } }), /invalid_receipt/);
    assert.equal(mock.sockets.length, 0);
  }
});

test('read-only verification on another connection compares receipt without writes', async () => {
  const initial = fixture(); const created = await run(initial);
  const restarted = fixture({ state: initial.state });
  const checked = await run(restarted, { mode: 'verify', receipt: created.receipt });
  assert.equal(checked.outcome, 'observations_complete'); assert.deepEqual(checked.receipt, created.receipt);
  assert.equal(writes(restarted).length, 0); assert.equal(checked.restart_process_observed, false);
});

test('restart discrepancies in Agent, conversation or memory are failures with no writes', async () => {
  for (const target of ['agent', 'conversation', 'memory']) {
    const initial = fixture(); const created = await run(initial);
    if (target === 'agent') initial.state.agent.tags = [];
    if (target === 'conversation') initial.state.conversation.summary = 'lost after restart';
    if (target === 'memory') initial.state.memory.clear();
    const restarted = fixture({ state: initial.state }); const checked = await run(restarted, { mode: 'verify', receipt: created.receipt });
    assert.equal(checked.outcome, 'stopped'); assert.equal(checked.receipt, undefined); assert.equal(writes(restarted).length, 0);
  }
});

test('lost memory capability on restart cannot downgrade prior evidence', async () => {
  const initial = fixture(); const created = await run(initial);
  const restarted = fixture({ state: initial.state, transform: (c, r) => c.type === 'app_server_info'
    ? { ...r, capabilities: { ...r.capabilities, memory_management: false } } : r });
  const result = await run(restarted, { mode: 'verify', receipt: created.receipt });
  assert.equal(result.error, 'memory_capability_lost'); assert.equal(writes(restarted).length, 0);
});
