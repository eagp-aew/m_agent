// Fixed synthetic offline experiment. Run only after an independent security
// PASS for these exact sources. The digest CLI flag detects source changes and
// records operator attestation; it is NOT authentication or proof of review.
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { createRuntimeSandbox, RUNTIME_PIN } from '../personal-co/server/runtime-sandbox.mjs';
import { openCanonicalMemoryStore, CANONICAL_MEMORY_FILE } from '../personal-co/server/canonical-memory-store.mjs';
import { createMemoryBlocks } from '../personal-co/src/domain/memory.mjs';
import { encodeAppServerMemory, decodeAppServerMemory } from '../personal-co/src/domain/app-server-memory-codec.mjs';

const check = (value, code) => { if (!value) throw new Error(code); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const DENIAL = /\b(?:EPERM|EACCES)\b/;
const validId = value => typeof value === 'string' && /^agent-local-[a-zA-Z0-9-]{1,100}$/.test(value);
export const RESIDUALS = Object.freeze(['macOS disposable experiment only',
  'same-uid dependency/path replacement outside threat model', 'transitive installation trusted; CLI entry point pinned',
  'unauthenticated loopback service: synthetic data only', 'no provider or model execution',
  'no public gateway, lifecycle recovery, erasure/retention, or completed migration']);

export async function sourceDigest() {
  const sources = await Promise.all([fs.readFile(new URL('../personal-co/server/runtime-sandbox.mjs', import.meta.url)),
    fs.readFile(new URL('./probe_runtime_confinement.mjs', import.meta.url))]);
  return hash(Buffer.concat(sources));
}

export function validateEndpoint(value) {
  const match = typeof value === 'string' && /^ws:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/ws$/.exec(value);
  check(match && match[0] === value && Number(match[1]) <= 65535, 'invalid_endpoint');
  return value;
}

/** Owned detached process group; never shells, scans processes, or kills by name.
 * All injections in this file are trusted tests, not runtime/client input. */
export function startOwned(spec, { spawnImpl = spawn, signalGroup = process.kill.bind(process),
  startupMs = 15000, stopMs = 1000, maxLogBytes = 65536 } = {}) {
  check(Number.isInteger(startupMs) && startupMs > 0 && startupMs <= 15000
    && Number.isInteger(stopMs) && stopMs > 0 && stopMs <= 2000
    && Number.isInteger(maxLogBytes) && maxLogBytes > 0 && maxLogBytes <= 65536, 'invalid_process_bounds');
  const child = spawnImpl(spec.command, [...spec.args], { ...spec.options, env: { ...spec.options.env },
    stdio: [...spec.options.stdio] });
  const pid = child.pid;
  let complete = false;
  let failure;
  let output = '';
  let bytes = 0;
  let result;
  const listeners = new Set();
  const notify = () => { for (const fn of [...listeners]) fn(); };
  const done = new Promise(resolve => {
    child.once('error', () => { failure = 'child_error'; notify(); });
    child.once('close', (code, signal) => { complete = true; result = { code, signal }; resolve(result); notify(); });
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', chunk => {
    bytes += Buffer.byteLength(chunk);
    if (bytes > maxLogBytes) failure = 'log_limit';
    else output += chunk.toString();
    notify();
  });
  async function until(read, timeoutCode) {
    return new Promise((resolve, reject) => {
      const finish = (error, value) => { clearTimeout(timer); listeners.delete(poll); error ? reject(new Error(error)) : resolve(value); };
      const poll = () => {
        if (failure) return finish(failure);
        let value;
        try { value = read(); } catch { return finish('invalid_child_output'); }
        if (value !== undefined) return finish(null, value);
        if (complete) finish('child_exited');
      };
      const timer = setTimeout(() => finish(timeoutCode), startupMs);
      listeners.add(poll); poll();
    });
  }
  let stopping;
  return {
    pid, done,
    endpoint: () => until(() => {
      const lines = output.split('\n');
      lines.pop(); // Never accept a partial/unbounded log line as an endpoint.
      const listening = lines.filter(line => line.startsWith('Listening on '));
      const websocket = lines.filter(line => line.startsWith('WebSocket: '));
      check(listening.length <= 1 && websocket.length <= 1, 'multiple_endpoints');
      const baseEndpoint = listening.length ? validateEndpoint(`${listening[0].slice(13)}/ws`) : undefined;
      const controlEndpoint = websocket.length ? validateEndpoint(websocket[0].slice(11)) : undefined;
      if (baseEndpoint === undefined || controlEndpoint === undefined) return undefined;
      check(baseEndpoint === controlEndpoint, 'endpoint_mismatch');
      return controlEndpoint;
    }, 'startup_timeout'),
    output: () => until(() => complete ? (check(result.code === 0, 'child_failed'), output) : undefined, 'child_timeout'),
    stop() {
      stopping ??= (async () => {
        if (!Number.isInteger(pid) || pid <= 1) {
          check(complete || failure === 'child_error', 'missing_child_pid');
          return { pid: null, reaped: complete, groupGone: true };
        }
        const signal = value => { try { signalGroup(-pid, value); return true; }
          catch (error) { if (error.code === 'ESRCH') return false; throw new Error('cleanup_signal_failed'); } };
        if (signal(0)) signal('SIGTERM');
        if (!complete) await Promise.race([done, delay(stopMs)]);
        if (signal(0)) signal('SIGKILL');
        if (!complete) await Promise.race([done, delay(stopMs)]);
        // Allow the kernel to reap short-lived group descendants after SIGKILL.
        for (let i = 0; i < 10 && signal(0); i++) await delay(20);
        check(complete && !signal(0), 'cleanup_incomplete');
        return { pid, reaped: true, groupGone: true, exit: result, logBytes: bytes };
      })();
      return stopping;
    },
  };
}

export async function connectConfinementProtocol(endpoint, { stateFile, protectedFile, marker,
  WebSocketImpl = globalThis.WebSocket, timeoutMs = 5000 } = {}) {
  validateEndpoint(endpoint);
  check(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 5000, 'invalid_timeout');
  const socket = new WebSocketImpl(endpoint);
  let pending;
  let closed = false;
  let opened = false;
  let count = 0;
  let bytes = 0;
  let connectResolve;
  let connectReject;
  let closeResolve;
  const didClose = new Promise(resolve => { closeResolve = resolve; });
  const connected = new Promise((resolve, reject) => { connectResolve = resolve; connectReject = reject; });
  const close = () => { if (!closed) { closed = true; socket.close(); } };
  const fail = code => {
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(code)); pending = undefined; }
    clearTimeout(connectTimer);
    if (!opened) connectReject(new Error(code));
    close();
  };
  const connectTimer = setTimeout(() => fail('connect_timeout'), timeoutMs);
  socket.addEventListener('open', () => { if (!closed) { opened = true; clearTimeout(connectTimer); connectResolve(); } });
  socket.addEventListener('error', () => fail('socket_error'));
  socket.addEventListener('close', () => { closeResolve(); fail('socket_closed'); });
  socket.addEventListener('message', event => {
    if (closed) return;
    if (typeof event.data !== 'string' || ++count > 60 || (bytes += Buffer.byteLength(event.data)) > 262144) return fail('message_limit');
    let message;
    try { message = JSON.parse(event.data); } catch { return fail('invalid_message'); }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return fail('invalid_message');
    // Unsolicited tools/permission instructions are never answered.
    if (!pending || message.request_id !== pending.id) return;
    if (message.type !== `${pending.type}_response` || typeof message.success !== 'boolean') return fail('invalid_response');
    const current = pending; pending = undefined; clearTimeout(current.timer); current.resolve(message);
  });
  await connected;
  let requests = 0;
  let agentCreated = false;
  return {
    close,
    async closed() {
      await Promise.race([didClose, delay(timeoutMs).then(() => { throw new Error('socket_cleanup_timeout'); })]);
    },
    request(type, fields = {}) {
      check(!closed && !pending && ++requests <= 12, 'transport_unavailable');
      const keys = Object.keys(fields).sort().join(',');
      const file = fields.path === stateFile || fields.path === protectedFile;
      const allowed = (type === 'app_server_info' && keys === '')
        || (type === 'agent_create' && !agentCreated && keys === 'body'
          && isDeepStrictEqual(fields.body, { name: marker, tags: [marker], tools: [], memory_blocks: [] }))
        || (type === 'read_file' && keys === 'encoding,path' && fields.encoding === 'utf8' && file)
        || (type === 'write_file' && keys === 'content,path' && fields.content === `${marker}:native\n` && file)
        || (['read_memory_file', 'write_memory_file'].includes(type) && validId(fields.agent_id)
          && fields.path === 'wp0044/synthetic.md' && fields.encoding === 'utf8'
          && (type === 'read_memory_file' ? keys === 'agent_id,encoding,path'
            : keys === 'agent_id,content,encoding,path' && fields.content === `${marker}:agent-memory\n`));
      check(allowed, 'forbidden_command');
      if (type === 'agent_create') agentCreated = true;
      return new Promise((resolve, reject) => {
        const id = randomUUID();
        pending = { id, type, resolve, reject, timer: setTimeout(() => fail('request_timeout'), timeoutMs) };
        try { socket.send(JSON.stringify({ type, request_id: id, ...fields })); } catch { fail('send_failed'); }
      });
    },
  };
}

