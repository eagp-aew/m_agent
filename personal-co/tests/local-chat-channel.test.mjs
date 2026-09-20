import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createAuthenticatedAppServer } from '../server/authenticated-app-server.mjs';
import { SYSTEM_PROMPT } from '../src/domain/policy.mjs';
import { previewChatContext, compileChatContext, systemForChatProjection } from '../server/local-chat-context.mjs';

const roots = { stateRoot: '/private/tmp/personal-co-wp0051-channel/state' };
const binding = { agentId: 'agent-1', stateRoot: roots.stateRoot, model: 'lmstudio/test', providerPort: 12345 };
const runtime = { agent_id: 'agent-1', conversation_id: 'conv-1' };
const info = { backend: 'local', letta_code_version: '0.32.5', protocol_version: 1,
  capabilities: { agent_management: true, conversation_management: true, memory_management: true, runtime_start: true, split_channels: false } };
async function fixture(change = () => {}, limits = {}) {
  const sockets = [];
  class Peer extends EventEmitter {
    constructor(_url, options) { super(); this.options = options; this.sent = []; sockets.push(this); queueMicrotask(() => this.emit('open')); }
    emitFrame(frame) { this.emit('message', Buffer.from(JSON.stringify(frame)), false); }
    terminate() { if (!this.closed) { this.closed = true; queueMicrotask(() => this.emit('close')); } }
    close(code) {
      if (change(this, { type: 'close' }) === false) return;
      if (!this.closed) { this.closed = true; queueMicrotask(() => this.emit('close', code)); }
    }
    send(payload, callback) {
      const request = JSON.parse(payload); this.sent.push(request); callback?.();
      queueMicrotask(() => {
        if (change(this, request) === false) return;
        let value = request.type === 'app_server_info' ? info
          : request.type === 'runtime_start' ? { runtime, execution_settings: request.execution_settings, created: { agent: false, conversation: false } }
            : request.type === 'set_reflection_settings' ? { scope: 'local_project' }
              : request.type === 'get_reflection_settings' ? { reflection_settings: { agent_id: 'agent-1', trigger: 'off', step_count: 25, merge: 'explicit' } }
                : request.type === 'agent_retrieve' ? { agent: { id: 'agent-1', system: SYSTEM_PROMPT, model: binding.model, tools: [] } } : {};
        if (request.type === 'input') {
          const clientId = request.payload.messages[0].client_message_id;
          this.emitFrame({ type: 'turn_finished', runtime, run_id: 'run-2', turn_id: 'turn-1', stop_reason: 'end_turn' });
          this.emitFrame({ type: 'update_loop_status', runtime, loop_status: { client_message_ids_by_run_id: { 'run-1': [clientId], 'run-2': [clientId] } } });
          this.emitFrame({ type: 'input_accepted', runtime, request_id: request.request_id, accepted: true, disposition: 'started' });
        } else this.emitFrame({ type: `${request.type}_response`, request_id: request.request_id, success: true, ...value });
      });
    }
  }
  const auth = await createAuthenticatedAppServer(roots, { makeSandbox: async () => ({ args: [], options: {} }),
    WebSocketImpl: Peer, requestMs: 30, handshakeMs: 30, turnMs: 30, ...limits });
  return { auth, sockets, connect: () => auth.connectChat('ws://127.0.0.1:12345/ws', binding) };
}

test('fresh named channel preserves private bearer, two-socket limit, fixed startup and one input', async () => {
  const f = await fixture();
  const read = await f.auth.connect('ws://127.0.0.1:12345/ws'); const chat = await f.connect();
  assert.equal(chat.request, undefined); assert.equal(chat.verify, undefined);
  await assert.rejects(f.connect(), { code: 'CONNECTION_LIMIT' });
  await chat.prepareAgent(); await chat.start('conv-1');
  const receipt = await chat.input(randomUUID(), 'plain original');
  assert.deepEqual(receipt, { runId: 'run-2', turnId: 'turn-1', stopReason: 'end_turn', error: false });
  await assert.rejects(chat.input(randomUUID(), 'again'));
  const sent = f.sockets[1].sent;
  assert.deepEqual(sent.find(row => row.type === 'agent_update').body, { system: SYSTEM_PROMPT, model: binding.model, tools: [] });
  const start = sent.find(row => row.type === 'runtime_start');
  assert.equal(start.mode, 'strict'); assert.deepEqual(start.skill_sources, []); assert.deepEqual(start.external_tools, []);
  const input = sent.find(row => row.type === 'input');
  assert.deepEqual(input.payload.client_toolset, { base: 'none', include: [] });
  assert.equal(input.payload.messages[0].content, 'plain original');
  assert.equal(sent.filter(row => row.type === 'input').length, 1);
  assert.ok(!sent.some(row => row.type === 'ack'));
  assert.ok(!JSON.stringify(chat).includes(f.sockets[1].options.headers.Authorization.slice(7)));
  await chat.close(); const next = await f.connect(); await next.close(); await read.close(); await f.auth.dispose();
});

