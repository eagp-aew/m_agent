import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { encodeAppServerMemory, decodeAppServerMemory } from '../src/domain/app-server-memory-codec.mjs';
import { POLICY_MEMORY_LABELS } from '../src/domain/memory.mjs';

export const CANONICAL_MEMORY_FILE = 'canonical-memory.json';
export const CANONICAL_MEMORY_LOCK = 'canonical-memory.lock';
const INITIAL_TEMP = '.canonical-memory-initialize.tmp';

const messages = Object.freeze({
  INVALID: 'Invalid canonical memory request.',
  UNSAFE_PATH: 'Unsafe canonical memory filesystem target.',
  LOCKED: 'Canonical memory already has an owner.',
  LOCK_LOST: 'Canonical memory ownership was lost.',
  CORRUPT: 'Invalid canonical memory record.',
  MISSING: 'Canonical memory requires explicit initialization.',
  EXISTS: 'Canonical memory is already initialized.',
  CONFLICT: 'Canonical memory revision conflict.',
  PROTECTED: 'Protected canonical memory fields cannot change.',
  CONFIRMATION_REQUIRED: 'Canonical memory change requires explicit confirmation.',
  CLOSED: 'Canonical memory store is closed.',
  IO: 'Canonical memory filesystem operation failed.',
  UNKNOWN_OUTCOME: 'Canonical memory write outcome is unknown; reconcile by reading or reopening.',
  POISONED: 'Canonical memory writer requires close and reopen before another write.',
});

export class CanonicalMemoryStoreError extends Error {
  constructor(code) {
    super(messages[code]);
    this.name = 'CanonicalMemoryStoreError';
    this.code = code;
  }
}

const fail = (code) => { throw new CanonicalMemoryStoreError(code); };
const sanitized = (error) => error instanceof CanonicalMemoryStoreError
  ? error : new CanonicalMemoryStoreError('IO');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const safeRevision = (value) => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);

/**
 * Host-only, cooperative Unix-local store. The caller supplies an existing,
 * canonical absolute directory owned by this uid with mode 0700, and an exact
 * Agent ID. No directory creation, migration, repair, stale-lock stealing, or
 * import-time I/O occurs. Existing files must be private, owned, regular and
 * singly linked, except a proven retained initialization alias after a failed
 * unlink. That private alias can retain sensitive data until explicit lifecycle
 * recovery; reopening does not clean it. This is not an OS sandbox.
 *
 * read() returns independent frozen codec data (or MISSING).
 * initialize(candidate) exclusively installs revision 0; commit(candidate,
 * { expectedRevision, confirmedLabels: [] }) replaces only the next revision.
 * Both snapshot candidate/options synchronously before joining the queue.
 * confirmedLabels is a trusted host assertion for that exact candidate/revision,
 * not authentication or model consent. Archive/root extensions are host-owned.
 * close() drains accepted operations and releases only this owner's lock.
 *
 * Commits use temp write -> file sync -> rename -> directory sync. Initialization
 * uses an atomic no-clobber hard link instead of rename, then removes the owned
 * temp name. A replacement attempt with uncertain outcome poisons writes; read
 * remains available, but read alone never clears poison. No blind retries.
 * Durability is limited to the local filesystem's sync/rename guarantees.
 * The optional second argument is a trusted filesystem test seam, never input
 * from a client/model. Production callers should omit it.
 */
