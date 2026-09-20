import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import WebSocket from 'ws';
import { createRuntimeSandbox, RUNTIME_PIN } from './runtime-sandbox.mjs';
import { startOwned, validateEndpoint, listenerGone } from './runtime-process.mjs';
import { prepareAssistantBootstrap } from './assistant-bootstrap.mjs';
import { openCanonicalMemoryStore, CANONICAL_MEMORY_FILE } from './canonical-memory-store.mjs';
import { decodeAppServerMemory } from '../src/domain/app-server-memory-codec.mjs';
import { SYSTEM_PROMPT } from '../src/domain/policy.mjs';

const MODEL = 'lmstudio/synthetic';
const MARKER = 'WP0050_SYNTHETIC_CANONICAL_CONTEXT';
const USER = 'WP0050_SYNTHETIC_USER';
const REPLY = 'WP0050_SYNTHETIC_REPLY';
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Object.assign(new Error('Synthetic turn probe failed.'), { code }); };
const check = (value, code = 'PROTOCOL') => { if (!value) fail(code); };
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value && value !== 'default';
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function bounded(work, ms, signal) {
  check(!signal?.aborted, 'ABORTED');
  let timer; let abort;
  try { return await Promise.race([work, new Promise((_, reject) => {
    const rejectCode = code => reject(Object.assign(new Error('Synthetic turn probe failed.'), { code }));
    timer = setTimeout(() => rejectCode('TIMEOUT'), ms);
    abort = () => rejectCode('ABORTED'); signal?.addEventListener('abort', abort, { once: true });
  })]); } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

// Pure probe-only derivation. Baseline grants remain byte-for-byte intact.
export function deriveProbeSpec(base, port, tokenDigest) {
  check(Number.isInteger(port) && port > 0 && port <= 65535 && /^[a-f0-9]{64}$/.test(tokenDigest), 'CONFIG');
  check(base.command === '/usr/bin/sandbox-exec' && base.args[0] === '-p' && base.args[1] === base.profile, 'CONFIG');
  const profile = `${base.profile}(allow network-outbound (remote ip "localhost:${port}"))\n`;
  return Object.freeze({ ...base, profile, profileSha256: hash(profile),
    args: Object.freeze(['-p', profile, ...base.args.slice(2), '--ws-auth', 'capability-token', '--ws-token-sha256', tokenDigest]),
    options: Object.freeze({ ...base.options, env: Object.freeze({ ...base.options.env, LMSTUDIO_BASE_URL: `http://127.0.0.1:${port}/v1` }) }) });
}

/** Owned deterministic local endpoint, not a proxy/model server. No import I/O.
 * Exposed only for controlled tests; arm() admits one bounded synthetic turn.
 * Body contents never leave this closure or appear in diagnostics. */
export async function startSyntheticProvider(canaryPath) {
  check(typeof canaryPath === 'string' && /^\/private\/tmp\/personal-co-wp0050-[^/]+\/state\/negative-canary$/.test(canaryPath), 'CONFIG');
  let armed; let count = 0; let inference = 0; let problem; let closing; let expectedContext;
  const sockets = new Set(); const observations = [];
  let notify; const failed = new Promise(resolve => { notify = resolve; });
  const fault = code => { problem ??= code; notify(code); };
  const server = createServer({ maxHeaderSize: 4096, requestTimeout: 2000, headersTimeout: 2000, keepAliveTimeout: 100 }, (req, res) => {
    void (async () => {
      const timer = setTimeout(() => req.destroy(), 2000);
      try {
        check(++count <= 32 && !problem && !req.headers.authorization && !req.headers.cookie, 'PROVIDER_AUTH_OR_LIMIT');
        check(req.headers.host === `127.0.0.1:${server.address().port}`, 'PROVIDER_ROUTE');
        if (req.method === 'GET' && ['/api/v0/models', '/v1/models'].includes(req.url)) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [{ id: 'synthetic', object: 'model', type: 'llm', state: 'loaded', max_context_length: 128000 }] })); return;
        }
        check(req.method === 'POST' && req.url === '/v1/chat/completions' && armed && armed.remaining > 0, 'UNEXPECTED_INFERENCE');
        let size = 0; const chunks = [];
        for await (const chunk of req) { size += chunk.length; check(size <= 262144, 'PROVIDER_BODY_LIMIT'); chunks.push(chunk); }
        const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        check(body.model === 'synthetic' && body.stream === true && Array.isArray(body.messages) && body.messages.length <= 64
          && (body.tools === undefined || Array.isArray(body.tools) && body.tools.length === 0)
          && (body.functions === undefined || Array.isArray(body.functions) && body.functions.length === 0), 'PROVIDER_CONTRACT');
        const system = body.messages.filter(row => row.role === 'system').map(row => typeof row.content === 'string' ? row.content : '').join('\n');
        check(expectedContext && system.includes(expectedContext) && system.includes(MARKER) && system.includes('MEMORY_POLICY') && system.length <= 131072, 'CONTEXT_MISSING');
        check(!body.messages.some(row => row.role === 'user' && JSON.stringify(row.content).includes(MARKER)), 'CONTEXT_USER_ROW');
        const malicious = armed.mode === 'malicious' && armed.remaining === 2;
        armed.remaining--; inference++;
        observations.push(Object.freeze({ systemHash: hash(system), marker: true, tools: 0, authorization: false, malicious }));
        const delta = malicious ? { role: 'assistant', tool_calls: [{ index: 0, id: 'call-wp0050', type: 'function',
          function: { name: 'Write', arguments: JSON.stringify({ file_path: canaryPath, content: 'MUTATED' }) } }] }
          : { role: 'assistant', content: REPLY };
        const chunk = (delta, finish_reason) => ({ id: 'chatcmpl-wp0050', object: 'chat.completion.chunk', created: 1,
          model: 'synthetic', choices: [{ index: 0, delta, finish_reason }] });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' });
        res.end(`data: ${JSON.stringify(chunk(delta, null))}\n\ndata: ${JSON.stringify(chunk({}, malicious ? 'tool_calls' : 'stop'))}\n\ndata: [DONE]\n\n`);
      } catch (error) {
        fault(['PROVIDER_AUTH_OR_LIMIT', 'PROVIDER_ROUTE', 'UNEXPECTED_INFERENCE', 'PROVIDER_BODY_LIMIT', 'PROVIDER_CONTRACT', 'CONTEXT_MISSING', 'CONTEXT_USER_ROW'].includes(error.code) ? error.code : 'PROVIDER_MALFORMED');
        if (!res.headersSent) { res.writeHead(400, { Connection: 'close' }); res.end(); } else res.destroy();
      } finally { clearTimeout(timer); }
    })();
  });
  server.maxConnections = 4; server.maxRequestsPerSocket = 16;
  server.on('connection', socket => { sockets.add(socket); socket.setTimeout(2000, () => socket.destroy()); socket.on('close', () => sockets.delete(socket)); });
  server.on('clientError', (_error, socket) => { fault('PROVIDER_MALFORMED'); socket.destroy(); });
  server.on('error', () => fault('PROVIDER_FAILED'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return Object.freeze({ port: server.address().port, failed,
    expectContext(text) { check(!expectedContext && typeof text === 'string' && text.length <= 32768 && text.includes(MARKER), 'PROVIDER_CONTRACT'); expectedContext = text; },
    arm(mode) { check(['normal', 'malicious'].includes(mode) && !problem, 'PROVIDER_CONTRACT'); armed = { mode, remaining: mode === 'malicious' ? 2 : 1 }; },
    disarm() { armed = undefined; check(!problem, problem); },
    evidence() { check(!problem, problem); return { requests: count, inference, observations: [...observations] }; },
    close() { closing ??= bounded(new Promise(resolve => { server.close(error => resolve(!error)); for (const socket of sockets) socket.destroy(); }), 2000).catch(() => false); return closing; },
  });
}

/** Pure bounded protocol reducer used by the private socket and unit tests.
 * One input can span several backend runs before one listener terminal.
 * Acceptance, run mapping and terminal may arrive in either order. No stream
 * text constitutes durable success. All runtime-scoped messages must match. */
export function createTurnEvidence(runtime, clientId, requestId) {
  check(id(runtime.agent_id) && id(runtime.conversation_id) && id(clientId) && id(requestId));
  let accepted = false; let terminal; let frames = 0; const runIds = new Set();
  return Object.freeze({
    accept(message) {
      check(++frames <= 2048 && record(message));
      if (['input_accepted', 'update_loop_status', 'turn_finished'].includes(message.type)) check(record(message.runtime), 'FOREIGN_RUNTIME');
      if (message.runtime) check(message.runtime.agent_id === runtime.agent_id && message.runtime.conversation_id === runtime.conversation_id, 'FOREIGN_RUNTIME');
      if (message.type === 'input_accepted') {
        check(message.request_id === requestId && message.accepted === true && ['started', 'queued'].includes(message.disposition) && !accepted, 'INVALID_ACCEPTANCE'); accepted = true;
      } else if (message.type === 'update_loop_status') {
        check(record(message.loop_status));
        const map = message.loop_status.client_message_ids_by_run_id ?? {};
        check(record(map) && Object.keys(map).length <= 64);
        for (const [key, ids] of Object.entries(map)) {
          check(id(key) && Array.isArray(ids) && ids.length <= 64 && ids.every(id) && new Set(ids).size === ids.length);
          if (ids.includes(clientId)) {
            runIds.add(key); check(runIds.size <= 64, 'RUN_LIMIT');
          }
        }
      } else if (message.type === 'turn_finished') {
        check(id(message.run_id) && id(message.turn_id) && ['end_turn', 'max_steps', 'max_turns', 'error', 'cancelled', 'max_tokens', 'stop_sequence', 'requires_approval'].includes(message.stop_reason)
          && !terminal, 'INVALID_TERMINAL');
        terminal = { runId: message.run_id, turnId: message.turn_id, stopReason: message.stop_reason, error: Boolean(message.error) };
      }
      return accepted && terminal && runIds.has(terminal.runId) ? Object.freeze({ accepted, ...terminal }) : null;
    },
  });
}

// Not exported: never a product RPC API. Only the fixed journey below can send.
async function connectProbe(endpoint, token, signal, requestMs, turnMs) {
  validateEndpoint(endpoint);
  const socket = new WebSocket(endpoint, { headers: { Authorization: `Bearer ${token}` }, agent: false,
    followRedirects: false, maxRedirects: 0, handshakeTimeout: requestMs, closeTimeout: 1000,
    maxPayload: 1048576, maxFragments: 64, maxBufferedChunks: 64, perMessageDeflate: false, autoPong: true });
  let dead; let frames = 0; let bytes = 0; let pending; let current; let runtime; let created = false; let frameType;
  let resolveClosed; let closeTimer;
  const closed = new Promise(resolve => { resolveClosed = resolve; });
  const failure = code => {
    if (dead) return; dead = code; pending?.reject(Object.assign(new Error('Synthetic turn probe failed.'), { code, frameType }));
    current?.reject(Object.assign(new Error('Synthetic turn probe failed.'), { code, frameType })); socket.terminate();
    closeTimer = setTimeout(() => resolveClosed(false), 1000);
  };
  const abort = () => failure('ABORTED'); signal.addEventListener('abort', abort, { once: true });
  socket.on('close', () => { failure('SOCKET_CLOSED'); clearTimeout(closeTimer); signal.removeEventListener('abort', abort); resolveClosed(true); });
  socket.on('error', () => failure('SOCKET_FAILED'));
  const send = message => { check(!dead && socket.readyState === WebSocket.OPEN, dead ?? 'SOCKET_CLOSED');
    const text = JSON.stringify(message); check(Buffer.byteLength(text) <= 65536 && socket.bufferedAmount <= 65536, 'SEND_LIMIT');
    socket.send(text, error => { if (error) failure('SEND_FAILED'); }); };
  const events = new Set(['update_device_status', 'update_loop_status', 'update_queue', 'update_subagent_state', 'stream_delta', 'turn_finished']);
  socket.on('message', (data, binary) => {
    try {
      check(!binary && ++frames <= 4096 && (bytes += data.length) <= 4194304, 'FRAME_LIMIT');
      const message = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data)); check(record(message) && typeof message.type === 'string');
      frameType = /^[a-z_]{1,40}$/.test(message.type) ? message.type : 'unrecognized';
      if (message.runtime) check(runtime && message.runtime.agent_id === runtime.agent_id && message.runtime.conversation_id === runtime.conversation_id, 'FOREIGN_RUNTIME');
      if (message.seq !== undefined) { check(Number.isSafeInteger(message.seq) && message.seq >= 0, 'INVALID_SEQUENCE'); send({ type: 'ack', seq: message.seq }); }
      check(!['control_request', 'approval', 'external_tool_call'].includes(message.type), 'UNSOLICITED_AUTHORITY');
      if (pending && message.request_id === pending.id) {
        check(message.type === pending.response && (message.type === 'input_accepted' ? message.accepted === true : message.success === true), 'RPC_REJECTED');
        if (message.type === 'input_accepted' && current) current.result = current.evidence.accept(message);
        pending.resolve(message);
      } else {
        check(events.has(message.type) && runtime && record(message.runtime), 'UNEXPECTED_FRAME');
        if (message.type === 'stream_delta') check(record(message.delta) && !['control_request', 'approval'].includes(message.delta.type), 'UNSOLICITED_AUTHORITY');
        if (current) current.result = current.evidence.accept(message) ?? current.result;
      }
      if (current?.result) current.resolve(current.result);
    } catch (error) { failure(['FOREIGN_RUNTIME', 'FRAME_LIMIT', 'UNSOLICITED_AUTHORITY', 'RUN_LIMIT', 'INVALID_TERMINAL', 'RPC_REJECTED'].includes(error.code) ? error.code : 'PROTOCOL'); }
  });
  try { await bounded(new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); socket.once('close', () => reject(new Error())); }), requestMs, signal); }
  catch { failure('CONNECT_FAILED'); await closed; fail('CONNECT_FAILED'); }
  const allowed = new Set(['app_server_info', 'agent_list', 'agent_retrieve', 'agent_create', 'agent_update', 'conversation_create',
    'conversation_retrieve', 'conversation_messages_list', 'runtime_start', 'set_reflection_settings', 'get_reflection_settings', 'input']);
  async function request(type, fields = {}, forcedId) {
    check(allowed.has(type) && !pending && !dead, 'COMMAND');
    const requestId = forcedId ?? randomUUID();
    try {
      return await bounded(new Promise((resolve, reject) => {
        pending = { id: requestId, response: type === 'input' ? 'input_accepted' : `${type}_response`, resolve, reject };
        send({ type, request_id: requestId, ...fields });
      }), requestMs, signal);
    } catch (error) { failure(error.code ?? 'RPC_FAILED'); throw error; }
    finally { pending = undefined; }
  }
  return {
    request,
    createAssistantAgent(marker) {
      check(!created && /^personal-co-bootstrap-v1-[a-f0-9]{32}$/.test(marker), 'CREATE_REPLAY'); created = true;
      return request('agent_create', { body: { name: 'Personal Co', system: SYSTEM_PROMPT, tags: ['personal-co-v1', marker], tools: [], memory_blocks: [] } });
    },
    bind(value) { check(!runtime && id(value.agent_id) && id(value.conversation_id)); runtime = Object.freeze({ ...value }); },
    async input(clientId, text, acceptedOnly = false) {
      check(runtime && !current && id(clientId) && [USER, 'WP0050_SYNTHETIC_ATTACK'].includes(text));
      const requestId = randomUUID(); let completion;
      if (!acceptedOnly) {
        completion = new Promise((resolve, reject) => { current = { resolve, reject, evidence: createTurnEvidence(runtime, clientId, requestId) }; });
        void completion.catch(() => {});
      }
      try {
        const accepted = await request('input', { runtime, payload: { kind: 'create_message', messages: [{ role: 'user', content: text, client_message_id: clientId }],
          client_tool_allowlist: [], client_toolset: { base: 'none', include: [] }, external_tool_scope_ids: [], exclude_interactive_tools: true } }, requestId);
        if (acceptedOnly) return { accepted: accepted.accepted };
        return await bounded(completion, turnMs, signal);
      } catch (error) { failure(error.code ?? 'TURN_FAILED'); throw error; }
      finally { current = undefined; }
    },
    async close() { failure('CLOSED'); return closed; },
  };
}