// Executed only in the already-reviewed profile by the fixed probe. Every
// target is a fresh synthetic path; no real home, credentials or external tools.
export function syscallSource({ stateRoot, protectedRoot, canaryFile }) {
  const data = JSON.stringify({ stateRoot, protectedRoot, canaryFile, canonical: CANONICAL_MEMORY_FILE });
  return `const fs=require('node:fs/promises'),net=require('node:net'),p=require('node:path');
const {stateRoot:s,protectedRoot:r,canaryFile:c,canonical}=JSON.parse(${JSON.stringify(data)});
const f=p.join(r,canonical),a=p.join(s,'syscall-source'),alias=p.join(s,'protected-alias');
(async()=>{const results=[];
await fs.writeFile(a,'synthetic syscall control\\n',{flag:'wx',mode:0o600});
if(await fs.readFile(a,'utf8')!=='synthetic syscall control\\n')throw Error('control');
async function deny(name,fn){try{await fn();throw Error('unexpected_success:'+name)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e;results.push({name,code:e.code});}}
await deny('read',()=>fs.readFile(f));
await deny('write',()=>fs.writeFile(f,'synthetic attack'));
await deny('directory_read',()=>fs.readdir(r));
await deny('directory_create',()=>fs.mkdir(p.join(r,'attack-directory')));
await deny('rename_out',()=>fs.rename(f,p.join(s,'renamed-out')));
await deny('rename_in',()=>fs.rename(a,f));
await deny('directory_rename',()=>fs.rename(r,p.join(s,'renamed-directory')));
await deny('link_out',()=>fs.link(f,p.join(s,'linked-out')));
await deny('link_in',()=>fs.link(a,p.join(r,'linked-in')));
await fs.symlink(r,alias);
await deny('symlink_read',()=>fs.readFile(p.join(alias,canonical)));
await deny('symlink_write',()=>fs.writeFile(p.join(alias,canonical),'synthetic attack'));
await deny('canary_read',()=>fs.readFile(c));
await deny('canary_write',()=>fs.writeFile(c,'synthetic attack'));
await deny('outbound',()=>new Promise((resolve,reject)=>{const socket=net.connect({host:'192.0.2.1',port:443});const timer=setTimeout(()=>{socket.destroy();reject(Error('network_timeout'))},1000);socket.once('connect',()=>{clearTimeout(timer);socket.destroy();resolve()});socket.once('error',e=>{clearTimeout(timer);socket.destroy();reject(e)})}));
process.stdout.write(JSON.stringify({control:true,results})+'\\n');
})().catch(()=>{process.stderr.write('syscall_probe_failed\\n');process.exitCode=1});`;
}
const SYSCALLS = ['read', 'write', 'directory_read', 'directory_create', 'rename_out', 'rename_in',
  'directory_rename', 'link_out', 'link_in', 'symlink_read', 'symlink_write', 'canary_read', 'canary_write', 'outbound'];

