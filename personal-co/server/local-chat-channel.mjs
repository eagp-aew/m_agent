import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { RUNTIME_PIN } from './runtime-sandbox.mjs';
import { SYSTEM_PROMPT } from '../src/domain/policy.mjs';
import { systemForChatProjection } from './local-chat-context.mjs';

const error = () => Object.assign(new Error('Local chat channel failed.'), { code: 'CHAT_CHANNEL_FAILED' });
const check = value => { if (!value) throw error(); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value && value !== 'default';
const settings = Object.freeze({ allowed_tools: [], disallowed_tools: [], tools: [], preload_skills: [], max_turns: 2, disable_memory_guard: false });
const events = new Set(['update_device_status', 'update_loop_status', 'update_queue', 'update_subagent_state', 'stream_delta', 'turn_finished']);

/** Auth-owner internal constructor. Capability never crosses the returned
 * named-method surface. A fresh connection has one immutable Agent and at most
 * one conversation/input. No request(), raw system prompt or caller settings.
 * The caller MUST stop its owned runtime after any uncertain channel failure.
 */
export function createLocalChatConnection(url, token, onClosed, {
  WebSocketImpl, handshakeMs, requestMs, turnMs = 120000,
}, signal, binding) {
  const { agentId, stateRoot, model } = binding;
  check(id(agentId) && typeof stateRoot === 'string' && typeof model === 'string');
  check(Number.isInteger(turnMs) && turnMs > 0 && turnMs <= 120000);
  let socket; let dead = false; let opening = true; let pending; let current;
  let runtime; let created = false; let prepared = false; let started = false;
  let contextual = false; let cleared = false; let defaultsRead = false;
  let frames = 0; let bytes = 0; let closed = false; let sealing = false; let sealed = false; let closeTimer;
  let resolveOpen; let rejectOpen; let resolveClosed; let resolveFailed;
  const opened = new Promise((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject; });
  const didClose = new Promise(resolve => { resolveClosed = resolve; });
  const failed = new Promise(resolve => { resolveFailed = resolve; });
  const abort = () => fail();
  function fail(intentional = false) {
    if (dead) return;
    dead = true; clearTimeout(connectTimer); clearTimeout(closeTimer); signal?.removeEventListener('abort', abort);
    if (!intentional) resolveFailed();
    if (opening) { opening = false; rejectOpen(error()); }
    pending?.reject(error()); current?.reject(error());
    if (!closed) {
      closeTimer = setTimeout(() => resolveClosed(false), 1000);
      try { socket.terminate(); } catch { resolveClosed(false); }
    }
  }
  const connectTimer = setTimeout(fail, handshakeMs);
  try {
    socket = new WebSocketImpl(url, { headers: { Authorization: `Bearer ${token}` }, agent: false,
      followRedirects: false, maxRedirects: 0, handshakeTimeout: handshakeMs, closeTimeout: 1000,
      maxPayload: 1048576, maxFragments: 64, maxBufferedChunks: 64,
      perMessageDeflate: false, skipUTF8Validation: false, autoPong: true });
  } catch { clearTimeout(connectTimer); throw error(); }
  socket.on('open', () => { if (!dead) { opening = false; clearTimeout(connectTimer); resolveOpen(); } });
  socket.on('error', () => fail());
  socket.on('close', code => {
    closed = true; clearTimeout(closeTimer);
    if (sealing && !dead && code === 1000) { sealed = true; dead = true; signal?.removeEventListener('abort', abort); }
    else fail();
    resolveClosed(true); onClosed();
  });
  socket.on('unexpected-response', (request, response) => { fail(); response.destroy(); request.destroy(); });
  function correlate(message) {
    if (!current) { check(message.type !== 'turn_finished'); return; }
    if (message.type === 'input_accepted') {
      check(!current.accepted && message.accepted === true && ['started', 'queued'].includes(message.disposition));
      current.accepted = true;
    } else if (message.type === 'update_loop_status') {
      check(object(message.loop_status));
      const map = message.loop_status.client_message_ids_by_run_id ?? {};
      check(object(map) && Object.keys(map).length <= 64);
      for (const [run, ids] of Object.entries(map)) {
        check(id(run) && Array.isArray(ids) && ids.length <= 64 && ids.every(id) && new Set(ids).size === ids.length);
        if (ids.includes(current.clientId)) { check(ids.length === 1); current.runs.add(run); }
      }
      check(current.runs.size <= 64);
    } else if (message.type === 'turn_finished') {
      check(!current.terminal && id(message.run_id) && id(message.turn_id)
        && ['end_turn', 'max_steps', 'max_turns', 'error', 'cancelled', 'max_tokens', 'stop_sequence', 'requires_approval'].includes(message.stop_reason));
      current.terminal = Object.freeze({ runId: message.run_id, turnId: message.turn_id,
        stopReason: message.stop_reason, error: Boolean(message.error) });
    }
    if (current.accepted && current.terminal && current.runs.has(current.terminal.runId)) current.resolve(current.terminal);
  }
  socket.on('message', (data, binary) => {
    if (dead) return;
    try {
      check(!binary && ++frames <= 4096 && Buffer.byteLength(data) <= 1048576 && (bytes += Buffer.byteLength(data)) <= 4194304);
      const message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data));
      check(object(message) && typeof message.type === 'string' && !JSON.stringify(message).includes(token));
      if (message.runtime !== undefined) check(runtime && isDeepStrictEqual(message.runtime, runtime));
      if (message.seq !== undefined) check(Number.isSafeInteger(message.seq) && message.seq >= 0);
      // Native parser does not accept application ACKs. ws handles ping/pong.
      if (pending && message.request_id === pending.id) {
        check(message.type === pending.response && (message.type === 'input_accepted' ? message.accepted === true : message.success === true));
        if (message.type === 'input_accepted') { check(isDeepStrictEqual(message.runtime, runtime)); correlate(message); }
        pending.resolve(message);
      } else {
        check(events.has(message.type) && runtime && isDeepStrictEqual(message.runtime, runtime));
        if (message.type === 'stream_delta') check(object(message.delta)
          && !['control_request', 'approval', 'external_tool_call'].includes(message.delta.type));
        correlate(message);
      }
    } catch { fail(); }
  });
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) fail();
  async function rpc(type, fields = {}, requestId = randomUUID()) {
    check(!dead && !sealing && !pending && !signal?.aborted);
    let timer;
    try {
      return await new Promise((resolve, reject) => {
        pending = { id: requestId, response: type === 'input' ? 'input_accepted' : `${type}_response`, resolve, reject };
        timer = setTimeout(fail, requestMs);
        const payload = JSON.stringify({ type, request_id: requestId, ...fields });
        // A valid 16 KiB UTF-8 user string can expand sixfold as JSON escapes.
        check(Buffer.byteLength(payload) <= 131072 && (socket.bufferedAmount ?? 0) <= 131072);
        socket.send(payload, failure => { if (failure) fail(); });
      });
    } catch { fail(); throw error(); }
    finally { clearTimeout(timer); pending = undefined; }
  }
  const client = Object.freeze({
    closed: didClose,
    failed,
    assertHealthy() { check(!dead && !signal?.aborted); },
    assertSealed() { check(sealed && !signal?.aborted); },
    async seal() {
      check(!dead && !sealing && !pending && !signal?.aborted);
      sealing = true;
      // Drain and validate inbound frames through the peer's close handshake.
      // A local terminate would discard late faults after the final read RPC.
      closeTimer = setTimeout(() => fail(), 1000);
      try { socket.close(1000); } catch { fail(); }
      check(await didClose); client.assertSealed();
    },
    async verify() {
      const info = await rpc('app_server_info');
      check(info.backend === 'local' && info.letta_code_version === RUNTIME_PIN.version && info.protocol_version === 1
        && info.capabilities?.agent_management === true && info.capabilities?.conversation_management === true
        && info.capabilities?.runtime_start === true);
    },
    async readModelDefaults() {
      check(!defaultsRead && !prepared && !created && !started); defaultsRead = true;
      const admit = value => { if (!value) throw Object.assign(error(), { code: 'PREDISPATCH' }); };
      const handle = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
      let refreshed;
      // The pinned headless runtime can return mixed availability/catalog state
      // during forced discovery. Await its full refresh barrier before reading
      // the settled snapshot. Invalid refresh evidence must never fall back to cache.
      for (const force of [true, false]) {
        const result = await rpc('list_models', { force });
        admit(Array.isArray(result.entries) && result.entries.length <= 512
          && result.entries.every(entry => object(entry) && handle(entry.handle))
          && Array.isArray(result.available_handles) && result.available_handles.length <= 512
          && result.available_handles.every(handle) && (force || result.available_handles.includes(model)));
        const matches = result.entries.filter(entry => entry.handle === model); admit(matches.length > 0);
        let defaults;
        for (const entry of matches) {
          const args = entry.updateArgs;
          admit(object(args) && args.provider_type === 'lmstudio_openai'
            && Number.isInteger(args.context_window) && args.context_window > 0 && args.context_window <= 128000
            && args.max_output_tokens === Math.min(32000, args.context_window));
          const projected = { provider_type: args.provider_type, context_window_limit: args.context_window, max_tokens: args.max_output_tokens };
          admit(defaults === undefined || isDeepStrictEqual(defaults, projected)); defaults = projected;
        }
        if (force) refreshed = defaults;
        else admit(isDeepStrictEqual(refreshed, defaults));
      }
      // Catalog reasoning/tool options are not settings or write-body authority.
      return Object.freeze(refreshed);
    },
    async readAgent() { return (await rpc('agent_retrieve', { agent_id: agentId })).agent; },
    async readConversation(conversationId) {
      check(id(conversationId)); return (await rpc('conversation_retrieve', { conversation_id: conversationId })).conversation;
    },
    async listConversations() {
      return (await rpc('conversation_list', { query: { agent_id: agentId, limit: 100 } })).conversations;
    },
    async history(conversationId, before) {
      check(id(conversationId) && (before === undefined || typeof before === 'string' && before.length <= 320));
      return rpc('conversation_messages_list', { conversation_id: conversationId,
        query: { agent_id: agentId, limit: 20, order: 'desc', ...(before === undefined ? {} : { before }) } });
    },
    async prepareAgent(projection) {
      check(!prepared); prepared = true;
      const system = systemForChatProjection(projection); contextual = system !== SYSTEM_PROMPT;
      await rpc('agent_update', { agent_id: agentId, body: { system, model, tools: [] } });
      const agent = await client.readAgent();
      check(agent?.id === agentId && agent.system === system && agent.model === model
        && Array.isArray(agent.tools) && agent.tools.length === 0);
      return agent;
    },
    async clearContext() {
      check(prepared && contextual && !cleared && current?.accepted && current.terminal?.stopReason === 'end_turn'
        && !current.terminal.error && current.runs.has(current.terminal.runId));
      cleared = true;
      await rpc('agent_update', { agent_id: agentId, body: { system: SYSTEM_PROMPT } });
      const agent = await client.readAgent();
      check(agent?.id === agentId && agent.system === SYSTEM_PROMPT && agent.model === model
        && Array.isArray(agent.tools) && agent.tools.length === 0);
      return agent;
    },
    async createConversation(title, operationTag) {
      check(!created && typeof title === 'string' && Buffer.byteLength(title) <= 256
        && /^personal-co-operation-v1-[0-9a-f-]{36}$/.exec(operationTag)?.[0] === operationTag);
      created = true;
      return (await rpc('conversation_create', { body: { agent_id: agentId, summary: title,
        tags: ['personal-co-retained-v1', operationTag], model } })).conversation;
    },
    async start(conversationId) {
      check(!started && id(conversationId)); started = true;
      runtime = Object.freeze({ agent_id: agentId, conversation_id: conversationId });
      const result = await rpc('runtime_start', { ...runtime, cwd: stateRoot, mode: 'strict', execution_settings: settings,
        skill_sources: [], external_tools: [], recover_approvals: false, wait_for_replay: true });
      check(isDeepStrictEqual(result.runtime, runtime) && isDeepStrictEqual(result.execution_settings, settings)
        && result.created?.agent === false && result.created?.conversation === false);
      const changed = await rpc('set_reflection_settings', { runtime, scope: 'local_project', settings: { trigger: 'off', step_count: 25, merge: 'explicit' } });
      check(changed.scope === 'local_project');
      const read = await rpc('get_reflection_settings', { runtime });
      check(read.reflection_settings?.agent_id === agentId && read.reflection_settings.trigger === 'off'
        && read.reflection_settings.step_count === 25 && read.reflection_settings.merge === 'explicit');
    },
    async input(clientId, text) {
      check(runtime && !current && /^[0-9a-f-]{36}$/.exec(clientId)?.[0] === clientId
        && typeof text === 'string' && Buffer.byteLength(text) <= 16384);
      let timer;
      const completion = new Promise((resolve, reject) => {
        current = { clientId, resolve, reject, accepted: false, runs: new Set(), terminal: null };
        timer = setTimeout(fail, turnMs);
      });
      void completion.catch(() => {});
      try {
        await rpc('input', { runtime, payload: { kind: 'create_message', messages: [{ role: 'user', content: text, client_message_id: clientId }],
          client_tool_allowlist: [], client_toolset: { base: 'none', include: [] }, external_tool_scope_ids: [], exclude_interactive_tools: true } });
        return await completion;
      } finally { clearTimeout(timer); }
    },
    async close() { fail(true); check(await didClose); },
  });
  return { opened, client };
}
