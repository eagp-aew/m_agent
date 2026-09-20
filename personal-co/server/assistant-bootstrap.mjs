import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { openCanonicalMemoryStore, CANONICAL_MEMORY_FILE } from './canonical-memory-store.mjs';
import { createMemoryBlocks, POLICY_MEMORY_LABELS } from '../src/domain/memory.mjs';
import { PERSONA_TEXT, MEMORY_POLICY_TEXT } from '../src/domain/policy.mjs';
import { decodeAppServerMemory } from '../src/domain/app-server-memory-codec.mjs';

export const BOOTSTRAP_INTENT = 'assistant-bootstrap.json';
export const BOOTSTRAP_LOCK = 'assistant-bootstrap.lock';
const TAG = 'personal-co-v1';
const MAX_CANONICAL_BYTES = 1048576;
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const fail = code => { throw Object.assign(new Error('Assistant initialization failed.'), { code }); };
const check = (value, code) => { if (!value) fail(code); };
const id = value => typeof value === 'string' && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value;
const markerValid = value => typeof value === 'string'
  && /^personal-co-bootstrap-v1-[a-f0-9]{32}$/.exec(value)?.[0] === value;
function fields(value, keys) {
  check(value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INVALID_CONFIG');
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(keys.includes(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value'), 'INVALID_CONFIG');
  }
}

/**
 * Trusted host-only first-run preparation, BEFORE runtime spawn. Holds a separate
 * cooperative protected-directory lock; does not own the runtime. resolve(client)
 * runs once after authentication. close() drains it and releases only our exact
 * lock. Never steal stale locks or erase intent/canonical/native data.
 *
 * Intent existence means creation MAY have happened, even after a partial write
 * or lost response. Existing intent never authorizes another create. Only its
 * native-visible singleton marker can resume missing canonical initialization.
 * Marker is a correlation label, not authentication against a hostile same-uid
 * writer. Host controls both canonical directories throughout this operation.
 * Native MemFS is not canonical; no canonical contents are sent to the runtime.
 * Store extensions are host-owned: this module validates, never changes, binding
 * on reopen; the independent store is not an extension-authorization mechanism.
 * Intent is capped at 4096 bytes and canonical memory at 1 MiB; oversized records
 * fail closed and remain untouched, not an arbitrary-size reopen guarantee.
 * Durability is local sync/no-clobber only; no migration or automatic recovery.
 * Third argument is a trusted bounded filesystem/store test seam only.
 */
export async function prepareAssistantBootstrap(input, options = {}, { io = fs, openStore = openCanonicalMemoryStore } = {}) {
  fields(input, ['dependencyRoot', 'stateRoot', 'protectedRoot']); fields(options, ['signal']);
  const roots = Object.freeze({ stateRoot: input.stateRoot, protectedRoot: input.protectedRoot });
  const signal = options.signal;
  check(signal === undefined || signal instanceof AbortSignal, 'INVALID_CONFIG');
  check(typeof process.getuid === 'function' && constants.O_NOFOLLOW, 'UNSUPPORTED');
  const uid = process.getuid();
  for (const root of Object.values(roots)) check(typeof root === 'string' && path.isAbsolute(root)
    && path.normalize(root) === root && /^\/private\/tmp\/[^/]+\/[^/]+(?:\/[^/]+)*$/.exec(root)?.[0] === root, 'UNSAFE_PATH');
  check(!Object.values(roots).some((a, index, all) => all.some((b, other) => index !== other
    && (a === b || a.startsWith(`${b}/`)))), 'UNSAFE_PATH');
  const intentPath = path.join(roots.protectedRoot, BOOTSTRAP_INTENT);
  const lockPath = path.join(roots.protectedRoot, BOOTSTRAP_LOCK);
  const lockToken = randomBytes(32).toString('hex');
  let stateStat; let protectedStat; let directory; let lock; let lockStat;
  let intent; let intentText; let intentStat; let fresh; let accepting = true; let task; let closing; let cleanupProblem = false;
  let validated; let resolved = false; let readTail = Promise.resolve();
  const active = () => check(accepting && !signal?.aborted, 'ABORTED');
  function privateFile(stat, maxBytes) {
    check(stat.isFile() && stat.uid === uid && (stat.mode & 0o7777) === 0o600
      && stat.nlink === 1 && stat.size <= maxBytes, 'UNSAFE_PATH');
  }
  async function checkDirectory(root, expected) {
    const stat = await io.lstat(root);
    check(stat.isDirectory() && stat.uid === uid && (stat.mode & 0o7777) === 0o700
      && await io.realpath(root) === root && (!expected || same(stat, expected)), 'UNSAFE_PATH');
    return stat;
  }
  async function read(file, maxBytes, missing = false) {
    let before;
    try { before = await io.lstat(file); } catch (error) { if (missing && error.code === 'ENOENT') return null; throw error; }
    privateFile(before, maxBytes);
    const handle = await io.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await handle.stat(); privateFile(stat, maxBytes); check(same(stat, before), 'UNSAFE_PATH');
      const bytes = Buffer.alloc(maxBytes + 1); const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      check(bytesRead <= maxBytes && bytesRead === stat.size, 'UNSAFE_PATH');
      const after = await io.lstat(file); privateFile(after, maxBytes);
      check(same(stat, after) && stat.size === after.size && stat.mtimeMs === after.mtimeMs, 'UNSAFE_PATH');
      const content = bytes.subarray(0, bytesRead);
      return { stat, text: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(content),
        digest: createHash('sha256').update(content).digest('hex') };
    } finally { try { await handle.close(); } catch { cleanupProblem = true; fail('CLEANUP_FAILED'); } }
  }
  async function owner() {
    await checkDirectory(roots.stateRoot, stateStat); await checkDirectory(roots.protectedRoot, protectedStat);
    const current = await read(lockPath, 128);
    check(same(current.stat, lockStat) && current.text === lockToken, 'LOCK_LOST');
  }
  async function checkIntent() {
    const current = await read(intentPath, 4096);
    check(same(current.stat, intentStat) && current.text === intentText, 'INTENT_CHANGED');
  }
  async function release() {
    let problem;
    if (lock) {
      try { await owner(); await io.unlink(lockPath); await directory.sync(); } catch { problem = 'LOCK_LOST'; }
      try { await lock.close(); } catch { problem ??= 'CLEANUP_FAILED'; } lock = undefined;
    }
    if (directory) { try { await directory.close(); } catch { problem ??= 'CLEANUP_FAILED'; } directory = undefined; }
    if (problem) fail(problem);
  }
  try {
    active(); stateStat = await checkDirectory(roots.stateRoot); protectedStat = await checkDirectory(roots.protectedRoot);
    directory = await io.open(roots.protectedRoot, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    check(same(protectedStat, await directory.stat()), 'UNSAFE_PATH'); active();
    try { lock = await io.open(lockPath, constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch (error) { if (error.code === 'EEXIST') fail('LOCKED'); throw error; }
    lockStat = await lock.stat(); privateFile(lockStat, 128);
    await lock.writeFile(lockToken, 'utf8'); await lock.sync(); await owner(); active();
    const existing = await read(intentPath, 4096, true);
    const entries = await io.readdir(roots.protectedRoot);
    if (existing) {
      intent = JSON.parse(existing.text);
      check(intent && intent.schema === 'personal-co-bootstrap' && intent.version === 1
        && intent.stateRoot === roots.stateRoot && intent.protectedRoot === roots.protectedRoot
        && markerValid(intent.marker), 'INVALID_INTENT');
      const expected = { schema: 'personal-co-bootstrap', version: 1, ...roots, marker: intent.marker };
      check(JSON.stringify(expected) === existing.text, 'INVALID_INTENT');
      intentText = existing.text; intentStat = existing.stat; fresh = false;
      const canonical = await read(path.join(roots.protectedRoot, CANONICAL_MEMORY_FILE), MAX_CANONICAL_BYTES, true);
      const receipts = entries.includes('operations.sqlite');
      const journal = entries.includes('operations.sqlite-journal');
      check(entries.every(name => [BOOTSTRAP_LOCK, BOOTSTRAP_INTENT, CANONICAL_MEMORY_FILE,
        'operations.sqlite', 'operations.sqlite-journal'].includes(name))
        && (!receipts || canonical !== null) && (!journal || receipts), 'EXISTING_DATA');
      // Metadata admission only. The managed receipt owner validates schema and
      // exact Agent binding after canonical bootstrap resolves. No DB IO/replay.
      for (const name of ['operations.sqlite', 'operations.sqlite-journal']) {
        if (!entries.includes(name)) continue;
        const file = path.join(roots.protectedRoot, name);
        privateFile(await io.lstat(file), 256 * 1024 * 1024);
        check(await io.realpath(file) === file, 'UNSAFE_PATH');
      }
    } else {
      check(entries.length === 1 && entries[0] === BOOTSTRAP_LOCK && (await io.readdir(roots.stateRoot)).length === 0, 'EXISTING_DATA');
      fresh = true;
    }
    await owner(); active();
  } catch (error) {
    try { await release(); } catch { fail('CLEANUP_FAILED'); }
    check(!cleanupProblem, 'CLEANUP_FAILED');
    fail(['ABORTED', 'LOCKED', 'UNSAFE_PATH', 'LOCK_LOST', 'INVALID_INTENT', 'EXISTING_DATA'].includes(error.code) ? error.code : 'IO');
  }
  function agent(record, marker, expected) {
    check(record && id(record.id) && (!expected || record.id === expected) && record.hidden !== true
      && Array.isArray(record.tags) && record.tags.length <= 32 && record.tags.every(tag => typeof tag === 'string' && tag.length <= 256)
      && record.tags.includes(TAG) && record.tags.filter(tag => tag.startsWith('personal-co-bootstrap-v1-')).length === 1
      && record.tags.includes(marker), 'AGENT_MISMATCH');
    return record.id;
  }
  async function inventory(client) {
    active(); const response = await client.request('agent_list', { query: { tags: [TAG], limit: 2 } }, { signal }); active();
    check(response?.success === true && Array.isArray(response.agents) && response.agents.length <= 2, 'AGENT_MISMATCH');
    return response.agents;
  }
  function validateMemory(memory, { agentId, runtimeBinding, defaults }) {
    check(memory.agentId === agentId && isDeepStrictEqual(memory.runtimeBinding, runtimeBinding)
      && memory.blocks.length === defaults.length && memory.blocks.every(block => {
        const expected = defaults.find(item => item.label === block.label);
        return expected && block.id === expected.id && block.readOnly === expected.readOnly && block.limit === expected.limit
          && (!POLICY_MEMORY_LABELS.includes(block.label) || block.value === expected.value);
      }), 'CANONICAL_MISMATCH');
  }
  async function resolve(client) {
    active(); await owner(); active();
    let records = await inventory(client); let createdId;
    if (fresh) {
      check(records.length === 0, 'AGENT_MISMATCH');
      intent = { schema: 'personal-co-bootstrap', version: 1, ...roots,
        marker: `personal-co-bootstrap-v1-${randomBytes(16).toString('hex')}` };
      intentText = JSON.stringify(intent);
      await owner(); active();
      // Direct exclusive publication intentionally retains partial bytes on any
      // unknown outcome. There is no erase/replay path for an existing intent.
      const handle = await io.open(intentPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { intentStat = await handle.stat(); privateFile(intentStat, 4096); active();
        await handle.writeFile(intentText, 'utf8'); await handle.sync();
      } finally { await handle.close(); }
      await directory.sync(); await checkIntent(); await owner(); active();
      const result = await client.createAssistantAgent(intent.marker, { signal }); active();
      check(result?.success === true, 'AGENT_MISMATCH'); createdId = agent(result.agent, intent.marker);
      records = await inventory(client);
    }
    check(records.length === 1, 'AGENT_MISMATCH');
    const agentId = agent(records[0], intent.marker, createdId);
    const result = await client.request('agent_retrieve', { agent_id: agentId }, { signal }); active();
    check(result?.success === true, 'AGENT_MISMATCH'); agent(result.agent, intent.marker, agentId);
    await checkIntent(); await owner(); active();
    const runtimeBinding = { schema: 'personal-co-runtime-binding', version: 1, ...roots, marker: intent.marker, agentId };
    const defaults = createMemoryBlocks(PERSONA_TEXT, MEMORY_POLICY_TEXT).map(block => ({
      id: `block-${intent.marker.slice(-32)}-${block.label}`, ...block,
    }));
    let store;
    try {
      const before = await read(path.join(roots.protectedRoot, CANONICAL_MEMORY_FILE), MAX_CANONICAL_BYTES, true); active();
      if (before) decodeAppServerMemory(before.text, agentId);
      try { store = await openStore({ directory: roots.protectedRoot, agentId }); }
      catch {
        // The store can reject acquisition while retaining an uncertain lock.
        // No returned handle is not proof of cleanup; do not release the lease.
        cleanupProblem = true; fail('CLEANUP_FAILED');
      }
      active();
      let memory;
      try { memory = await store.read(); }
      catch (error) {
        if (error.code !== 'MISSING' || before) throw error;
        await owner(); await checkIntent(); active();
        memory = await store.initialize({ agentId, revision: 0, blocks: defaults, archive: [], runtimeBinding });
      }
      active();
      validated = { agentId, runtimeBinding, defaults };
      validateMemory(memory, validated);
      await owner(); await checkIntent(); active();
      return Object.freeze({ agentId });
    } finally {
      if (store) try { await store.close(); } catch { cleanupProblem = true; fail('CLEANUP_FAILED'); }
    }
  }
  return Object.freeze({
    assertOwnership() {
      if (!accepting || signal?.aborted) return Promise.reject(Object.assign(new Error('Assistant ownership unavailable.'), { code: 'OWNERSHIP_UNAVAILABLE' }));
      const checking = readTail.then(async () => {
        active(); await owner(); if (intentStat) await checkIntent();
        await owner(); active();
      }).catch(() => { throw Object.assign(new Error('Assistant ownership unavailable.'), { code: 'OWNERSHIP_UNAVAILABLE' }); });
      readTail = checking.catch(() => {}); return checking;
    },
    resolve(client) {
      if (task || !accepting) return Promise.reject(Object.assign(new Error('Assistant initialization failed.'), { code: 'ALREADY_ATTEMPTED' }));
      task = resolve(client).then(result => { resolved = true; return result; })
        .catch(() => fail(signal?.aborted || !accepting ? 'ABORTED' : 'INITIALIZATION_FAILED'));
      return task;
    },
    readMemory() {
      if (!resolved || !accepting || signal?.aborted) return Promise.reject(Object.assign(new Error('Assistant memory read unavailable.'), { code: 'MEMORY_UNAVAILABLE' }));
      const reading = readTail.then(async () => {
        active(); await owner(); await checkIntent(); active();
        const record = await read(path.join(roots.protectedRoot, CANONICAL_MEMORY_FILE), MAX_CANONICAL_BYTES);
        const memory = decodeAppServerMemory(record.text, validated.agentId);
        validateMemory(memory, validated);
        await owner(); await checkIntent(); active();
        return Object.freeze({ memory, digest: record.digest });
      }).catch(() => { throw Object.assign(new Error('Assistant memory read unavailable.'), { code: 'MEMORY_UNAVAILABLE' }); });
      readTail = reading.catch(() => {}); return reading;
    },
    close() {
      if (!closing) { accepting = false; closing = Promise.resolve(task).catch(() => {}).then(async () => {
        await readTail;
        await release(); check(!cleanupProblem, 'CLEANUP_FAILED');
      }); }
      return closing;
    },
  });
}