export async function listenerGone(endpoint, { connect = net.connect } = {}) {
  validateEndpoint(endpoint);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port: Number(new URL(endpoint).port) });
    const timer = setTimeout(() => { socket.destroy(); reject(new Error('listener_check_timeout')); }, 1000);
    socket.once('connect', () => { clearTimeout(timer); socket.destroy(); reject(new Error('listener_remains')); });
    socket.once('error', error => { clearTimeout(timer); socket.destroy();
      error.code === 'ECONNREFUSED' ? resolve(true) : reject(new Error('listener_check_failed')); });
  });
}

export async function runConfinementProbe({ dependencyRoot, reviewedSourceSha256 } = {}, {
  makeSpec = createRuntimeSandbox, start = startOwned, connect = connectConfinementProtocol,
  checkListenerGone = listenerGone, platform = process.platform, cancellationSignal,
} = {}) {
  check(platform === 'darwin', 'unsupported_platform');
  check(typeof reviewedSourceSha256 === 'string' && /^[a-f0-9]{64}$/.test(reviewedSourceSha256)
    && reviewedSourceSha256 === await sourceDigest(), 'review_digest_mismatch');
  const report = { schema: 'wp0044-confinement-v1', outcome: 'stopped', pin: RUNTIME_PIN,
    reviewedSourceSha256, platform, nodeVersion: process.versions.node, results: [], cleanup: [], residuals: RESIDUALS };
  let store;
  let client;
  let endpoint;
  const children = [];
  const cancel = () => {
    client?.close();
    // stop() is idempotent; finally still awaits and records every result.
    for (const child of children) void child.stop().catch(() => {});
  };
  cancellationSignal?.addEventListener('abort', cancel, { once: true });
  let stage = 'fixture';
  try {
    check(!cancellationSignal?.aborted, 'probe_cancelled');
    // No input may select a data target. All synthetic directories are retained.
    const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0044-'));
    report.fixtureRoot = root;
    const stateRoot = path.join(root, 'state');
    const protectedRoot = path.join(root, 'protected');
    const unrelated = path.join(root, 'unrelated');
    for (const directory of [stateRoot, protectedRoot, unrelated]) await fs.mkdir(directory, { mode: 0o700 });
    const marker = `wp0044-${randomUUID()}`;
    const canaryFile = path.join(unrelated, 'canary.txt');
    const canary = `${marker}:unrelated\n`;
    await fs.writeFile(canaryFile, canary, { flag: 'wx', mode: 0o600 });
    const stateFile = path.join(stateRoot, 'native-control.txt');
    const protectedFile = path.join(protectedRoot, CANONICAL_MEMORY_FILE);
    stage = 'launch_validation';
    const spec = await makeSpec({ dependencyRoot, stateRoot, protectedRoot });
    report.profileSha256 = spec.profileSha256;
    report.roots = spec.roots;
    stage = 'startup';
    check(!cancellationSignal?.aborted, 'probe_cancelled');
    const runtime = start(spec); children.push(runtime);
    endpoint = validateEndpoint(await runtime.endpoint()); report.endpoint = endpoint;
    client = await connect(endpoint, { stateFile, protectedFile, marker });
    stage = 'runtime_identity';
    const info = await client.request('app_server_info');
    check(info.success && info.backend === 'local' && info.letta_code_version === RUNTIME_PIN.version
      && info.protocol_version === 1 && info.capabilities?.agent_management && info.capabilities?.memory_management, 'runtime_mismatch');
    const created = await client.request('agent_create', { body: { name: marker, tags: [marker], tools: [], memory_blocks: [] } });
    const agent = created.agent;
    check(created.success && validId(agent?.id) && agent.name === marker
      && isDeepStrictEqual(agent.tags, [marker, 'git-memory-enabled']), 'agent_mismatch');
    report.agentId = agent.id;
    stage = 'host_initialize';
    store = await openCanonicalMemoryStore({ directory: protectedRoot, agentId: agent.id });
    const initial = { agentId: agent.id, revision: 0, blocks: createMemoryBlocks('synthetic persona', 'synthetic policy')
      .map((block, index) => ({ ...block, id: `synthetic-block-${index}`, metadata: { marker } })),
    archive: [{ id: 'synthetic-archive', text: `${marker}\n  exact 🙂`, tags: ['a', 'a', 'b'] }] };
    await store.initialize(initial);
    const before = await fs.readFile(protectedFile);
    const expected = decodeAppServerMemory(encodeAppServerMemory(initial), agent.id);
    check(isDeepStrictEqual(await store.read(), expected), 'host_initial_mismatch');
    report.canonicalBeforeSha256 = hash(before);
    stage = 'native_control';
    const native = `${marker}:native\n`;
    const write = await client.request('write_file', { path: stateFile, content: native });
    check(write.success && write.path === stateFile, 'native_write_control_failed');
    const read = await client.request('read_file', { path: stateFile, encoding: 'utf8' });
    check(read.success && read.path === stateFile && read.content === native && await fs.readFile(stateFile, 'utf8') === native, 'native_read_control_failed');
    const memory = { agent_id: agent.id, path: 'wp0044/synthetic.md', encoding: 'utf8' };
    const memoryWrite = await client.request('write_memory_file', { ...memory, content: `${marker}:agent-memory\n` });
    const memoryRead = await client.request('read_memory_file', memory);
    check([memoryWrite, memoryRead].every(item => item.success && item.agent_id === agent.id && item.path === memory.path)
      && memoryRead.content === `${marker}:agent-memory\n`, 'agent_memory_control_failed');
    report.results.push({ name: 'allowed_native_and_agent_memory', observation: 'exact_roundtrip' });
    stage = 'native_denials';
    for (const type of ['read_file', 'write_file']) {
      const response = await client.request(type, type === 'read_file'
        ? { path: protectedFile, encoding: 'utf8' } : { path: protectedFile, content: native });
      check(response.success === false && response.path === protectedFile && DENIAL.test(response.error)
        && (type !== 'read_file' || response.content === null), 'native_denial_not_observed');
      report.results.push({ name: type, observation: 'denied', code: response.error.match(DENIAL)[0] });
    }
    stage = 'syscall_denials';
    check(!cancellationSignal?.aborted, 'probe_cancelled');
    const syscall = start({ ...spec, args: ['-p', spec.profile, RUNTIME_PIN.nodePath, '-e', syscallSource({ stateRoot, protectedRoot, canaryFile })] });
    children.push(syscall);
    const attacks = JSON.parse((await syscall.output()).trim());
    check(attacks.control === true && Array.isArray(attacks.results) && attacks.results.length === SYSCALLS.length
      && attacks.results.every((item, index) => item.name === SYSCALLS[index] && ['EPERM', 'EACCES'].includes(item.code)), 'syscall_denial_not_observed');
    report.results.push({ name: 'same_profile_syscalls', observation: 'denied', results: attacks.results });
    stage = 'host_preserved_and_commit';
    const after = await fs.readFile(protectedFile);
    check(before.equals(after) && isDeepStrictEqual(await store.read(), expected)
      && await fs.readFile(canaryFile, 'utf8') === canary, 'protected_data_changed');
    report.canonicalAfterAttacksSha256 = hash(after);
    const next = structuredClone(expected); next.revision = 1;
    next.blocks.find(block => block.label === 'CURRENT_CONTEXT').value = `${marker}:host-approved revision\n`;
    const committed = await store.commit(next, { expectedRevision: 0 });
    check(isDeepStrictEqual(committed, next) && isDeepStrictEqual(await store.read(), next)
      && await fs.readFile(protectedFile, 'utf8') === encodeAppServerMemory(next), 'host_commit_mismatch');
    report.canonicalCommittedSha256 = hash(await fs.readFile(protectedFile));
    report.results.push({ name: 'host_store', observation: 'exact_preserved_then_committed', revision: 1 });
    check(!cancellationSignal?.aborted, 'probe_cancelled');
    report.outcome = 'observations_complete';
  } catch (error) {
    // Do not expose upstream logs, errors, unsolicited content or private paths.
    report.error = { stage, code: /^[a-z_]+$/.test(error.message) ? error.message : 'probe_failed' };
  } finally {
    client?.close();
    for (const child of children.reverse()) {
      try { report.cleanup.push(await child.stop()); }
      catch { report.cleanup.push({ pid: child.pid, reaped: false, groupGone: false }); report.outcome = 'stopped'; report.cleanupError = 'child_cleanup_failed'; }
    }
    if (client) { try { await client.closed(); } catch { report.outcome = 'stopped'; report.cleanupError = 'socket_cleanup_failed'; } }
    if (endpoint) { try { report.listenerGone = await checkListenerGone(endpoint); }
      catch { report.outcome = 'stopped'; report.cleanupError = 'listener_cleanup_failed'; } }
    if (store) { try { await store.close(); } catch { report.outcome = 'stopped'; report.cleanupError = 'store_close_failed'; } }
    cancellationSignal?.removeEventListener('abort', cancel);
    if (cancellationSignal?.aborted) { report.outcome = 'stopped'; report.error = { stage, code: 'probe_cancelled' }; }
  }
  return report;
}

async function main() {
  const [rootFlag, dependencyRoot, reviewFlag, reviewedSourceSha256, ...extra] = process.argv.slice(2);
  check(rootFlag === '--dependency-root' && typeof dependencyRoot === 'string'
    && reviewFlag === '--reviewed-source-sha256' && extra.length === 0, 'invalid_arguments');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
  try {
    const report = await runConfinementProbe({ dependencyRoot, reviewedSourceSha256 }, { cancellationSignal: controller.signal });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (report.outcome !== 'observations_complete') process.exitCode = 1;
  } finally {
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write('Confinement probe preflight failed; no retry performed.\n'); process.exitCode = 1; });
}