const settings = Object.freeze({ allowed_tools: [], disallowed_tools: [], tools: [], preload_skills: [], max_turns: 2, disable_memory_guard: false });
const plainText = content => typeof content === 'string' ? content : Array.isArray(content)
  ? content.filter(part => part?.type === 'text').map(part => part.text).join('') : '';
// Pinned0.32.5 prependReminderPartsToContent preserves the original string as
// the final text part. Fresh listen sessions prepend session/agent/MCP parts
// in catalog order. This synthetic-only oracle never strips user-authored tags
// or treats a tag as authority; the caller still requires exact OTID/ownership.
function persistedProbeUser(content) {
  if (typeof content === 'string') return content === USER;
  if (!Array.isArray(content) || content.length < 1 || content.length > 4
    || !content.every(part => part?.type === 'text' && typeof part.text === 'string' && part.text.length <= 8192)
    || content.at(-1).text !== USER) return false;
  let previous = -1;
  return content.slice(0, -1).every(part => {
    const match = /^<system-reminder>([\s\S]+)<\/system-reminder>$/.exec(part.text);
    if (!match || match[0] !== part.text || /<\/?system-reminder>/.test(match[1])
      || part.text.includes(USER) || part.text.includes(MARKER)) return false;
    const kind = [
      match[1].startsWith("\nThis is an automated message providing context about the user's environment.\n"),
      match[1].startsWith(' This is an automated message providing information about you.\n'),
      match[1] === '\nMCP servers with available tools: None\n',
    ].indexOf(true);
    if (kind <= previous) return false;
    previous = kind; return true;
  });
}