test('channel accepts only host-built context, verifies projection and resets protected policy before seal', async () => {
  const snapshot = { digest: 'a'.repeat(64), memory: { agentId: 'agent-1', revision: 0,
    blocks: [{ id: 'block-1', label: 'CURRENT_CONTEXT', value: 'Untrusted selected excerpt' }], archive: [] } };
  const preview = previewChatContext(snapshot, 'agent-1');
  const projection = compileChatContext(snapshot, 'agent-1', { revision: 0, digest: snapshot.digest, items: [preview.items[0].id] });
  let system = SYSTEM_PROMPT;
  const f = await fixture((peer, request) => {
    if (request.type === 'agent_update') system = request.body.system;
    if (request.type === 'agent_retrieve') {
      peer.emitFrame({ type: 'agent_retrieve_response', request_id: request.request_id, success: true,
        agent: { id: 'agent-1', system, model: binding.model, tools: [] } }); return false;
    }
  });
  try {
    const chat = await f.connect(); await chat.prepareAgent(projection); assert.equal(system, systemForChatProjection(projection));
    await assert.rejects(chat.clearContext()); await chat.start('conv-1'); await chat.input(randomUUID(), 'original');
    await chat.clearContext(); assert.equal(system, SYSTEM_PROMPT); await assert.rejects(chat.clearContext());
    await chat.seal(); chat.assertSealed();
    assert.deepEqual(f.sockets[0].sent.filter(row => row.type === 'agent_update').map(row => row.body), [
      { system: systemForChatProjection(projection), model: binding.model, tools: [] }, { system: SYSTEM_PROMPT },
    ]);
  } finally { await f.auth.dispose(); }
  for (const value of ['raw prompt', { system: 'raw prompt' }, { ...projection }]) {
    const bad = await fixture();
    try {
      const chat = await bad.connect(); await assert.rejects(chat.prepareAgent(value));
      assert.ok(!bad.sockets[0].sent.some(row => row.type === 'agent_update'));
    } finally { await bad.auth.dispose(); }
  }
});

test('acceptance before terminal and run mapping also correlates', async () => {
  const f = await fixture((peer, request) => {
    if (request.type !== 'input') return;
    peer.emitFrame({ type: 'input_accepted', runtime, request_id: request.request_id, accepted: true, disposition: 'started' });
    peer.emitFrame({ type: 'turn_finished', runtime, run_id: 'run-1', turn_id: 'turn-1', stop_reason: 'end_turn' });
    peer.emitFrame({ type: 'update_loop_status', runtime, loop_status: { client_message_ids_by_run_id: { 'run-1': [request.payload.messages[0].client_message_id] } } });
    return false;
  });
  try { const chat = await f.connect(); await chat.start('conv-1'); assert.equal((await chat.input(randomUUID(), 'hello')).runId, 'run-1'); }
  finally { await f.auth.dispose(); }
});

for (const kind of ['authority', 'close', 'timeout']) test(`abnormal ${kind} remains observable after an RPC resolved`, async () => {
  const f = await fixture((_peer, request) => kind === 'timeout' && request.type === 'conversation_list' ? false : undefined);
  try {
    const chat = await f.connect(); await chat.start('conv-1');
    await chat.readConversation('conv-1');
    assert.equal(typeof chat.assertHealthy, 'function'); chat.assertHealthy();
    let notified = false; const failure = chat.failed.then(() => { notified = true; });
    if (kind === 'authority') f.sockets[0].emitFrame({ type: 'control_request', runtime });
    if (kind === 'close') f.sockets[0].terminate();
    if (kind === 'timeout') await assert.rejects(chat.listConversations());
    await failure; assert.equal(notified, true); assert.throws(() => chat.assertHealthy());
    await chat.close(); // Resource cleanup is still successful after abnormal failure.
  } finally { await f.auth.dispose(); }
});

