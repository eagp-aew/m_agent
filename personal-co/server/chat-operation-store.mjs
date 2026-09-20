import * as fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { types } from 'node:util';
import { captureChatContext } from './local-chat-context.mjs';

export const CHAT_OPERATIONS_FILE = 'operations.sqlite';
const MAX_DATABASE_BYTES = 256 * 1024 * 1024;
const MAX_RECORDS = 10000;
const MAX_RECORD_BYTES = 114688;
const APPLICATION_ID = 1346588465;
const SCHEMA = [
  "CREATE TABLE binding (agent_id TEXT NOT NULL) STRICT",
  "CREATE TABLE operations (operation_id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL CHECK(status IN ('unknown','completed','failed')), data TEXT NOT NULL CHECK(length(CAST(data AS BLOB)) <= 114688)) STRICT",
  "CREATE UNIQUE INDEX one_unknown ON operations(status) WHERE status = 'unknown'",
];
const messages = {
  INVALID: 'Invalid chat operation request.', UNSAFE_PATH: 'Unsafe chat operation storage.',
  CORRUPT: 'Invalid chat operation store.', BINDING: 'Chat operation Agent binding mismatch.',
  CONFLICT: 'Chat operation evidence conflicts.', BUSY: 'An unresolved chat operation exists.',
  LIMIT: 'Chat operation storage limit reached.', MISSING: 'Chat operation not found.',
  CLOSED: 'Chat operation store is closed.', POISONED: 'Chat operation store requires reopening.',
  IO: 'Chat operation storage failed.', UNKNOWN_OUTCOME: 'Chat operation write outcome is unknown; do not dispatch.',
};
export class ChatOperationStoreError extends Error {
  constructor(code) { super(messages[code]); this.name = 'ChatOperationStoreError'; this.code = code; }
}
const fail = code => { throw new ChatOperationStoreError(code); };
const check = (condition, code = 'INVALID') => { if (!condition) fail(code); };
const safeError = error => error instanceof ChatOperationStoreError ? error : new ChatOperationStoreError('IO');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;
const entityId = value => typeof value === 'string' && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value;
// Native user/assistant projections may suffix the base ID. Tool request IDs
// are deliberately excluded: they cannot be completion evidence for this flow.
const messageId = value => typeof value === 'string' && value !== 'default'
  && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}(?::(?:assistant|reasoning):(?:0|[1-9][0-9]{0,5}))?$/.exec(value)?.[0] === value;
const uuid = value => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.exec(value)?.[0] === value;