/** Synthetic-only opt-in harness. Owns fresh fixtures and at most one runtime
 * at a time, never adopts existing state, never retries an uncertain write.
 * Trusted seams are solely for controlled tests; no raw socket/RPC/token output.
 * No browser integration, provider credentials, actual model or production API.
 */
export async function probeLocalChatTurn({ dependencyRoot, signal, observe = () => {} } = {}, {
  makeSandbox = createRuntimeSandbox, startProcess = startOwned, requestMs = 5000, turnMs = 15000,
  prepareBootstrap = prepareAssistantBootstrap, openStore = openCanonicalMemoryStore,
} = {}) {
  check(typeof dependencyRoot === 'string' && (signal === undefined || signal instanceof AbortSignal)
    && Number.isInteger(requestMs) && requestMs > 0 && requestMs <= 5000 && Number.isInteger(turnMs) && turnMs > 0 && turnMs <= 15000, 'CONFIG');
  const lifetime = new AbortController(); const abort = () => lifetime.abort(); signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort(); const deadline = setTimeout(abort, 90000);
  let stage = 'fixture'; let provider; let preparation; let child; let channel; let endpoint; let store; let root; let canonicalHash;
  let agentId; let conversationId; let result; let problem; const cleanups = []; const events = [];
  const emit = event => { const safe = Object.freeze(event); events.push(safe); try { observe(safe); } catch { /* Diagnostics never control ownership. */ } };
  const pendingIO = new Set(); let ioUncertain = false;
  async function io(work, disposeLate) {
    // The promise may already own a handle before an abort becomes observable;
    // always register late cleanup even when cancellation already happened.
    const tracked = Promise.resolve(work).then(async value => {
      if (lifetime.signal.aborted) {
        if (disposeLate) try { await disposeLate(value); } catch { ioUncertain = true; }
        fail('ABORTED');
      }
      return value;
    });
    pendingIO.add(tracked); void tracked.finally(() => pendingIO.delete(tracked)).catch(() => {});
    try { return await bounded(tracked, 15000, lifetime.signal); }
    catch (error) { if (pendingIO.has(tracked)) ioUncertain = true; throw error; }
  }
  async function stopRuntime() {
    const evidence = { socketClosed: true, preparationClosed: true, processReaped: true, listenerGone: true };
    const c = channel; channel = undefined;
    if (c) evidence.socketClosed = await c.close().catch(() => false);
    const p = preparation; preparation = undefined;
    if (p) evidence.preparationClosed = await bounded(p.close().then(() => true), 3000).catch(() => false);
    const owned = child; child = undefined;
    if (owned) {
      try { const stopped = await bounded(owned.stop(), 5000); evidence.processReaped = stopped.reaped === true && stopped.groupGone === true; emit({ phase: 'stopped', pid: stopped.pid, reaped: evidence.processReaped }); }
      catch { evidence.processReaped = false; }
    }
    const url = endpoint; endpoint = undefined;
    if (url) evidence.listenerGone = await listenerGone(url).catch(() => false);
    cleanups.push(evidence); check(Object.values(evidence).every(Boolean), 'CLEANUP_FAILED');
  }
  try {
    check(!lifetime.signal.aborted, 'ABORTED');
    root = await io(fs.realpath(await io(fs.mkdtemp('/private/tmp/personal-co-wp0050-'))));
    const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
    await io(fs.mkdir(stateRoot, { mode: 0o700 })); await io(fs.mkdir(protectedRoot, { mode: 0o700 }));
    const roots = { dependencyRoot, stateRoot, protectedRoot }; const canonicalPath = path.join(protectedRoot, CANONICAL_MEMORY_FILE);
    const canaryPath = path.join(stateRoot, 'negative-canary');
    provider = await io(startSyntheticProvider(canaryPath), item => item.close()); void provider.failed.then(abort);
    emit({ phase: 'fixture', root, providerPort: provider.port });
    const baseline = await io(makeSandbox(roots));
    async function boot() {
      stage = 'bootstrap_prepare'; preparation = await io(prepareBootstrap(roots, { signal: lifetime.signal }), item => item.close());
      check(!lifetime.signal.aborted, 'ABORTED');
      const token = randomBytes(32).toString('hex'); const spec = deriveProbeSpec(baseline, provider.port, hash(token));
      stage = 'spawn'; child = startProcess(spec); const thisChild = child;
      void child.failed.then(() => { if (child === thisChild) abort(); });
      endpoint = await bounded(child.endpoint(), 15000, lifetime.signal); emit({ phase: 'started', pid: child.pid, port: Number(new URL(endpoint).port), profileHash: spec.profileSha256 });
      stage = 'connect'; channel = await connectProbe(endpoint, token, lifetime.signal, requestMs, turnMs);
      const info = await channel.request('app_server_info'); check(info.letta_code_version === RUNTIME_PIN.version && info.backend === 'local' && info.protocol_version === 1, 'PIN');
      stage = 'bootstrap_resolve'; const identity = await io(preparation.resolve({
        request: (type, fields) => channel.request(type, fields), createAssistantAgent: marker => channel.createAssistantAgent(marker),
      }));
      check(id(identity.agentId) && (!agentId || agentId === identity.agentId), 'IDENTITY'); agentId = identity.agentId;
      await io(preparation.close()); preparation = undefined;
    }
    async function history() {
      const response = await channel.request('conversation_messages_list', { conversation_id: conversationId, query: { agent_id: agentId, limit: 100, order: 'asc' } });
      check(Array.isArray(response.messages) && response.messages.length <= 100 && response.has_more === false, 'HISTORY');
      check(response.messages.every(row => row.agent_id === agentId && row.conversation_id === conversationId), 'FOREIGN_HISTORY');
      check(!response.messages.some(row => row.message_type === 'user_message' && plainText(row.content).includes(MARKER)), 'CONTEXT_USER_ROW');
      return response.messages;
    }
    async function canonicalUnchanged() { check(hash(await io(fs.readFile(canonicalPath))) === canonicalHash, 'CANONICAL_CHANGED'); }
    async function startRuntime() {
      const runtime = { agent_id: agentId, conversation_id: conversationId }; channel.bind(runtime);
      const start = await channel.request('runtime_start', { ...runtime, cwd: stateRoot, mode: 'strict', execution_settings: settings,
        skill_sources: [], external_tools: [], recover_approvals: false, wait_for_replay: true });
      check(isDeepStrictEqual(start.runtime, runtime) && isDeepStrictEqual(start.execution_settings, settings)
        && start.created?.agent === false && start.created?.conversation === false, 'START_CONTRACT');
      const changed = await channel.request('set_reflection_settings', { runtime, scope: 'local_project', settings: { trigger: 'off', step_count: 25, merge: 'explicit' } });
      check(changed.scope === 'local_project', 'REFLECTION');
      const read = await channel.request('get_reflection_settings', { runtime });
      check(read.reflection_settings?.agent_id === agentId && read.reflection_settings.trigger === 'off'
        && read.reflection_settings.step_count === 25 && read.reflection_settings.merge === 'explicit', 'REFLECTION');
      provider.disarm();
    }
    await boot(); stage = 'canonical';
    store = await io(openStore({ directory: protectedRoot, agentId }), item => item.close());
    const initial = await io(store.read()); const candidate = { ...initial, revision: initial.revision + 1,
      blocks: initial.blocks.map(block => block.label === 'CURRENT_CONTEXT' ? { ...block, value: MARKER } : block) };
    const memory = await io(store.commit(candidate, { expectedRevision: initial.revision })); await io(store.close()); store = undefined;
    const bytes = await io(fs.readFile(canonicalPath)); decodeAppServerMemory(bytes.toString(), agentId); canonicalHash = hash(bytes);
    const projection = `${SYSTEM_PROMPT}\n\nHOST CANONICAL SNAPSHOT\n${memory.blocks.map(block => `[${block.label}]\n${block.value}`).join('\n\n')}`;
    check(projection.length <= 32768, 'CONTEXT_LIMIT');
    provider.expectContext(projection);
    stage = 'projection'; await channel.request('agent_update', { agent_id: agentId, body: { system: projection, model: MODEL, tools: [] } });
    const agent = (await channel.request('agent_retrieve', { agent_id: agentId })).agent;
    check(agent?.id === agentId && agent.system === projection && agent.model === MODEL, 'PROJECTION_READBACK');
    stage = 'conversation_intent'; const operationId = randomUUID();
    const intent = await io(fs.open(path.join(root, 'conversation-intent.json'), 'wx', 0o600), item => item.close());
    try { await io(intent.writeFile(JSON.stringify({ operationId, agentId, tag: `wp0050-${operationId}` }))); await io(intent.sync()); } finally { await bounded(intent.close(), 1000); }
    const directory = await io(fs.open(root, 'r'), item => item.close()); try { await io(directory.sync()); } finally { await bounded(directory.close(), 1000); }
    stage = 'conversation_create'; const conversation = (await channel.request('conversation_create', { body: {
      agent_id: agentId, summary: 'WP0050 synthetic retained conversation', tags: ['personal-co-retained-v1', `wp0050-${operationId}`], model: MODEL,
    } })).conversation;
    check(id(conversation?.id) && conversation.agent_id === agentId && conversation.tags?.includes(`wp0050-${operationId}`), 'CONVERSATION'); conversationId = conversation.id;
    await io(fs.writeFile(canaryPath, 'UNCHANGED', { flag: 'wx', mode: 0o600 }));
    stage = 'runtime_start'; await startRuntime(); const clientId = randomUUID();
    stage = 'normal_turn'; provider.arm('normal'); const first = await channel.input(clientId, USER); provider.disarm();
    check(!first.error && first.stopReason === 'end_turn', 'TURN_TERMINAL');
    let rows = await history();
    const users = rows => rows.filter(row => row.message_type === 'user_message' && row.otid === clientId && persistedProbeUser(row.content));
    const replies = rows => rows.filter(row => row.message_type === 'assistant_message' && plainText(row.content) === REPLY);
    check(users(rows).length === 1 && replies(rows).length === 1, 'DURABILITY'); await canonicalUnchanged();
    stage = 'same_runtime_dedupe'; const beforeDedupe = provider.evidence().inference;
    await channel.input(clientId, USER, true); await bounded(sleep(250), 1000, lifetime.signal);
    rows = await history(); check(users(rows).length === 1 && replies(rows).length === 1 && provider.evidence().inference === beforeDedupe, 'DEDUPE');
    const durableHash = hash(JSON.stringify(rows)); await stopRuntime();
    stage = 'reopen'; await boot();
    const restored = (await channel.request('conversation_retrieve', { conversation_id: conversationId })).conversation;
    check(restored?.id === conversationId && restored.agent_id === agentId, 'IDENTITY');
    check(hash(JSON.stringify(await history())) === durableHash, 'RESTART_HISTORY'); await canonicalUnchanged();
    await startRuntime(); stage = 'cross_restart_measurement'; provider.arm('normal'); const replay = await channel.input(clientId, USER); provider.disarm();
    // Native run IDs are process-local; the new channel correlates this input's
    // acceptance, run mapping and terminal even when its ID repeats after boot.
    check(!replay.error && replay.stopReason === 'end_turn', 'RESTART_TURN');
    rows = await history(); check(users(rows).length === 2 && replies(rows).length === 2, 'RESTART_DEDUPE_CHANGED'); await canonicalUnchanged();
    const previousIds = new Set(rows.map(row => row.id)); const previousReplies = replies(rows).length;
    stage = 'malicious_turn'; provider.arm('malicious'); const malicious = await channel.input(randomUUID(), 'WP0050_SYNTHETIC_ATTACK'); provider.disarm();
    check(!malicious.error && malicious.stopReason === 'end_turn', 'TURN_TERMINAL');
    rows = await history();
    const refusals = rows.filter(row => !previousIds.has(row.id) && row.message_type === 'tool_return_message'
      && row.tool_call_id === 'call-wp0050' && row.status === 'error');
    check(refusals.length === 1, 'TOOL_REFUSAL');
    const finalReplies = replies(rows).filter(row => !previousIds.has(row.id));
    check(finalReplies.length === 1 && replies(rows).length === previousReplies + 1
      && rows.indexOf(finalReplies[0]) > rows.indexOf(refusals[0]), 'MALICIOUS_DURABILITY');
    check(await io(fs.readFile(canaryPath, 'utf8')) === 'UNCHANGED', 'TOOL_EXECUTED'); await canonicalUnchanged();
    result = { root, agentId, conversationId, canonicalHash, projectionHash: hash(projection), durableHash,
      sameRuntimeDedupe: true, crossRestartDedupe: false, crossRestartUserRows: users(rows).length,
      normal: first, restarted: replay, malicious: { stopReason: malicious.stopReason, error: malicious.error, refused: true }, provider: provider.evidence() };
  } catch (error) { problem = { stage, code: /^[A-Z_]{1,40}$/.test(error.code ?? '') ? error.code : 'FAILED',
    ...(/^[a-z_]{1,40}$/.test(error.frameType ?? '') ? { frameType: error.frameType } : {}) }; }
  finally {
    clearTimeout(deadline); signal?.removeEventListener('abort', abort); lifetime.abort();
    if (store) try { await bounded(store.close(), 3000); } catch { problem = { stage: 'cleanup', code: 'STORE_CLEANUP' }; }
    try { await stopRuntime(); } catch { problem = { stage: 'cleanup', code: 'CLEANUP_FAILED' }; }
    if (provider && !await provider.close()) problem = { stage: 'cleanup', code: 'PROVIDER_CLEANUP' };
    if (ioUncertain || pendingIO.size > 0) problem = { stage: 'cleanup', code: 'IO_UNCERTAIN' };
  }
  const evidence = Object.freeze({ ...result, root, agentId, conversationId, canonicalHash, cleanups, events, ok: !problem, ...(problem ? { failure: problem } : {}) });
  emit({ phase: 'complete', ok: !problem }); return evidence;
}
