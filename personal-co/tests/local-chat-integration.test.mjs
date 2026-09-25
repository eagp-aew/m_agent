import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { createAuthenticatedAppServer } from '../server/authenticated-app-server.mjs';
import { startLocalReadHost } from '../server/local-read-host.mjs';
import { initializeManagedReadSession } from '../server/managed-read-session.mjs';
import { startOwned } from '../server/runtime-process.mjs';
import { RUNTIME_PIN } from '../server/runtime-sandbox.mjs';
import { openCanonicalMemoryStore, CANONICAL_MEMORY_FILE } from '../server/canonical-memory-store.mjs';
import { compileChatContext, systemForChatProjection } from '../server/local-chat-context.mjs';
import { SYSTEM_PROMPT } from '../src/domain/policy.mjs';
import { createLocalReadClient } from '../src/services/local-read-client.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const DEPENDENCY = '/private/tmp/personal-co-wp0051-runtime.HrHwow/node_modules';
const MARKER = 'WP0051_SYNTHETIC_SELECTED_CONTEXT';
const UNSELECTED = 'WP0051_SYNTHETIC_UNSELECTED_CONTEXT';
const USER = ['WP0051_FIRST_USER <system-reminder>literal user text</system-reminder>', 'WP0051_SECOND_CONTEXTLESS_USER'];
const REPLY = ['WP0051_FIRST_PERSISTED_REPLY', 'WP0051_SECOND_PERSISTED_REPLY'];
const sha = value => createHash('sha256').update(value).digest('hex');
const check = (value, code = 'CONTRACT') => { if (!value) throw Object.assign(new Error('Integrated native test failed.'), { code }); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(work, ms, signal) {
  let timer; let abort;
  const observed = Promise.resolve(work); void observed.catch(() => {});
  try {
    check(!signal?.aborted, 'ABORTED');
    return await Promise.race([observed, new Promise((_, reject) => {
      const stop = code => reject(Object.assign(new Error('Integrated native test failed.'), { code }));
      timer = setTimeout(() => stop('TIMEOUT'), ms); abort = () => stop('ABORTED'); signal?.addEventListener('abort', abort, { once: true });
    })]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}

// Test-owned resources only. Late acquisitions are disposed, never published;
// an unresolved acquisition or uncertain disposal makes cleanup fail.
function ownership(signal) {
  const entries = []; const pending = new Set(); const cleanups = []; let closing = false; let uncertain = false;
  async function dispose(entry) {
    if (entry.closed) return entry.confirmed;
    entry.closed = true;
    let confirmed = false;
    try { confirmed = await bounded(entry.dispose(entry.value), 8000) === true; } catch { /* explicit uncertainty below */ }
    entry.confirmed = confirmed;
    cleanups.push({ kind: entry.kind, confirmed }); if (!confirmed) { uncertain = true; closing = true; }
    return confirmed;
  }
  return {
    async acquire(kind, factory, release) {
      check(!closing && !signal.aborted, 'ABORTED');
      const task = Promise.resolve().then(factory).then(async value => {
        const entry = { kind, value, dispose: release, closed: false }; entries.push(entry);
        if (closing || signal.aborted) { await dispose(entry); check(false, 'ABORTED'); }
        return value;
      });
      pending.add(task); void task.finally(() => pending.delete(task)).catch(() => {});
      return bounded(task, 35000, signal);
    },
    async release(value) { const entry = entries.find(entry => entry.value === value); check(entry, 'OWNERSHIP'); check(await dispose(entry) === true, 'CLEANUP_FAILED'); },
    async close() {
      closing = true; const deadline = Date.now() + 15000;
      for (const entry of [...entries].reverse()) {
        try { await bounded(dispose(entry), Math.max(1, deadline - Date.now())); } catch { uncertain = true; }
      }
      try { await bounded(Promise.allSettled([...pending]), Math.max(1, deadline - Date.now())); } catch { uncertain = true; }
      return { confirmed: !uncertain && pending.size === 0, resources: [...cleanups] };
    },
  };
}

// No forwarding. Header names/values and bodies never enter public evidence.
const HEADERS = new Set(['host', 'connection', 'accept', 'accept-encoding', 'accept-language', 'content-type', 'content-length',
  'user-agent', 'sec-fetch-mode', 'x-stainless-lang', 'x-stainless-package-version', 'x-stainless-os', 'x-stainless-arch',
  'x-stainless-runtime', 'x-stainless-runtime-version', 'x-stainless-retry-count', 'x-stainless-timeout']);
const text = content => {
  if (typeof content === 'string') { check(Buffer.byteLength(content) <= 131072, 'BODY'); return content; }
  check(Array.isArray(content) && content.length <= 128, 'BODY');
  check(content.every(part => part?.type === 'text' && typeof part.text === 'string'), 'BODY');
  const output = content.map(part => part.text).join(''); check(Buffer.byteLength(output) <= 131072, 'BODY'); return output;
};
async function provider() {
  const sockets = new Set(); const failed = deferred(); const observations = [];
  let problem = false; let requests = 0; let connections = 0; let peakConnections = 0; let inference = 0; let arm; let arms = 0; let closing;
  const fault = () => { problem = true; failed.resolve(); };
  const server = createServer({ maxHeaderSize: 4096, headersTimeout: 2000, requestTimeout: 2000, keepAliveTimeout: 100 }, (req, res) => {
    void (async () => {
      const timer = setTimeout(() => { fault(); req.destroy(); }, 2000);
      try {
        check(!problem && !closing && ++requests <= 32, 'REQUEST_LIMIT');
        const seen = new Set();
        for (let index = 0; index < req.rawHeaders.length; index += 2) {
          const name = req.rawHeaders[index].toLowerCase(); const value = req.rawHeaders[index + 1];
          check(HEADERS.has(name) && !seen.has(name) && value.length <= 256, 'HEADER'); seen.add(name);
        }
        check(req.headers.host === `127.0.0.1:${server.address().port}` && !req.headers['transfer-encoding']
          && (req.headers['x-stainless-retry-count'] === undefined || req.headers['x-stainless-retry-count'] === '0'), 'HEADER');
        if (req.method === 'GET' && ['/api/v0/models', '/v1/models'].includes(req.url)) {
          check(req.headers['content-length'] === undefined || req.headers['content-length'] === '0', 'BODY');
          const data = JSON.stringify({ data: [{ id: 'synthetic', object: 'model', type: 'llm', state: 'loaded', max_context_length: 128000 }] });
          check(Buffer.byteLength(data) <= 8192); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(data); return;
        }
        check(req.method === 'POST' && req.url === '/v1/chat/completions' && arm && !arm.used && inference < 2, 'UNARMED');
        check(req.headers['content-type']?.split(';')[0] === 'application/json'
          && /^[0-9]+$/.test(req.headers['content-length'] ?? '') && Number(req.headers['content-length']) <= 262144, 'BODY');
        const requestArm = Object.freeze({ ...arm }); arm.used = true;
        let length = 0; const chunks = [];
        for await (const chunk of req) { length += chunk.length; check(length <= 262144, 'BODY'); chunks.push(chunk); }
        check(!problem && !closing, 'PROVIDER_FAILED');
        const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
        check(!JSON.stringify(body).includes(UNSELECTED), 'UNSELECTED_CONTEXT');
        check(body.model === 'synthetic' && body.stream === true && Array.isArray(body.messages) && body.messages.length <= 64
          && (body.tools === undefined || Array.isArray(body.tools) && body.tools.length === 0)
          && (body.functions === undefined || Array.isArray(body.functions) && body.functions.length === 0)
          && (body.tool_choice === undefined || body.tool_choice === 'none')
          && (body.function_call === undefined || body.function_call === 'none'), 'INFERENCE');
        check(body.messages.every(row => row && ['system', 'user', 'assistant'].includes(row.role)
          && !row.tool_calls && !row.function_call), 'INFERENCE');
        const system = body.messages.filter(row => row.role === 'system').map(row => text(row.content)).join('\n');
        const users = body.messages.filter(row => row.role === 'user');
        check(system.includes(requestArm.system) && system.includes(MARKER) === requestArm.contextual
          && Buffer.byteLength(system) <= 131072 && users.length > 0, 'CONTEXT');
        const last = users.at(-1).content;
        check((typeof last === 'string' ? last : last?.at(-1)?.text) === requestArm.user
          && users.every(row => !text(row.content).includes(MARKER)), 'ORIGINAL_USER');
        inference++;
        observations.push({ systemHash: sha(system), contextual: requestArm.contextual, credentialHeaders: false, tools: 0, model: 'synthetic' });
        const chunk = (delta, finish_reason) => ({ id: `chatcmpl-wp0051-${inference}`, object: 'chat.completion.chunk', created: 1,
          model: 'synthetic', choices: [{ index: 0, delta, finish_reason }] });
        const data = `data: ${JSON.stringify(chunk({ role: 'assistant', content: requestArm.reply }, null))}\n\ndata: ${JSON.stringify(chunk({}, 'stop'))}\n\ndata: [DONE]\n\n`;
        check(Buffer.byteLength(data) <= 8192); res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' }); res.end(data);
      } catch { fault(); if (!res.headersSent) { res.writeHead(400, { Connection: 'close' }); res.end(); } else res.destroy(); }
      finally { clearTimeout(timer); }
    })();
  });
  server.maxConnections = 4; server.maxRequestsPerSocket = 16;
  server.on('connection', socket => { connections++; sockets.add(socket); peakConnections = Math.max(peakConnections, sockets.size);
    socket.setTimeout(2000, () => { fault(); socket.destroy(); }); socket.on('close', () => sockets.delete(socket)); });
  server.on('clientError', (_failure, socket) => { fault(); socket.destroy(); });
  server.on('upgrade', (_request, socket) => { fault(); socket.destroy(); });
  server.on('error', fault);
  try { await bounded(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }), 2000); }
  catch { for (const socket of sockets) socket.destroy(); server.close(); throw new Error('Synthetic provider startup failed.'); }
  return Object.freeze({ port: server.address().port, failed: failed.promise,
    arm(value) { check(!problem && !closing && (!arm || arm.used && inference === arms) && ++arms <= 2 && typeof value.system === 'string' && value.system.length <= 16384
      && USER.includes(value.user) && REPLY.includes(value.reply), 'ARM'); arm = { ...value, used: false }; },
    evidence() { check(!problem, 'PROVIDER_FAILED'); return { requests, connections, peakConnections, inference, observations: [...observations] }; },
    close() { closing ??= bounded(new Promise(resolve => { server.close(error => resolve(!error)); for (const socket of sockets) socket.destroy(); }), 2000).catch(() => false); return closing; },
  });
}

// Read-only framing avoids ambiguous concatenation. Closure includes all local
// imports from this test and App/CLI roots, manifests/locks and actual JS bundle.
export async function reviewFingerprint() {
  const files = new Map(); const visiting = new Set();
  async function add(relative, recurse = true) {
    check(!path.isAbsolute(relative) && !relative.startsWith('../'), 'REVIEW_PATH');
    if (files.has(relative)) return;
    check(!visiting.has(relative), 'REVIEW_CYCLE'); visiting.add(relative);
    const absolute = path.join(ROOT, relative); const stat = await fs.lstat(absolute);
    check(stat.isFile() && stat.nlink === 1 && stat.size <= 16777216 && await fs.realpath(absolute) === absolute, 'REVIEW_FILE');
    const bytes = await fs.readFile(absolute); files.set(relative, bytes);
    if (recurse && /\.(?:mjs|js|tsx?|jsx)$/.test(relative)) {
      const source = bytes.toString('utf8');
      const imports = [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g)].map(match => match[1]);
      for (const specifier of imports.filter(value => value.startsWith('.'))) {
        const base = path.normalize(path.join(path.dirname(relative), specifier));
        const choices = path.extname(base) ? [base] : [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`];
        let found;
        for (const choice of choices) { try { if ((await fs.lstat(path.join(ROOT, choice))).isFile()) { found = choice; break; } } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        check(found, 'REVIEW_IMPORT'); await add(found);
      }
    }
    visiting.delete(relative);
  }
  for (const seed of ['personal-co/tests/local-chat-integration.test.mjs', 'personal-co/server/local-read-cli.mjs', 'personal-co/App.tsx',
    'personal-co/index.ts', 'personal-co/README.md', 'personal-co/package.json', 'personal-co/package-lock.json',
    'personal-co/server/package.json', 'personal-co/server/package-lock.json', 'personal-co/tsconfig.json', 'personal-co/dist/index.html']) await add(seed);
  const index = files.get('personal-co/dist/index.html').toString('utf8');
  const bundles = [...index.matchAll(/\bsrc="(\/_expo\/static\/js\/web\/[A-Za-z0-9_.-]+\.js)"/g)].map(match => `personal-co/dist${match[1]}`);
  check(bundles.length === 1 && new Set(bundles).size === bundles.length, 'REVIEW_BUNDLE');
  for (const bundle of bundles) { check(!files.has(bundle), 'REVIEW_DUPLICATE'); await add(bundle, false); }
  const hash = createHash('sha256'); const closure = [];
  const frame = (name, length) => { hash.update(`${Buffer.byteLength(name)}:${name}:${length}:`); };
  for (const [name, bytes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    frame(name, bytes.length); hash.update(bytes); closure.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
  }
  for (const name of ['package.json', 'letta.js']) {
    const file = `${DEPENDENCY}/@letta-ai/letta-code/${name}`; const stat = await fs.lstat(file);
    check(stat.isFile() && stat.nlink === 1 && stat.size <= 134217728 && await fs.realpath(file) === file, 'RUNTIME_PIN');
    frame(`external:${file}`, stat.size); const part = createHash('sha256'); let length = 0;
    for await (const chunk of createReadStream(file)) { length += chunk.length; check(length <= stat.size, 'RUNTIME_PIN'); hash.update(chunk); part.update(chunk); }
    check(length === stat.size, 'RUNTIME_PIN'); const digest = part.digest('hex');
    if (name === 'letta.js') check(digest === RUNTIME_PIN.cliSha256, 'RUNTIME_PIN');
    closure.push({ path: `external:${file}`, bytes: length, sha256: digest });
  }
  return { sha256: hash.digest('hex'), closure };
}
function nativeGate(env, platform, reviewed) {
  check(platform === 'darwin' && env.WP0051_RUN_NATIVE === '1'
    && /^[a-f0-9]{64}$/.test(env.WP0051_REVIEWED_SHA256 ?? '') && env.WP0051_REVIEWED_SHA256 === reviewed, 'NATIVE_GATE');
}

function nativeMode(env, platform, reviewed) {
  if (env.WP0051_RUN_CATALOG_DIAGNOSTIC !== undefined) {
    check(env.WP0051_RUN_CATALOG_DIAGNOSTIC === '1', 'NATIVE_GATE');
    nativeGate(env, platform, reviewed); return 'catalog';
  }
  if (env.WP0051_RUN_NATIVE === '1') { nativeGate(env, platform, reviewed); return 'journey'; }
  return 'default';
}

// Only JSON wire data enters this projection. No unknown names or strings leave
// it; malformed known values become null plus presence/type flags, not logs.
const DIAGNOSTIC_CODES = new Set(['PREDISPATCH', 'CHAT_CHANNEL_FAILED', 'ABORTED', 'TIMEOUT',
  'CLEANUP_FAILED', 'DIAGNOSTIC_BOUND', 'DIAGNOSTIC_SHAPE', 'DIAGNOSTIC_DUPLICATE', 'PROVIDER_FAILED']);
const diagnosticCode = error => DIAGNOSTIC_CODES.has(error?.code) ? error.code : 'FAILED';
function diagnosticJSON(data) {
  check((Buffer.isBuffer(data) || typeof data === 'string') && Buffer.byteLength(data) <= 1048576, 'DIAGNOSTIC_BOUND');
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(data))); }
  catch { check(false, 'DIAGNOSTIC_SHAPE'); }
  let records = 0; let keys = 0;
  function bound(node, depth) {
    check(depth <= 16, 'DIAGNOSTIC_BOUND');
    if (!node || typeof node !== 'object') return;
    check(++records <= 4096, 'DIAGNOSTIC_BOUND');
    if (Array.isArray(node)) check(node.length <= 512, 'DIAGNOSTIC_BOUND');
    const values = Object.values(node); keys += values.length; check(keys <= 16384, 'DIAGNOSTIC_BOUND');
    for (const child of values) bound(child, depth + 1);
  }
  bound(value, 0); return value;
}
const diagnosticRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const DEFAULT_KEYS = ['provider_type', 'context_window', 'max_output_tokens', 'context_window_limit', 'max_tokens'];
function diagnosticSettings(value) {
  const validRecord = diagnosticRecord(value);
  const present = Object.freeze(Object.fromEntries(DEFAULT_KEYS.map(key => [key, validRecord && Object.hasOwn(value, key)])));
  const numeric = key => validRecord && typeof value[key] === 'number' && Number.isFinite(value[key]) ? value[key] : null;
  return Object.freeze({ validRecord, present, providerCorrect: validRecord && value.provider_type === 'lmstudio_openai',
    contextWindow: numeric('context_window'), maxOutputTokens: numeric('max_output_tokens'),
    contextWindowLimit: numeric('context_window_limit'), maxTokens: numeric('max_tokens'),
    extraKeyCount: validRecord ? Object.keys(value).filter(key => !DEFAULT_KEYS.includes(key)).length : null });
}
function catalogProjection(message) {
  check(diagnosticRecord(message) && message.type === 'list_models_response', 'DIAGNOSTIC_SHAPE');
  const entriesArray = Array.isArray(message.entries); const availableArray = Array.isArray(message.available_handles);
  check((!entriesArray || message.entries.length <= 512) && (!availableArray || message.available_handles.length <= 512), 'DIAGNOSTIC_BOUND');
  const handle = value => typeof value === 'string' && value.length > 0 && value.length <= 256;
  const selected = entriesArray ? message.entries.filter(entry => diagnosticRecord(entry) && entry.handle === 'lmstudio/synthetic') : [];
  return Object.freeze({ success: typeof message.success === 'boolean' ? message.success : null,
    entriesPresent: Object.hasOwn(message, 'entries'), availablePresent: Object.hasOwn(message, 'available_handles'),
    entriesArray, availableArray, entryCount: entriesArray ? message.entries.length : null,
    availableCount: availableArray ? message.available_handles.length : null,
    invalidEntryCount: entriesArray ? message.entries.filter(entry => !diagnosticRecord(entry)).length : null,
    invalidEntryHandleCount: entriesArray ? message.entries.filter(entry => diagnosticRecord(entry) && !handle(entry.handle)).length : null,
    invalidAvailableHandleCount: availableArray ? message.available_handles.filter(value => !handle(value)).length : null,
    selectedAvailable: availableArray ? message.available_handles.includes('lmstudio/synthetic') : null,
    selectedCount: entriesArray ? selected.length : null,
    selected: Object.freeze(selected.map(entry => diagnosticSettings(entry.updateArgs))) });
}
function agentProjection(agent, agentId) {
  check(diagnosticRecord(agent), 'DIAGNOSTIC_SHAPE');
  return { identityMatches: agent.id === agentId, selectedModelMatches: agent.model === 'lmstudio/synthetic',
    bootstrapModelMatches: agent.model === 'local/default', settings: diagnosticSettings(agent.model_settings) };
}
function observedWebSocket(Base, observation) {
  const requestIds = []; let pendingId;
  observation.catalogs = Object.freeze([]);
  return class extends Base {
    constructor(...args) {
      super(...args);
      this.on('message', (data, binary) => {
        if (observation.phase !== 'catalog') return;
        try {
          check(!binary, 'DIAGNOSTIC_SHAPE'); const message = diagnosticJSON(data);
          if (message?.type !== 'list_models_response') return;
          check(!observation.failure && pendingId && message.request_id === pendingId
            && observation.catalogs.length < 2, 'DIAGNOSTIC_DUPLICATE');
          const catalog = catalogProjection(message);
          observation.catalogs = Object.freeze([...observation.catalogs,
            Object.freeze({ force: observation.catalogs.length === 0, catalog })]);
          observation.catalog = catalog; pendingId = undefined;
        } catch (error) { observation.failure = diagnosticCode(error); observation.abort(); }
      });
    }
    send(...args) {
      if (observation.phase === 'catalog') {
        try {
          const message = diagnosticJSON(args[0]);
          check(!observation.failure && message.type === 'list_models' && typeof message.request_id === 'string'
            && message.request_id.length > 0 && message.request_id.length <= 128 && !pendingId
            && requestIds.length < 2 && !requestIds.includes(message.request_id)
            && message.force === (requestIds.length === 0), 'DIAGNOSTIC_DUPLICATE');
          pendingId = message.request_id; requestIds.push(pendingId);
        } catch (error) { observation.failure = diagnosticCode(error); observation.abort(); }
      }
      return super.send(...args); // Exact payload/callback/options, never rewritten.
    }
  };
}
async function catalogDiagnostic(t, reviewed) {
  check(nativeMode(process.env, process.platform, reviewed.sha256) === 'catalog', 'NATIVE_GATE');
  check(process.execPath === RUNTIME_PIN.nodePath && process.versions.node === RUNTIME_PIN.nodeVersion, 'NODE_PIN');
  const controller = new AbortController(); const owner = ownership(controller.signal);
  const abort = () => controller.abort(); const timer = setTimeout(abort, 50000);
  process.on('SIGINT', abort); process.on('SIGTERM', abort); t.signal.addEventListener('abort', abort, { once: true });
  const observation = { phase: 'idle', abort }; const lifecycle = [];
  let root; let auth; let endpoint; let boots = 0; let cleanup; let result; let failure; let stage = 'fixture';
  const io = work => bounded(work, 5000, controller.signal);
  try {
    root = await io(fs.realpath(await io(fs.mkdtemp('/private/tmp/personal-co-wp0051-catalog-'))));
    const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
    await io(fs.mkdir(stateRoot, { mode: 0o700 })); await io(fs.mkdir(protectedRoot, { mode: 0o700 }));
    const p = await owner.acquire('provider', provider, value => value.close()); void p.failed.then(abort);
    // Resolve the already-installed dependency exactly as the real server does.
    const WebSocket = createRequire(new URL('../server/package.json', import.meta.url))('ws');
    stage = 'boot';
    const session = await owner.acquire('session', () => initializeManagedReadSession({ dependencyRoot: DEPENDENCY,
      stateRoot, protectedRoot, chat: { model: 'lmstudio/synthetic', providerPort: p.port } }, { signal: controller.signal }, {
      async makeAuth(roots, options) {
        auth = await createAuthenticatedAppServer(roots, { ...options, WebSocketImpl: observedWebSocket(WebSocket, observation) });
        return auth;
      },
      start(spec) { check(!controller.signal.aborted && ++boots === 1, 'ABORTED'); return startOwned(spec); },
      observe(event) {
        if (lifecycle.length >= 32) { abort(); return; }
        if (event.type === 'endpoint') { endpoint = event.endpoint; lifecycle.push({ type: 'endpoint', port: Number(new URL(endpoint).port) }); }
        if (event.type === 'spawned') lifecycle.push({ type: 'spawned', pid: event.pid });
        if (event.type === 'process_cleanup') lifecycle.push({ type: event.type, pid: event.pid, reaped: event.reaped, groupGone: event.groupGone });
        if (event.type === 'terminal') lifecycle.push({ type: 'terminal', confirmed: event.cleanup.confirmed,
          authClosed: event.cleanup.authClosed, processReaped: event.cleanup.processReaped,
          groupGone: event.cleanup.groupGone, listenerGone: event.cleanup.listenerGone });
      },
    }), async value => (await value.close()).cleanup.confirmed === true);
    const { agentId } = await bounded(session.ready, 25000, controller.signal);
    check(session.status().phase === 'ready' && !controller.signal.aborted, 'ABORTED');
    stage = 'connect';
    const channel = await owner.acquire('channel', () => auth.connectChat(endpoint,
      { agentId, stateRoot, model: 'lmstudio/synthetic', providerPort: p.port }, { signal: controller.signal }), async value => { await value.close(); return true; });
    stage = 'catalog'; observation.phase = 'catalog'; let defaultsResult = 'OK'; let defaults;
    try { defaults = diagnosticSettings(await channel.readModelDefaults()); }
    catch (error) { defaultsResult = diagnosticCode(error); }
    finally { observation.phase = 'idle'; }
    check(!observation.failure && observation.catalog, 'DIAGNOSTIC_SHAPE');
    // PREDISPATCH is an admission result, not an observation failure. The same
    // healthy named channel may still retrieve the freshly bootstrapped Agent.
    stage = 'agent'; let agent; let agentResult = 'OK';
    try { const value = await channel.readAgent(); agent = agentProjection(diagnosticJSON(JSON.stringify(value)), agentId); }
    catch (error) { agentResult = diagnosticCode(error); }
    check(p.evidence().inference === 0, 'PROVIDER_FAILED');
    result = { catalog: observation.catalog, catalogs: observation.catalogs, defaultsResult, defaults: defaults ?? null,
      agentResult, agent: agent ?? null, provider: p.evidence(), boots };
    await owner.release(channel);
  } catch (error) { failure = { stage, code: observation.failure ?? diagnosticCode(error) }; }
  finally {
    observation.phase = 'idle'; controller.abort(); cleanup = await owner.close();
    clearTimeout(timer); process.off('SIGINT', abort); process.off('SIGTERM', abort); t.signal.removeEventListener('abort', abort);
  }
  t.diagnostic(JSON.stringify({ schema: 'wp0051-catalog-observation-v1', root, reviewedSha256: reviewed.sha256,
    ...result, lifecycle, cleanup, failure: failure ?? null }));
  check(!failure && cleanup.confirmed, 'CATALOG_DIAGNOSTIC_FAILED');
}

// One finite non-runtime child; production profile/env/cwd copied unchanged.
function policyProgram(allowed, decoy) {
  return `const {request}=require('node:http');
const once=port=>new Promise(resolve=>{const r=request({host:'127.0.0.1',port,path:'/v1/models',method:'GET',agent:false},s=>{s.resume();s.on('end',()=>resolve(s.statusCode===200?'OK':'STATUS'));});r.setTimeout(1000,()=>r.destroy(new Error('TIMEOUT')));r.on('error',e=>resolve(['EPERM','EACCES'].includes(e.code)?e.code:'OTHER'));r.end();});
(async()=>{const allowed=await once(${allowed});const decoy=await once(${decoy});if(allowed!=='OK'||!['EPERM','EACCES'].includes(decoy))process.exitCode=1;else process.stdout.write(JSON.stringify({allowed,decoy})+'\\n');})().catch(()=>{process.exitCode=1;});`;
}
async function nativeJourney(t, reviewed) {
  // Caller checks these gates BEFORE constructing resources or listeners.
  nativeGate(process.env, process.platform, reviewed.sha256);
  check(process.execPath === RUNTIME_PIN.nodePath && process.versions.node === RUNTIME_PIN.nodeVersion, 'NODE_PIN');
  const controller = new AbortController(); const owner = ownership(controller.signal);
  const abort = () => controller.abort(); const timer = setTimeout(abort, 130000);
  process.on('SIGINT', abort); process.on('SIGTERM', abort); t.signal.addEventListener('abort', abort, { once: true });
  let stage = 'fixture'; let root; let client; let host; let captured; let boots = 0; let helpers = 0; let canonicalHash; let cleanup; let result; let failure;
  const lifecycle = []; const hostClosures = [];
  const alive = () => check(!controller.signal.aborted, 'ABORTED');
  const io = work => bounded(work, 5000, controller.signal);
  try {
    root = await io(fs.realpath(await io(fs.mkdtemp('/private/tmp/personal-co-wp0051-native-'))));
    const stateRoot = path.join(root, 'state'); const protectedRoot = path.join(root, 'protected');
    await io(fs.mkdir(stateRoot, { mode: 0o700 })); await io(fs.mkdir(protectedRoot, { mode: 0o700 }));
    const p = await owner.acquire('provider', provider, value => value.close()); void p.failed.then(abort);
    const decoy = await owner.acquire('decoy', provider, value => value.close()); void decoy.failed.then(abort);
    const config = { dependencyRoot: DEPENDENCY, stateRoot, protectedRoot, webRoot: path.join(ROOT, 'personal-co/dist'),
      chat: { model: 'lmstudio/synthetic', providerPort: p.port } };
    async function boot() {
      alive(); check(++boots <= 2, 'BOOT_BUDGET');
      host = await owner.acquire('host', () => startLocalReadHost(config, { signal: controller.signal }, {
        observe(event) {
          if (lifecycle.length >= 32) { abort(); return; }
          if (event.type === 'spawned') lifecycle.push({ type: event.type, pid: event.pid });
          if (event.type === 'endpoint') lifecycle.push({ type: event.type, port: Number(new URL(event.endpoint).port) });
          if (event.type === 'process_cleanup') lifecycle.push({ type: event.type, pid: event.pid, reaped: event.reaped, groupGone: event.groupGone });
          if (event.type === 'terminal') lifecycle.push({ type: event.type, confirmed: event.cleanup.confirmed,
            authClosed: event.cleanup.authClosed, processReaped: event.cleanup.processReaped, groupGone: event.cleanup.groupGone, listenerGone: event.cleanup.listenerGone });
        },
        makeSession: (roots, options, seams) => initializeManagedReadSession(roots, options, { ...seams,
          start(spec) {
            alive(); check(Object.isFrozen(spec) && Object.isFrozen(spec.args) && Object.isFrozen(spec.options.env)
              && spec.command === '/usr/bin/sandbox-exec' && spec.args[0] === '-p'
              && spec.options.cwd === stateRoot && spec.options.env.LETTA_DISABLE_MODS === '1'
              && spec.options.env.LMSTUDIO_BASE_URL === `http://127.0.0.1:${p.port}/v1`, 'LAUNCH');
            if (captured) check(captured.args[1] === spec.args[1], 'PROFILE_CHANGED'); else captured = spec;
            return startOwned(spec); // Exact production spec, no injected native peer.
          },
        }),
      }), async value => { const closed = await value.close(); hostClosures.push({ confirmed: closed.confirmed,
        httpClosed: closed.httpClosed, sessionClosed: closed.sessionClosed }); return closed.confirmed; });
      const capability = new URL(host.launchUrl).hash.slice('#capability='.length);
      client = createLocalReadClient({ origin: host.origin, capability }, { fetchImpl: (url, options) => {
        check(url.startsWith(`${host.origin}/api/local/`), 'HTTP_SCOPE');
        return fetch(url, { ...options, headers: { ...options.headers, Origin: host.origin },
          signal: AbortSignal.any([options.signal, controller.signal]) });
      } });
      check((await client.status()).chatEnabled, 'CHAT_DISABLED');
    }
    async function complete(operationId) {
      const deadline = Date.now() + 25000;
      for (let poll = 0; poll < 100 && Date.now() < deadline; poll++) {
        const receipt = await bounded(client.operation(operationId), Math.max(1, deadline - Date.now()), controller.signal);
        check(receipt?.operationId === operationId && receipt.status !== 'failed', 'RECEIPT');
        if (receipt.status === 'completed') return receipt;
        await bounded(new Promise(resolve => setTimeout(resolve, 100)), 200, controller.signal);
      }
      check(false, 'RECEIPT_TIMEOUT');
    }
    const canonicalPath = path.join(protectedRoot, CANONICAL_MEMORY_FILE); const canary = path.join(stateRoot, 'wp0051-canary');
    async function invariants() {
      check(sha(await io(fs.readFile(canonicalPath))) === canonicalHash, 'CANONICAL_CHANGED');
      check(await io(fs.readFile(canary, 'utf8')) === 'UNCHANGED', 'CANARY_CHANGED');
      const providersPath = path.join(stateRoot, 'providers');
      try { const stat = await io(fs.lstat(providersPath)); check(stat.isDirectory() && stat.uid === process.getuid()
        && (stat.mode & 0o7777) === 0o700 && await io(fs.realpath(providersPath)) === providersPath, 'PROVIDER_DIRECTORY'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      let missing = false; try { await io(fs.lstat(path.join(stateRoot, 'providers/auth.json'))); } catch (error) { if (error.code === 'ENOENT') missing = true; else throw error; }
      check(missing, 'PROVIDER_RECORD');
    }
    stage = 'first_boot'; await boot(); const agentId = host.agentId;
    stage = 'idle_canonical_seed';
    check((await client.status()).activeOperationId === null && (await client.pending()).items.length === 0, 'NOT_IDLE');
    const store = await owner.acquire('canonical_writer', () => openCanonicalMemoryStore({ directory: protectedRoot, agentId }), async value => { await value.close(); return true; });
    const initial = await io(store.read()); const candidate = { ...initial, revision: initial.revision + 1,
      blocks: initial.blocks.map(block => block.label === 'CURRENT_CONTEXT' ? { ...block, value: `${MARKER}\n\n${UNSELECTED}` } : block) };
    const memory = await io(store.commit(candidate, { expectedRevision: initial.revision })); await owner.release(store);
    canonicalHash = sha(await io(fs.readFile(canonicalPath)));
    await io(fs.writeFile(canary, 'UNCHANGED', { flag: 'wx', mode: 0o600 }));
    const preview = await client.previewContext();
    const selected = preview.items.filter(item => item.text === MARKER);
    check(preview.agentId === agentId && preview.digest === canonicalHash && selected.length === 1
      && preview.items.filter(item => item.text === UNSELECTED).length === 1, 'PREVIEW');
    const context = { revision: preview.revision, digest: preview.digest, items: [selected[0].id] };
    const system = systemForChatProjection(compileChatContext({ memory, digest: canonicalHash }, agentId, context));
    stage = 'policy_helper';
    const live = await bounded(fetch(`http://127.0.0.1:${decoy.port}/v1/models`, { signal: controller.signal }), 2000, controller.signal);
    check(live.status === 200, 'DECOY_NOT_LIVE'); await live.arrayBuffer();
    check(++helpers === 1, 'HELPER_BUDGET');
    const helper = await owner.acquire('policy_helper', () => {
      alive(); return startOwned({ ...captured, args: ['-p', captured.args[1], RUNTIME_PIN.nodePath, '-e', policyProgram(p.port, decoy.port)],
        options: captured.options }, { startupMs: 5000, stopMs: 1000, maxLogBytes: 8192 });
    }, async value => { const stopped = await value.stop(); return stopped.reaped && stopped.groupGone; });
    const policy = JSON.parse(await bounded(helper.output(), 5000, controller.signal));
    check(policy.allowed === 'OK' && ['EPERM', 'EACCES'].includes(policy.decoy), 'POLICY'); await owner.release(helper);
    stage = 'create'; const creation = { operationId: randomUUID(), kind: 'create', title: 'WP0051 retained native integration' };
    await client.submit(creation); const created = await complete(creation.operationId); const conversationId = created.conversationId;
    stage = 'context_send'; const first = { operationId: randomUUID(), kind: 'send', conversationId, text: USER[0], context };
    p.arm({ system, contextual: true, user: USER[0], reply: REPLY[0] }); await client.submit(first); const firstReceipt = await complete(first.operationId);
    let history = await client.listMessages(conversationId);
    check(history.items.filter(row => row.role === 'user' && row.content === USER[0]).length === 1
      && history.items.filter(row => row.role === 'assistant' && row.content === REPLY[0]).length === 1 && history.cursor === null, 'HISTORY');
    const historyHash = sha(JSON.stringify(history));
    check((await client.submit(first)).status === 'completed' && p.evidence().inference === 1, 'REPLAY'); await invariants();
    stage = 'close_reopen'; client.disconnect(); client = undefined; await owner.release(host); host = undefined;
    await boot(); check(host.agentId === agentId, 'AGENT_CHANGED');
    check(sha(JSON.stringify(await client.operation(creation.operationId))) === sha(JSON.stringify(created))
      && sha(JSON.stringify(await client.operation(first.operationId))) === sha(JSON.stringify(firstReceipt))
      && sha(JSON.stringify(await client.listMessages(conversationId))) === historyHash, 'REOPEN_PERSISTENCE');
    await invariants();
    check((await client.submit(creation)).conversationId === conversationId && (await client.submit(first)).status === 'completed'
      && p.evidence().inference === 1, 'REOPEN_REPLAY');
    stage = 'contextless_send'; const second = { operationId: randomUUID(), kind: 'send', conversationId, text: USER[1] };
    p.arm({ system: SYSTEM_PROMPT, contextual: false, user: USER[1], reply: REPLY[1] }); await client.submit(second); await complete(second.operationId);
    history = await client.listMessages(conversationId);
    check(history.cursor === null && USER.every(value => history.items.filter(row => row.role === 'user' && row.content === value).length === 1)
      && REPLY.every(value => history.items.filter(row => row.role === 'assistant' && row.content === value).length === 1), 'REOPEN_HISTORY');
    await invariants(); check(p.evidence().inference === 2 && decoy.evidence().inference === 0
      && decoy.evidence().requests === 1 && decoy.evidence().connections === 1, 'INFERENCE_BUDGET');
    check((await client.pending()).items.length === 0, 'PENDING');
    result = { agentId, conversationId, operationIds: [creation.operationId, first.operationId, second.operationId], canonicalHash,
      profileHash: sha(captured.args[1]), boots, helpers, policy, provider: p.evidence(), decoyRequests: decoy.evidence().requests,
      decoyConnections: decoy.evidence().connections, firstHistoryHash: historyHash };
  } catch (error) { failure = { stage, code: /^[A-Z_]{1,40}$/.test(error?.code ?? '') ? error.code : 'FAILED' }; }
  finally {
    controller.abort(); client?.disconnect(); cleanup = await owner.close();
    clearTimeout(timer); process.off('SIGINT', abort); process.off('SIGTERM', abort); t.signal.removeEventListener('abort', abort);
  }
  t.diagnostic(JSON.stringify({ schema: 'wp0051-integrated-native-v1', root, reviewedSha256: reviewed.sha256, ...result,
    lifecycle, hostClosures, cleanup, failure: failure ?? null }));
  check(!failure && cleanup.confirmed, 'NATIVE_JOURNEY_FAILED');
}