test('intentional channel close does not report an abnormal failure', async () => {
  const f = await fixture();
  try {
    const chat = await f.connect(); let failed = false;
    assert.equal(typeof chat.assertHealthy, 'function'); chat.assertHealthy();
    void chat.failed.then(() => { failed = true; });
    await chat.close(); await Promise.resolve();
    assert.equal(failed, false); assert.throws(() => chat.assertHealthy());
  } finally { await f.auth.dispose(); }
});

for (const kind of ['clean', 'late-authority', 'timeout']) test(`settlement seal validates ${kind} close handshake`, async () => {
  const f = await fixture((peer, request) => {
    if (request.type !== 'close') return;
    if (kind === 'late-authority') peer.emitFrame({ type: 'control_request', runtime });
    if (kind === 'timeout') return false;
  });
  try {
    const chat = await f.connect(); await chat.start('conv-1');
    assert.equal(typeof chat.seal, 'function');
    let failed = false; void chat.failed.then(() => { failed = true; });
    if (kind === 'clean') { await chat.seal(); chat.assertSealed(); assert.equal(failed, false); }
    else { await assert.rejects(chat.seal()); assert.throws(() => chat.assertSealed()); assert.equal(failed, true); }
    await chat.close(); await chat.close();
  } finally { await f.auth.dispose(); }
});

for (const kind of ['foreign', 'authority', 'nested-authority', 'token', 'unmapped', 'shared-run', 'acceptance-only', 'settings', 'reflection', 'pin', 'flood', 'binary']) {
  test(`channel rejects ${kind} without exposing upstream details`, async () => {
    const f = await fixture((peer, request) => {
      if (kind === 'pin' && request.type === 'app_server_info') {
        peer.emitFrame({ type: 'app_server_info_response', request_id: request.request_id, success: true, ...info, backend: 'cloud' }); return false;
      }
      if (kind === 'settings' && request.type === 'runtime_start') {
        peer.emitFrame({ type: 'runtime_start_response', request_id: request.request_id, success: true, runtime,
          execution_settings: { ...request.execution_settings, tools: ['Write'] }, created: { agent: false, conversation: false } }); return false;
      }
      if (kind === 'reflection' && request.type === 'get_reflection_settings') {
        peer.emitFrame({ type: 'get_reflection_settings_response', request_id: request.request_id, success: true,
          reflection_settings: { agent_id: 'agent-1', trigger: 'step_count', step_count: 25, merge: 'explicit' } }); return false;
      }
      if (request.type !== 'input') return;
      if (kind === 'binary') { peer.emit('message', Buffer.from('{}'), true); return false; }
      if (kind === 'flood') { for (let i = 0; i < 4097; i++) peer.emitFrame({ type: 'update_queue', runtime }); return false; }
      if (kind === 'foreign') peer.emitFrame({ type: 'update_queue', runtime: { ...runtime, conversation_id: 'other' } });
      if (kind === 'authority') peer.emitFrame({ type: 'control_request', runtime, secret: 'PRIVATE_DETAIL' });
      if (kind === 'nested-authority') peer.emitFrame({ type: 'stream_delta', runtime, delta: { type: 'external_tool_call' } });
      if (kind === 'token') peer.emitFrame({ type: 'update_queue', runtime, echo: peer.options.headers.Authorization.slice(7) });
      peer.emitFrame({ type: 'input_accepted', runtime, request_id: request.request_id, accepted: true, disposition: 'started' });
      if (kind === 'unmapped') peer.emitFrame({ type: 'turn_finished', runtime, run_id: 'wrong', turn_id: 'turn-1', stop_reason: 'end_turn' });
      if (kind === 'shared-run') peer.emitFrame({ type: 'update_loop_status', runtime,
        loop_status: { client_message_ids_by_run_id: { 'run-1': [request.payload.messages[0].client_message_id, 'foreign-client'] } } });
      return false;
    });
    try {
      await assert.rejects(async () => { const chat = await f.connect(); await chat.start('conv-1'); await chat.input(randomUUID(), 'hello'); }, failure => {
        assert.ok(!failure.message.includes('PRIVATE')); assert.equal(failure.cause, undefined); return true;
      });
    } finally { await f.auth.dispose(); }
  });
}