// Reject proxies, accessors, symbols, prototypes and extra/non-enumerable fields
// before reading values. No caller toJSON/getter is executed or persisted.
function fields(value, keys) {
  check(value && typeof value === 'object' && !types.isProxy(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const own = Reflect.ownKeys(value);
  check(own.length === keys.length && keys.every(key => own.includes(key)));
  for (const key of own) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
  }
}
function boundedText(value, limit) {
  check(typeof value === 'string' && value.trim().length > 0 && value.isWellFormed()
    && !value.includes('\0') && Buffer.byteLength(value) <= limit);
  return value;
}
function request(value) {
  // Inspect kind only after checking every descriptor.
  check(value && typeof value === 'object' && !types.isProxy(value));
  const kind = Object.getOwnPropertyDescriptor(value, 'kind');
  check(kind && Object.hasOwn(kind, 'value') && ['create', 'send'].includes(kind.value));
  fields(value, kind.value === 'create' ? ['operationId', 'kind', 'title']
    : ['operationId', 'kind', 'conversationId', 'text', ...(Object.hasOwn(value, 'context') ? ['context'] : [])]);
  check(uuid(value.operationId));
  if (value.kind === 'create') return { operationId: value.operationId, kind: 'create', title: boundedText(value.title, 256) };
  check(entityId(value.conversationId));
  let context;
  if (Object.hasOwn(value, 'context')) {
    try { context = captureChatContext(value.context); } catch { fail('INVALID'); }
  }
  return { operationId: value.operationId, kind: 'send', conversationId: value.conversationId, text: boundedText(value.text, 16384),
    ...(context === undefined ? {} : { context }) };
}
function terminal(value) {
  fields(value, ['runId', 'turnId', 'stopReason', 'error']);
  check(entityId(value.runId) && entityId(value.turnId) && entityId(value.stopReason) && typeof value.error === 'boolean');
  return { runId: value.runId, turnId: value.turnId, stopReason: value.stopReason, error: value.error };
}
function sendCompletion(value) {
  fields(value, ['conversationId', 'userMessageId', 'assistantMessageIds']);
  check(entityId(value.conversationId) && messageId(value.userMessageId));
  const ids = value.assistantMessageIds;
  check(Array.isArray(ids) && !types.isProxy(ids) && Object.getPrototypeOf(ids) === Array.prototype);
  const length = Object.getOwnPropertyDescriptor(ids, 'length').value;
  check(length >= 1 && length <= 64 && Reflect.ownKeys(ids).length === length + 1);
  const captured = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(ids, String(i));
    check(descriptor && descriptor.enumerable && Object.hasOwn(descriptor, 'value') && messageId(descriptor.value));
    captured.push(descriptor.value);
  }
  check(new Set(captured).size === captured.length && !captured.includes(value.userMessageId));
  return { conversationId: value.conversationId, userMessageId: value.userMessageId, assistantMessageIds: captured };
}
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function frozen(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function validRecord(value) {
  fields(value, ['request', 'status', 'terminal', 'completion', 'failure']);
  const captured = request(value.request);
  check(equal(captured, value.request) && ['unknown', 'completed', 'failed'].includes(value.status));
  if (value.terminal !== null) { check(captured.kind === 'send'); check(equal(terminal(value.terminal), value.terminal)); }
  if (value.completion !== null) {
    if (captured.kind === 'create') {
      fields(value.completion, ['conversationId', 'operationTag']);
      check(entityId(value.completion.conversationId) && value.completion.operationTag === `personal-co-operation-v1-${captured.operationId}`);
    } else {
      check(equal(sendCompletion(value.completion), value.completion)
        && value.completion.conversationId === captured.conversationId
        && value.terminal?.stopReason === 'end_turn' && value.terminal.error === false);
    }
  }
  if (value.failure !== null) {
    check(['predispatch_rejected', 'terminal_failed'].includes(value.failure));
    if (value.failure === 'predispatch_rejected') check(value.terminal === null);
    else check(value.terminal !== null && (value.terminal.error || value.terminal.stopReason !== 'end_turn'));
  }
  check(value.status === 'completed' ? value.completion !== null && value.failure === null
    : value.status === 'failed' ? value.failure !== null && value.completion === null
      : value.completion === null && value.failure === null);
  return value;
}
function publicRecord(value, agentId) {
  return frozen({ agentId, ...value, ...(value.request.kind === 'create'
    ? { operationTag: `personal-co-operation-v1-${value.request.operationId}` }
    : { clientMessageId: value.request.operationId }) });
}

/**
 * Trusted host ONLY. Call AFTER bootstrap has validated the exact Agent and
 * stateRoot/protectedRoot binding; never open against a browser-selected root.
 * Existing canonical absolute owned 0700 directory, fixed owned 0600 SQLite
 * file. No migration, pruning, deletion, stale recovery or canonical writes.
 * Same-uid directory writers are trusted: path checks are not a sandbox against
 * an actively malicious same-uid process. Host serializes same-Agent mutations.
 *
 * All methods are synchronous. reserve(request) returns {record,dispatchAllowed}:
 * only a successfully committed first reservation grants permission ONCE. Its
 * persisted status is already unknown. Duplicate requests (even after reopen)
 * never grant permission; changed fields conflict. Exceptions NEVER authorize
 * dispatch. listPending() returns the at-most-one unresolved record. get(UUID)
 * retains original text/title; caller must check conversationId before displaying
 * text for a native client_message_id (the operation UUID).
 *
 * recordTerminal({operationId,runId,turnId,stopReason,error:boolean}) stores only
 * host-correlated terminal evidence, not raw native errors. completeSend requires
 * this successful terminal AND host-validated persisted message IDs belonging to
 * the exact conversation/input/run. completeCreate requires host-verified Agent,
 * conversation and exact operationTag. These assertions are NOT authentication
 * or proof against untrusted callers; never expose these methods as arbitrary RPC.
 * recordFailure({operationId,source:'predispatch'|'terminal'}) is a trusted host
 * assertion of NO dispatch, or a recorded unsuccessful terminal, respectively.
 * Terminal alone never implies persisted completion. Failed IDs cannot replay.
 *
 * Ordinary retained private conversation data, NOT temporary/privacy mode.
 * SQLite rollback journal, synchronous FULL and directory fsync bound local
 * process/power durability to OS/filesystem/hardware guarantees, not backend
 * exactly-once execution. Unexpected SQL/I/O errors poison this handle. A lost
 * commit acknowledgement leaves a committed reservation unknown on reopen; if
 * SQLite rolled it back, no dispatch permission was ever returned. Do not infer
 * safe resend from an exception. Second argument is a TRUSTED filesystem fault
 * test seam only; production callers omit it.
 */
export function openChatOperationStore(input, { io = fs } = {}) {
  let db; let directoryFd; let databaseStat; let directoryStat;
  let closed = false; let poisoned = false;
  let directory; let agentId; let databasePath;
  const uid = typeof process.getuid === 'function' ? process.getuid() : -1;
  function privateFile(stat) {
    check(stat.isFile() && stat.uid === uid && (stat.mode & 0o7777) === 0o600
      && stat.nlink === 1 && stat.size <= MAX_DATABASE_BYTES, 'UNSAFE_PATH');
  }
  function paths() {
    const stat = io.lstatSync(directory);
    check(stat.isDirectory() && stat.uid === uid && (stat.mode & 0o7777) === 0o700
      && io.realpathSync(directory) === directory && (!directoryStat || sameFile(stat, directoryStat)), 'UNSAFE_PATH');
    directoryStat ??= stat;
    const current = io.lstatSync(databasePath); privateFile(current);
    check(!databaseStat || sameFile(current, databaseStat), 'UNSAFE_PATH'); databaseStat ??= current;
    for (const suffix of ['-journal', '-wal', '-shm']) {
      try {
        const sidecar = io.lstatSync(`${databasePath}${suffix}`); privateFile(sidecar);
        check(suffix === '-journal', 'CORRUPT');
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
  function load(row) {
    if (!row) return null;
    try {
      check(typeof row.data === 'string' && Buffer.byteLength(row.data) <= MAX_RECORD_BYTES);
      const value = validRecord(JSON.parse(row.data));
      check(value.request.operationId === row.operation_id && value.status === row.status);
      return value;
    } catch { fail('CORRUPT'); }
  }
  function schema() {
    check(db.prepare('PRAGMA application_id').get().application_id === APPLICATION_ID
      && db.prepare('PRAGMA user_version').get().user_version === 1, 'CORRUPT');
    const objects = db.prepare(`SELECT sql FROM sqlite_schema
      WHERE NOT (type = 'index' AND name = 'sqlite_autoindex_operations_1' AND tbl_name = 'operations' AND sql IS NULL)
      ORDER BY name`).all().map(row => row.sql);
    check(equal(objects, [SCHEMA[0], SCHEMA[2], SCHEMA[1]]), 'CORRUPT');
    const bindings = db.prepare('SELECT agent_id FROM binding LIMIT 2').all();
    check(bindings.length === 1 && bindings[0].agent_id === agentId, 'BINDING');
    check(db.prepare('PRAGMA quick_check(1)').get().quick_check === 'ok', 'CORRUPT');
    const rows = db.prepare('SELECT * FROM operations LIMIT 10001').all();
    check(rows.length <= MAX_RECORDS, 'LIMIT');
    rows.forEach(load);
  }
  function active() { check(!closed, 'CLOSED'); check(!poisoned, 'POISONED'); }
  function call(fn) {
    try { active(); paths(); return fn(); }
    catch (error) { if (!(error instanceof ChatOperationStoreError) || ['CORRUPT', 'UNSAFE_PATH'].includes(error.code)) poisoned = true; throw safeError(error); }
  }
  const lookup = id => load(db.prepare('SELECT * FROM operations WHERE operation_id = ?').get(id));
  function transaction(fn) {
    let began = false; let committing = false;
    try {
      db.exec('BEGIN IMMEDIATE'); began = true;
      const result = fn();
      committing = true; db.exec('COMMIT'); began = false;
      io.fsyncSync(directoryFd); paths();
      return result;
    } catch (error) {
      if (began) { try { db.exec('ROLLBACK'); } catch { poisoned = true; } }
      if (committing || !(error instanceof ChatOperationStoreError)) { poisoned = true; fail('UNKNOWN_OUTCOME'); }
      throw error;
    }
  }
  function mutate(operationId, update) {
    check(uuid(operationId));
    return call(() => transaction(() => {
      const record = lookup(operationId); check(record, 'MISSING');
      update(record); validRecord(record);
      const data = JSON.stringify(record); check(Buffer.byteLength(data) <= MAX_RECORD_BYTES, 'LIMIT');
      db.prepare('UPDATE operations SET status = ?, data = ? WHERE operation_id = ?').run(record.status, data, operationId);
      return publicRecord(record, agentId);
    }));
  }
  try {
    fields(input, ['directory', 'agentId']); ({ directory, agentId } = input);
    check(uid >= 0 && fs.constants.O_NOFOLLOW && entityId(agentId));
    check(typeof directory === 'string' && path.isAbsolute(directory) && path.normalize(directory) === directory
      && directory !== path.parse(directory).root && !directory.includes('\0'), 'UNSAFE_PATH');
    databasePath = path.join(directory, CHAT_OPERATIONS_FILE);
    directoryStat = io.lstatSync(directory);
    check(directoryStat.isDirectory() && directoryStat.uid === uid && (directoryStat.mode & 0o7777) === 0o700
      && io.realpathSync(directory) === directory, 'UNSAFE_PATH');
    directoryFd = io.openSync(directory, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
    check(sameFile(io.fstatSync(directoryFd), directoryStat), 'UNSAFE_PATH');
    let fresh = false;
    try {
      const fd = io.openSync(databasePath, fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW, 0o600);
      try { privateFile(io.fstatSync(fd)); io.fsyncSync(fd); } finally { io.closeSync(fd); }
      io.fsyncSync(directoryFd); fresh = true;
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
    paths();
    // Validate foreign/schema/binding data read-only before changing pragmas.
    if (!fresh) {
      db = new DatabaseSync(databasePath, { readOnly: true, allowExtension: false, enableDoubleQuotedStringLiterals: false });
      db.exec('PRAGMA trusted_schema = OFF; PRAGMA busy_timeout = 1000'); schema(); db.close(); db = undefined;
      paths();
    }
    db = new DatabaseSync(databasePath, { allowExtension: false, enableDoubleQuotedStringLiterals: false });
    db.exec('PRAGMA trusted_schema = OFF; PRAGMA busy_timeout = 1000');
    if (!fresh) schema();
    check(db.prepare('PRAGMA journal_mode').get().journal_mode === 'delete', 'CORRUPT');
    const pageSize = db.prepare('PRAGMA page_size').get().page_size;
    db.exec(`PRAGMA synchronous = FULL; PRAGMA max_page_count = ${Math.floor(MAX_DATABASE_BYTES / pageSize)}`);
    if (fresh) transaction(() => {
      SCHEMA.forEach(sql => db.exec(sql));
      db.prepare('INSERT INTO binding(agent_id) VALUES (?)').run(agentId);
      db.exec(`PRAGMA application_id = ${APPLICATION_ID}; PRAGMA user_version = 1`);
    });
    schema(); paths();
  } catch (error) {
    try { db?.close(); } catch { /* Never expose SQLite/private errors. */ }
    try { if (directoryFd !== undefined) io.closeSync(directoryFd); } catch { /* Retain files. */ }
    throw safeError(error);
  }
  function api(fn) { return (...args) => { try { return fn(...args); } catch (error) { throw safeError(error); } }; }
  return Object.freeze({
    reserve: api(value => {
      const captured = request(value);
      return call(() => transaction(() => {
        const existing = lookup(captured.operationId);
        if (existing) { check(equal(existing.request, captured), 'CONFLICT'); return frozen({ record: publicRecord(existing, agentId), dispatchAllowed: false }); }
        check(!db.prepare("SELECT 1 FROM operations WHERE status = 'unknown'").get(), 'BUSY');
        check(db.prepare('SELECT count(*) AS count FROM operations').get().count < MAX_RECORDS, 'LIMIT');
        const record = { request: captured, status: 'unknown', terminal: null, completion: null, failure: null };
        const data = JSON.stringify(record); check(Buffer.byteLength(data) <= MAX_RECORD_BYTES, 'LIMIT');
        db.prepare('INSERT INTO operations VALUES (?, ?, ?)').run(captured.operationId, 'unknown', data);
        return frozen({ record: publicRecord(record, agentId), dispatchAllowed: true });
      }));
    }),
    get: api(operationId => { check(uuid(operationId)); return call(() => { const record = lookup(operationId); return record ? publicRecord(record, agentId) : null; }); }),
    listPending: api(() => call(() => frozen(db.prepare("SELECT * FROM operations WHERE status = 'unknown' LIMIT 1").all().map(row => publicRecord(load(row), agentId))))),
    recordTerminal: api(value => {
      fields(value, ['operationId', 'runId', 'turnId', 'stopReason', 'error']);
      const captured = terminal({ runId: value.runId, turnId: value.turnId, stopReason: value.stopReason, error: value.error });
      return mutate(value.operationId, record => {
        check(record.request.kind === 'send', 'CONFLICT');
        if (record.terminal) check(equal(record.terminal, captured), 'CONFLICT');
        else { check(record.status === 'unknown', 'CONFLICT'); record.terminal = captured; }
      });
    }),
    completeCreate: api(value => {
      fields(value, ['operationId', 'conversationId', 'operationTag']);
      check(uuid(value.operationId) && entityId(value.conversationId) && value.operationTag === `personal-co-operation-v1-${value.operationId}`);
      const evidence = { conversationId: value.conversationId, operationTag: value.operationTag };
      return mutate(value.operationId, record => {
        check(record.request.kind === 'create' && record.status !== 'failed', 'CONFLICT');
        if (record.completion) check(equal(record.completion, evidence), 'CONFLICT');
        record.completion = evidence; record.status = 'completed';
      });
    }),
    completeSend: api(value => {
      fields(value, ['operationId', 'conversationId', 'userMessageId', 'assistantMessageIds']);
      const evidence = sendCompletion({ conversationId: value.conversationId, userMessageId: value.userMessageId, assistantMessageIds: value.assistantMessageIds });
      return mutate(value.operationId, record => {
        check(record.request.kind === 'send' && record.status !== 'failed' && record.request.conversationId === evidence.conversationId
          && record.terminal?.stopReason === 'end_turn' && record.terminal.error === false, 'CONFLICT');
        if (record.completion) check(equal(record.completion, evidence), 'CONFLICT');
        record.completion = evidence; record.status = 'completed';
      });
    }),
    recordFailure: api(value => {
      fields(value, ['operationId', 'source']); check(['predispatch', 'terminal'].includes(value.source));
      const reason = value.source === 'predispatch' ? 'predispatch_rejected' : 'terminal_failed';
      return mutate(value.operationId, record => {
        check(record.status !== 'completed' && (!record.failure || record.failure === reason), 'CONFLICT');
        check(reason === 'predispatch_rejected' ? record.terminal === null
          : record.terminal && (record.terminal.error || record.terminal.stopReason !== 'end_turn'), 'CONFLICT');
        record.failure = reason; record.status = 'failed';
      });
    }),
    close: api(() => {
      if (closed) return;
      closed = true;
      try { db.close(); } finally { io.closeSync(directoryFd); }
    }),
  });
}