if (process.env.WP0051_REVIEW_ONLY === '1') {
  // Explicit read-only command; no tests, fixtures, listeners or native starts.
  process.stdout.write(`${JSON.stringify(await reviewFingerprint())}\n`);
} else {
  const mode = nativeMode(process.env, process.platform, process.env.WP0051_REVIEWED_SHA256);
  if (mode === 'default') {
  test('diagnostic dispatch requires all gates and is mutually exclusive', () => {
    const env = { WP0051_RUN_CATALOG_DIAGNOSTIC: '1', WP0051_RUN_NATIVE: '1', WP0051_REVIEWED_SHA256: 'a'.repeat(64) };
    assert.equal(nativeMode({}, 'darwin'), 'default');
    assert.equal(nativeMode(env, 'darwin', 'a'.repeat(64)), 'catalog');
    const { WP0051_RUN_CATALOG_DIAGNOSTIC: ignored, ...journey } = env;
    assert.equal(nativeMode(journey, 'darwin', 'a'.repeat(64)), 'journey');
    for (const invalid of [{ ...env, WP0051_RUN_NATIVE: undefined }, { ...env, WP0051_RUN_CATALOG_DIAGNOSTIC: '0' },
      { ...env, WP0051_REVIEWED_SHA256: undefined }, { ...env, WP0051_REVIEWED_SHA256: 'b'.repeat(64) }]) {
      assert.throws(() => nativeMode(invalid, 'darwin', 'a'.repeat(64)), { code: 'NATIVE_GATE' });
    }
    assert.throws(() => nativeMode(env, 'linux', 'a'.repeat(64)), { code: 'NATIVE_GATE' });
  });
  const catalog = { type: 'list_models_response', request_id: 'request1', success: true,
    available_handles: ['lmstudio/synthetic'], entries: [{ handle: 'lmstudio/synthetic', updateArgs: {
      provider_type: 'lmstudio_openai', context_window: 128000, max_output_tokens: 32000, privateKey: 'NEVER_PRINT' } }] };
  test('diagnostic projects known numbers and booleans without unknown catalog or Agent strings', () => {
    const projected = catalogProjection(diagnosticJSON(JSON.stringify(catalog)));
    assert.equal(projected.selectedAvailable, true); assert.equal(projected.selected[0].providerCorrect, true);
    assert.equal(projected.selected[0].contextWindow, 128000); assert.equal(projected.selected[0].extraKeyCount, 1);
    const badValues = { ...catalog, available_handles: [], entries: [{ handle: 'lmstudio/synthetic', updateArgs: {
      provider_type: 'NEVER_PRINT', context_window: 'NEVER_PRINT', max_output_tokens: null } }] };
    const malformed = catalogProjection(diagnosticJSON(JSON.stringify(badValues)));
    assert.equal(malformed.selectedAvailable, false); assert.equal(malformed.selected[0].providerCorrect, false);
    assert.equal(malformed.selected[0].contextWindow, null); assert.equal(malformed.selected[0].present.context_window, true);
    const agent = agentProjection(diagnosticJSON(JSON.stringify({ id: 'synthetic-agent', model: 'local/default',
      system: 'NEVER_PRINT', model_settings: { provider_type: 'lmstudio_openai', secretName: 'NEVER_PRINT' } })), 'synthetic-agent');
    assert.equal(agent.identityMatches, true); assert.equal(agent.bootstrapModelMatches, true); assert.equal(agent.selectedModelMatches, false);
    assert.equal(agent.settings.extraKeyCount, 1);
    assert.doesNotMatch(JSON.stringify([projected, malformed, agent]), /NEVER_PRINT|privateKey|secretName/);
    for (const value of [null, [], 'NEVER_PRINT', 7]) assert.equal(diagnosticSettings(value).validRecord, false);
    assert.equal(diagnosticCode({ code: 'PRIVATE_CREDENTIAL_VALUE' }), 'FAILED');
    assert.equal(diagnosticCode({ code: 'PREDISPATCH', message: 'NEVER_PRINT' }), 'PREDISPATCH');
  });
  test('diagnostic rejects frame, tree, handle and record bounds with static codes', () => {
    for (const value of ['x'.repeat(1048577), Buffer.from([0xff]), '{', JSON.stringify(Array(513).fill(null)),
      JSON.stringify(Array.from({ length: 512 }, () => Array(9).fill({}))),
      JSON.stringify(Array.from({ length: 512 }, () => Object.fromEntries(Array.from({ length: 33 }, (_, i) => [i, 1]))))]) {
      assert.throws(() => diagnosticJSON(value), error => ['DIAGNOSTIC_BOUND', 'DIAGNOSTIC_SHAPE'].includes(error.code));
    }
    let deep = {}; for (let i = 0; i < 18; i++) deep = { next: deep };
    assert.throws(() => diagnosticJSON(JSON.stringify(deep)), { code: 'DIAGNOSTIC_BOUND' });
    for (const patch of [{ available_handles: Array(513).fill('x') },
      { entries: Array(513).fill({ handle: 'lmstudio/synthetic' }) }]) {
      assert.throws(() => catalogProjection({ ...catalog, ...patch }));
    }
    assert.throws(() => agentProjection(null, 'id'), { code: 'DIAGNOSTIC_SHAPE' });
  });
  test('diagnostic retains null, missing and invalid catalog predicate evidence without private values', () => {
    const absent = catalogProjection(diagnosticJSON(JSON.stringify({ type: 'list_models_response', success: false })));
    assert.equal(absent.success, false); assert.equal(absent.entriesPresent, false); assert.equal(absent.availablePresent, false);
    assert.equal(absent.entryCount, null); assert.equal(absent.selectedAvailable, null);
    const nullable = catalogProjection(diagnosticJSON(JSON.stringify({ ...catalog, entries: null, available_handles: null })));
    assert.equal(nullable.entriesPresent, true); assert.equal(nullable.entriesArray, false);
    assert.equal(nullable.availableArray, false); assert.equal(nullable.selectedCount, null);
    const malformed = catalogProjection(diagnosticJSON(JSON.stringify({ ...catalog, success: 'NEVER_PRINT',
      entries: [null, { handle: 'x'.repeat(257) }, { secret: 'NEVER_PRINT' }, ...catalog.entries],
      available_handles: [null, 1, 'x'.repeat(257), 'lmstudio/synthetic'] })));
    assert.equal(malformed.success, null); assert.equal(malformed.invalidEntryCount, 1);
    assert.equal(malformed.invalidEntryHandleCount, 2); assert.equal(malformed.invalidAvailableHandleCount, 3);
    assert.equal(malformed.selectedCount, 1); assert.equal(malformed.selectedAvailable, true);
    assert.doesNotMatch(JSON.stringify([absent, nullable, malformed]), /NEVER_PRINT|secret|x{257}/);
  });
  test('diagnostic ws observation forwards exact constructor and send arguments, only matching read phase', () => {
    let constructorArgs; let sendArgs; let aborts = 0;
    class Peer extends EventEmitter {
      constructor(...args) { super(); constructorArgs = args; }
      send(...args) { sendArgs = args; return 42; }
    }
    const observation = { phase: 'idle', abort: () => { aborts++; } };
    const Observed = observedWebSocket(Peer, observation); const options = { headers: { Authorization: 'NEVER_PRINT' } };
    const socket = new Observed('ws://synthetic', options);
    assert.equal(constructorArgs[1], options); socket.emit('message', Buffer.from('{'), true); assert.equal(aborts, 0);
    observation.phase = 'catalog';
    const payload = JSON.stringify({ type: 'list_models', request_id: 'request1', force: true }); const callback = () => {};
    assert.equal(socket.send(payload, callback), 42); assert.equal(sendArgs[0], payload); assert.equal(sendArgs[1], callback);
    socket.emit('message', Buffer.from(JSON.stringify({ type: 'unrelated_response', request_id: 'other' })), false);
    assert.equal(observation.catalog, undefined);
    socket.emit('message', Buffer.from(JSON.stringify(catalog)), false); assert.equal(observation.catalog.selectedCount, 1);
    const first = observation.catalogs;
    const settled = JSON.stringify({ type: 'list_models', request_id: 'request2', force: false });
    const sendOptions = { binary: false };
    assert.equal(socket.send(settled, sendOptions, callback), 42);
    assert.deepEqual(sendArgs, [settled, sendOptions, callback]);
    socket.emit('message', Buffer.from(JSON.stringify({ ...catalog, request_id: 'request2' })), false);
    assert.deepEqual(observation.catalogs.map(row => row.force), [true, false]);
    assert.equal(first.length, 1); assert.ok(Object.isFrozen(first));
    assert.equal(observation.catalog, observation.catalogs[1].catalog);
    for (const row of observation.catalogs) {
      assert.ok(Object.isFrozen(row)); assert.ok(Object.isFrozen(row.catalog));
      assert.ok(Object.isFrozen(row.catalog.selected)); assert.ok(Object.isFrozen(row.catalog.selected[0]));
      assert.ok(Object.isFrozen(row.catalog.selected[0].present));
    }
    socket.emit('message', Buffer.from(JSON.stringify(catalog)), false); assert.equal(observation.failure, 'DIAGNOSTIC_DUPLICATE');
    assert.equal(aborts, 1); assert.doesNotMatch(JSON.stringify(observation.catalog), /NEVER_PRINT/);
    observation.phase = 'idle'; socket.emit('message', Buffer.alloc(1048577), false); assert.equal(aborts, 1);
  });
  test('diagnostic observer rejects overlapping reordered duplicate and extra catalog evidence', () => {
    class Peer extends EventEmitter { send() {} }
    for (const kind of ['first-nonforced', 'overlap', 'wrong-id', 'early-response', 'duplicate-response',
      'second-forced', 'duplicate-id', 'third-read', 'late-first-response', 'extra-response']) {
      let aborts = 0; const observation = { phase: 'catalog', abort: () => { aborts++; } };
      const Socket = observedWebSocket(Peer, observation); const socket = new Socket();
      const send = (request_id, force) => socket.send(JSON.stringify({ type: 'list_models', request_id, force }));
      const reply = request_id => socket.emit('message', Buffer.from(JSON.stringify({ ...catalog, request_id })), false);
      if (kind === 'first-nonforced') send('request1', false);
      else if (kind === 'early-response') reply('request1');
      else {
        send('request1', true);
        if (kind === 'overlap') send('request2', false);
        else if (kind === 'wrong-id') reply('unknown-private-id');
        else {
          reply('request1');
          if (kind === 'duplicate-response') reply('request1');
          else if (kind === 'second-forced') send('request2', true);
          else if (kind === 'duplicate-id') send('request1', false);
          else {
            send('request2', false);
            if (kind === 'late-first-response') reply('request1');
            else { reply('request2'); if (kind === 'third-read') send('request3', false); else reply('request3'); }
          }
        }
      }
      assert.equal(aborts, 1, kind); assert.equal(observation.failure, 'DIAGNOSTIC_DUPLICATE');
      assert.ok(observation.catalogs.length <= 2);
      assert.doesNotMatch(JSON.stringify(observation.catalogs), /unknown-private-id|NEVER_PRINT/);
    }
  });
  test('diagnostic ws observation aborts on malformed and oversized active-phase frames', () => {
    class Peer extends EventEmitter { send() {} }
    for (const [frame, binary] of [[Buffer.from('{'), false], [Buffer.alloc(1048577), false], [Buffer.from('{}'), true]]) {
      let aborts = 0; const observation = { phase: 'catalog', abort: () => { aborts++; } };
      const Socket = observedWebSocket(Peer, observation); const socket = new Socket();
      socket.emit('message', frame, binary); assert.equal(aborts, 1); assert.equal(observation.catalog, undefined);
      assert.ok(['DIAGNOSTIC_SHAPE', 'DIAGNOSTIC_BOUND'].includes(observation.failure));
    }
  });
  test('native admission requires both explicit gates and darwin before work', () => {
    for (const [env, platform, digest] of [[{}, 'darwin', 'a'.repeat(64)], [{ WP0051_RUN_NATIVE: '1' }, 'darwin', 'a'.repeat(64)],
      [{ WP0051_RUN_NATIVE: '1', WP0051_REVIEWED_SHA256: 'b'.repeat(64) }, 'darwin', 'a'.repeat(64)],
      [{ WP0051_RUN_NATIVE: '1', WP0051_REVIEWED_SHA256: 'a'.repeat(64) }, 'linux', 'a'.repeat(64)]]) assert.throws(() => nativeGate(env, platform, digest));
    nativeGate({ WP0051_RUN_NATIVE: '1', WP0051_REVIEWED_SHA256: 'a'.repeat(64) }, 'darwin', 'a'.repeat(64));
  });
  test('late resource acquisition closes after abort and disposal failure stays explicit', async () => {
    const abort = new AbortController(); const owner = ownership(abort.signal); const gate = deferred(); let closes = 0;
    const acquiring = owner.acquire('synthetic', () => gate.promise, async () => { closes++; return true; });
    const rejected = assert.rejects(acquiring); abort.abort(); const closing = owner.close(); gate.resolve({});
    await rejected; assert.equal((await closing).confirmed, true); assert.equal(closes, 1);
    const other = ownership(new AbortController().signal); const handle = await other.acquire('uncertain', async () => ({}), async () => false);
    await assert.rejects(other.release(handle), { code: 'CLEANUP_FAILED' });
    let published = false; await assert.rejects(other.acquire('forbidden-later-boot', async () => { published = true; return {}; }, async () => true));
    assert.equal(published, false);
    assert.equal((await other.close()).confirmed, false);
  });
  const body = { model: 'synthetic', stream: true, messages: [{ role: 'system', content: `${SYSTEM_PROMPT}\n${MARKER}` }, { role: 'user', content: USER[0] }] };
  async function request(p, pathname, value, headers = {}, method = 'POST') {
    return bounded(new Promise((resolve, reject) => {
      const bytes = value === undefined ? '' : typeof value === 'string' ? value : JSON.stringify(value);
      const req = httpRequest({ hostname: '127.0.0.1', port: p.port, path: pathname, method, agent: false,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bytes), ...headers } }, res => {
        let output = ''; res.on('data', chunk => { output += chunk; if (Buffer.byteLength(output) > 8192) req.destroy(); });
        res.on('end', () => resolve({ status: res.statusCode, output })); res.on('error', reject);
      }); req.on('error', reject); req.end(bytes);
    }), 3000);
  }
  test('bounded provider discovery and one-shot SSE admit exact selected and contextless systems', async t => {
    const p = await provider(); t.after(async () => assert.equal(await p.close(), true));
    assert.equal((await request(p, '/v1/models', undefined, {}, 'GET')).status, 200);
    p.arm({ system: SYSTEM_PROMPT, contextual: true, user: USER[0], reply: REPLY[0] });
    assert.match((await request(p, '/v1/chat/completions', body)).output, /WP0051_FIRST_PERSISTED_REPLY/);
    p.arm({ system: SYSTEM_PROMPT, contextual: false, user: USER[1], reply: REPLY[1] });
    const next = { ...body, messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: USER[1] }] };
    assert.match((await request(p, '/v1/chat/completions', next)).output, /WP0051_SECOND_PERSISTED_REPLY/);
    assert.equal(p.evidence().inference, 2); assert.throws(() => p.arm({ system: SYSTEM_PROMPT }));
  });
  function partialRequest(p, t) {
    const bytes = JSON.stringify(body); let req;
    const result = bounded(new Promise((resolve, reject) => {
      req = httpRequest({ hostname: '127.0.0.1', port: p.port, path: '/v1/chat/completions', method: 'POST', agent: false,
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bytes) } }, res => {
        res.resume(); res.on('end', () => resolve(res.statusCode)); res.on('error', reject);
      });
      req.on('error', reject); req.write(bytes.slice(0, 10));
    }), 3000).catch(() => null);
    t.after(() => req.destroy());
    return { result, finish: () => req.end(bytes.slice(10)) };
  }
  async function received(p, count) {
    for (let poll = 0; poll < 100; poll++) {
      try { if (p.evidence().requests >= count) return; } catch { return; }
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('Synthetic partial requests did not arrive within the bound.');
  }
  for (const mode of ['concurrent-reuse', 'fault', 'close']) {
    test(`pending provider body cannot emit after ${mode}`, async t => {
      const p = await provider(); t.after(async () => assert.equal(await p.close(), true));
      p.arm({ system: SYSTEM_PROMPT, contextual: true, user: USER[0], reply: REPLY[0] });
      const first = partialRequest(p, t); await received(p, 1);
      const pending = [first];
      if (mode === 'concurrent-reuse') { pending.push(partialRequest(p, t)); await received(p, 2); }
      if (mode === 'fault') assert.equal((await request(p, '/v1/other', body)).status, 400);
      if (mode === 'close') assert.equal(await p.close(), true);
      for (const item of pending) item.finish();
      const statuses = await Promise.all(pending.map(item => item.result));
      t.diagnostic(JSON.stringify({ mode, statuses }));
      assert.ok(statuses.every(status => status === null || status === 400));
      if (mode !== 'close') { await bounded(p.failed, 1000); assert.throws(() => p.evidence()); }
      assert.throws(() => p.arm({ system: SYSTEM_PROMPT, contextual: false, user: USER[1], reply: REPLY[1] }));
    });
  }
  test('pending provider arm cannot be replaced before its response', async t => {
    const p = await provider(); t.after(async () => assert.equal(await p.close(), true));
    p.arm({ system: SYSTEM_PROMPT, contextual: true, user: USER[0], reply: REPLY[0] });
    const pending = partialRequest(p, t); await received(p, 1);
    assert.throws(() => p.arm({ system: SYSTEM_PROMPT, contextual: false, user: USER[1], reply: REPLY[1] }));
    pending.finish(); assert.equal(await pending.result, 200); assert.equal(p.evidence().inference, 1);
  });
  for (const mode of ['authorization', 'cookie', 'unknown-header', 'host', 'route', 'model', 'tools', 'malformed', 'oversized', 'unarmed', 'repeat', 'unselected']) {
    test(`provider rejects ${mode} without forwarding or request disclosure`, async t => {
      const p = await provider(); t.after(async () => assert.equal(await p.close(), true));
      if (mode !== 'unarmed') p.arm({ system: SYSTEM_PROMPT, contextual: true, user: USER[0], reply: REPLY[0] });
      const headers = mode === 'authorization' ? { Authorization: 'Bearer synthetic' } : mode === 'cookie' ? { Cookie: 'synthetic' }
        : mode === 'unknown-header' ? { 'X-Unknown': 'synthetic' } : mode === 'host' ? { Host: 'localhost:1' } : {};
      const value = mode === 'model' ? { ...body, model: 'foreign' } : mode === 'tools' ? { ...body, tools: [{ type: 'function', function: { name: 'Write' } }] }
        : mode === 'malformed' ? '{' : mode === 'oversized' ? 'x'.repeat(262145)
        : mode === 'unselected' ? { ...body, messages: [...body.messages, { role: 'assistant', content: UNSELECTED }] } : body;
      if (mode === 'repeat') assert.equal((await request(p, '/v1/chat/completions', body)).status, 200);
      const result = await request(p, mode === 'route' ? '/v1/other' : '/v1/chat/completions', value, headers).catch(() => null);
      assert.ok(result === null || result.status === 400 && result.output === ''); assert.throws(() => p.evidence());
    });
  }
  }
  test('actual retained local chat native journey (master only after independent frozen review)', {
    skip: mode !== 'journey', timeout: 150000,
  }, async t => {
    // Fingerprint reads only; mismatched gates cannot create native fixtures.
    nativeGate(process.env, process.platform, process.env.WP0051_REVIEWED_SHA256);
    const reviewed = await reviewFingerprint(); nativeGate(process.env, process.platform, reviewed.sha256);
    await nativeJourney(t, reviewed);
  });
  test('catalog observation only (master only after independent frozen review)', {
    skip: mode !== 'catalog', timeout: 70000,
  }, async t => {
    const reviewed = await reviewFingerprint();
    check(nativeMode(process.env, process.platform, reviewed.sha256) === 'catalog', 'NATIVE_GATE');
    await catalogDiagnostic(t, reviewed);
  });
}