export async function openCanonicalMemoryStore({ directory, agentId } = {}, { io = fs } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)
      || path.normalize(directory) !== directory || directory === path.parse(directory).root
      || typeof agentId !== 'string' || !agentId.trim()
      || typeof process.getuid !== 'function' || !constants.O_NOFOLLOW) fail('INVALID');

  const uid = process.getuid();
  const dataPath = path.join(directory, CANONICAL_MEMORY_FILE);
  const lockPath = path.join(directory, CANONICAL_MEMORY_LOCK);
  const token = randomUUID();
  let directoryHandle;
  let directoryStat;
  let lockHandle;
  let lockStat;
  let accepting = true;
  let poisoned = false;
  let ownershipLost = false;
  let tail = Promise.resolve();
  let closing;

  function privateFile(stat, allowedLinks = 1) {
    if (!stat.isFile() || stat.uid !== uid || (stat.mode & 0o7077) !== 0
        || (stat.mode & 0o600) !== 0o600 || stat.nlink !== allowedLinks) fail('UNSAFE_PATH');
  }

  async function validateFile(stat, filePath) {
    if (!stat.isFile()) fail('UNSAFE_PATH');
    if (filePath === dataPath && stat.nlink === 2) {
      let alias;
      try { alias = await io.lstat(path.join(directory, INITIAL_TEMP)); }
      catch (error) {
        if (error.code === 'ENOENT') fail('UNSAFE_PATH');
        throw error;
      }
      privateFile(alias, 2);
      if (!sameFile(alias, stat)) fail('UNSAFE_PATH');
      privateFile(stat, 2);
    } else privateFile(stat);
  }

  async function checkDirectory() {
    const stat = await io.lstat(directory);
    if (!stat.isDirectory() || stat.uid !== uid || (stat.mode & 0o7777) !== 0o700
        || await io.realpath(directory) !== directory
        || (directoryStat && !sameFile(stat, directoryStat))) fail('UNSAFE_PATH');
    return stat;
  }

  async function readFile(filePath, missingAllowed = false) {
    let handle;
    try {
      let before;
      try { before = await io.lstat(filePath); } catch (error) {
        if (error.code === 'ENOENT' && missingAllowed) return null;
        throw error;
      }
      await validateFile(before, filePath);
      handle = await io.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const opened = await handle.stat();
      await validateFile(opened, filePath);
      if (!sameFile(before, opened)) fail('UNSAFE_PATH');
      const bytes = await handle.readFile();
      // Fatal decoding avoids silently changing malformed UTF-8 to U+FFFD.
      const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const after = await io.lstat(filePath);
      await validateFile(after, filePath);
      if (!sameFile(opened, after)) fail('UNSAFE_PATH');
      return { stat: opened, text };
    } finally {
      if (handle) await handle.close();
    }
  }

  async function checkOwner() {
    if (ownershipLost) fail('LOCK_LOST');
    try {
      await checkDirectory();
      const lock = await readFile(lockPath);
      if (!sameFile(lock.stat, lockStat) || lock.text !== token) fail('LOCK_LOST');
    } catch {
      ownershipLost = true;
      fail('LOCK_LOST');
    }
  }

  async function currentRecord() {
    const record = await readFile(dataPath, true);
    if (!record) return null;
    try { return { ...record, memory: decodeAppServerMemory(record.text, agentId) }; }
    catch { fail('CORRUPT'); }
  }

  // Never unlink an unowned replacement, even on an error/close path.
  async function unlinkOwned(filePath, stat, expectedText) {
    await checkDirectory();
    const found = expectedText === undefined
      ? { stat: await io.lstat(filePath) } : await readFile(filePath);
    if (!sameFile(found.stat, stat) || !found.stat.isFile() || found.stat.uid !== uid
        || (expectedText !== undefined && found.text !== expectedText)) fail('LOCK_LOST');
    await io.unlink(filePath);
  }

  async function release() {
    let error;
    if (lockHandle) {
      try { await unlinkOwned(lockPath, lockStat, token); }
      catch { error = new CanonicalMemoryStoreError('LOCK_LOST'); }
      try { await lockHandle.close(); } catch (failure) { error ??= sanitized(failure); }
      lockHandle = undefined;
    }
    if (directoryHandle) {
      try { await directoryHandle.close(); } catch (failure) { error ??= sanitized(failure); }
      directoryHandle = undefined;
    }
    if (error) throw error;
  }

  function enqueue(operation) {
    if (!accepting) return Promise.reject(new CanonicalMemoryStoreError('CLOSED'));
    const result = tail.then(operation).catch((error) => { throw sanitized(error); });
    tail = result.catch(() => {});
    return result;
  }

  function snapshot(candidate) {
    try {
      const text = encodeAppServerMemory(candidate);
      return { text, memory: decodeAppServerMemory(text, agentId) };
    } catch { fail('INVALID'); }
  }

  function protect(previous, next, confirmations) {
    for (const [index, before] of previous.blocks.entries()) {
      const after = next.blocks[index];
      const { value: beforeValue, metadata: beforeMetadata, ...beforeIdentity } = before;
      const { value: afterValue, metadata: afterMetadata, ...afterIdentity } = after;
      if (!isDeepStrictEqual(beforeIdentity, afterIdentity)
          || (POLICY_MEMORY_LABELS.includes(before.label) && !isDeepStrictEqual(before, after))) {
        fail('PROTECTED');
      }
      if ((before.label === 'PROFILE' || before.label === 'GOALS_AND_DECISIONS')
          && !isDeepStrictEqual(before, after) && !confirmations.includes(before.label)) {
        fail('CONFIRMATION_REQUIRED');
      }
    }
  }

  async function install(candidate, previous) {
    const tempPath = path.join(directory, previous ? `.canonical-memory-${randomUUID()}.tmp` : INITIAL_TEMP);
    let tempHandle;
    let tempStat;
    let attempted = false;
    let error;
    try {
      tempHandle = await io.open(tempPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      tempStat = await tempHandle.stat();
      privateFile(tempStat);
      await tempHandle.writeFile(candidate.text, 'utf8');
      await tempHandle.sync();
      await tempHandle.close();
      tempHandle = undefined;
      await checkOwner();
      const latest = await currentRecord();
      if (previous ? !latest || !sameFile(previous.stat, latest.stat) || previous.text !== latest.text : latest) {
        fail(previous ? 'CONFLICT' : 'EXISTS');
      }
      const temp = await readFile(tempPath);
      if (!sameFile(temp.stat, tempStat) || temp.text !== candidate.text) fail('UNSAFE_PATH');
      attempted = true;
      if (previous) await io.rename(tempPath, dataPath);
      else {
        // Unlike rename, link cannot overwrite a newly appeared destination.
        try { await io.link(tempPath, dataPath); }
        catch (failure) {
          if (failure.code === 'EEXIST') { attempted = false; fail('EXISTS'); }
          throw failure;
        }
        await unlinkOwned(tempPath, tempStat);
      }
      tempStat = undefined;
      await directoryHandle.sync();
      await checkOwner();
    } catch (failure) {
      if (attempted) { poisoned = true; error = new CanonicalMemoryStoreError('UNKNOWN_OUTCOME'); }
      else error = sanitized(failure);
    } finally {
      if (tempHandle) {
        try { await tempHandle.close(); } catch { error ??= new CanonicalMemoryStoreError('IO'); }
      }
      if (tempStat) {
        // After a possibly successful rename, ENOENT is expected. Never remove
        // any canonical record, and never scan/clean stale temporary files.
        try { await unlinkOwned(tempPath, tempStat); }
        catch (failure) {
          if (failure.code !== 'ENOENT') error ??= sanitized(failure);
        }
      }
    }
    if (error) throw error;
    return candidate.memory;
  }

  try {
    directoryStat = await checkDirectory();
    directoryHandle = await io.open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    if (!sameFile(directoryStat, await directoryHandle.stat())) fail('UNSAFE_PATH');
    try {
      lockHandle = await io.open(lockPath,
        constants.O_RDWR | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    } catch (error) {
      if (error.code === 'EEXIST') fail('LOCKED');
      throw error;
    }
    lockStat = await lockHandle.stat();
    privateFile(lockStat);
    await lockHandle.writeFile(token, 'utf8');
    await lockHandle.sync();
    await checkOwner();
    await currentRecord();
  } catch (error) {
    try { await release(); } catch { /* Retain any lock whose ownership is uncertain. */ }
    throw sanitized(error);
  }

  return Object.freeze({
    read() {
      return enqueue(async () => {
        await checkOwner();
        const record = await currentRecord();
        if (!record) fail('MISSING');
        return record.memory;
      });
    },
    initialize(candidate) {
      let captured;
      try {
        captured = snapshot(candidate);
        if (captured.memory.revision !== 0) fail('INVALID');
      } catch (error) { return Promise.reject(sanitized(error)); }
      return enqueue(async () => {
        if (poisoned) fail('POISONED');
        await checkOwner();
        if (await currentRecord()) fail('EXISTS');
        return install(captured, null);
      });
    },
    commit(candidate, { expectedRevision, confirmedLabels = [] } = {}) {
      let captured;
      let confirmations;
      try {
        captured = snapshot(candidate);
        if (!safeRevision(expectedRevision) || expectedRevision === Number.MAX_SAFE_INTEGER
            || captured.memory.revision !== expectedRevision + 1
            || !Array.isArray(confirmedLabels)
            || confirmedLabels.some((label) => label !== 'PROFILE' && label !== 'GOALS_AND_DECISIONS')) fail('INVALID');
        confirmations = [...confirmedLabels];
      } catch (error) { return Promise.reject(sanitized(error)); }
      return enqueue(async () => {
        if (poisoned) fail('POISONED');
        await checkOwner();
        const previous = await currentRecord();
        if (!previous) fail('MISSING');
        if (previous.memory.revision !== expectedRevision) fail('CONFLICT');
        protect(previous.memory, captured.memory, confirmations);
        return install(captured, previous);
      });
    },
    close() {
      if (!closing) {
        accepting = false;
        closing = tail.then(release).catch((error) => { throw sanitized(error); });
      }
      return closing;
    },
  });
}
