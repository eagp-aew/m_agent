import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { openChatOperationStore, CHAT_OPERATIONS_FILE } from '../server/chat-operation-store.mjs';

const moduleURL = new URL('../server/chat-operation-store.mjs', import.meta.url).href;
const agentId = 'agent-test';
const fixture = () => fs.mkdtempSync('/private/tmp/personal-co-wp0051-');
const open = (directory, seam) => openChatOperationStore({ directory, agentId }, seam);
const create = () => ({ operationId: randomUUID(), kind: 'create', title: 'Retained chat' });
const send = () => ({ operationId: randomUUID(), kind: 'send', conversationId: 'conversation-1', text: 'Original private draft' });
const terminal = operationId => ({ operationId, runId: 'run-1', turnId: 'turn-1', stopReason: 'end_turn', error: false });
const completion = operationId => ({ operationId, conversationId: 'conversation-1', userMessageId: 'message-user', assistantMessageIds: ['message-assistant:reasoning:0', 'message-assistant:assistant:0'] });
const code = expected => error => error.code === expected && error.message.length < 150 && !error.message.includes('SECRET');
function seed(directory, sql) {
  const db = new DatabaseSync(path.join(directory, CHAT_OPERATIONS_FILE));
  try { sql(db); } finally { db.close(); }
}

test('create and send retain immutable exact evidence across reopening', () => {
  const directory = fixture(); let store = open(directory); const first = create();
  const receipt = store.reserve(first);
  assert.equal(receipt.dispatchAllowed, true); assert.equal(receipt.record.status, 'unknown');
  assert.equal(receipt.record.operationTag, `personal-co-operation-v1-${first.operationId}`);
  assert.ok(Object.isFrozen(receipt.record.request));
  assert.throws(() => { receipt.record.request.title = 'changed'; }, TypeError);
  assert.deepEqual(store.listPending(), [receipt.record]);
  const created = { operationId: first.operationId, conversationId: 'conversation-1', operationTag: receipt.record.operationTag };
  const settled = store.completeCreate(created); assert.equal(settled.status, 'completed');
  assert.deepEqual(store.completeCreate(created), settled);
  assert.throws(() => store.completeCreate({ ...created, conversationId: 'conversation-2' }), code('CONFLICT'));
  const second = send(); const pending = store.reserve(second);
  assert.equal(pending.record.clientMessageId, second.operationId);
  assert.throws(() => store.completeSend(completion(second.operationId)), code('CONFLICT'));
  const finished = store.recordTerminal(terminal(second.operationId));
  assert.equal(finished.status, 'unknown'); assert.equal(store.listPending().length, 1);
  assert.deepEqual(store.recordTerminal(terminal(second.operationId)), finished);
  assert.throws(() => store.completeSend({ ...completion(second.operationId), conversationId: 'other' }), code('CONFLICT'));
  const completed = store.completeSend(completion(second.operationId));
  assert.equal(completed.status, 'completed'); assert.deepEqual(store.completeSend(completion(second.operationId)), completed);
  assert.throws(() => store.completeSend({ ...completion(second.operationId), userMessageId: 'other' }), code('CONFLICT'));
  store.close(); store.close(); store = open(directory);
  assert.equal(store.reserve(first).dispatchAllowed, false); assert.equal(store.reserve(second).dispatchAllowed, false);
  assert.deepEqual(store.get(second.operationId), completed);
  assert.equal(store.get(second.operationId).request.text, second.text);
  assert.deepEqual(store.listPending(), []); assert.equal(store.get(randomUUID()), null);
  assert.equal(fs.statSync(path.join(directory, CHAT_OPERATIONS_FILE)).mode & 0o7777, 0o600);
  store.close(); assert.throws(() => store.get(second.operationId), code('CLOSED'));
});

test('same ID never reauthorizes across handles; changed fields conflict and global unknown blocks', () => {
  const directory = fixture(); const a = open(directory); const b = open(directory); const input = send();
  assert.equal(a.reserve(input).dispatchAllowed, true);
  assert.equal(b.reserve(input).dispatchAllowed, false);
  for (const changed of [{ text: 'changed' }, { conversationId: 'other' }, { kind: 'create', title: 'other' }]) {
    const next = changed.kind ? { operationId: input.operationId, ...changed } : { ...input, ...changed };
    assert.throws(() => b.reserve(next), code('CONFLICT'));
  }
  assert.throws(() => b.reserve(create()), code('BUSY'));
  a.close(); b.close(); const reopened = open(directory);
  assert.equal(reopened.reserve(input).dispatchAllowed, false);
  assert.throws(() => reopened.reserve(send()), code('BUSY')); reopened.close();
});

test('separate processes racing the same reservation receive exactly one dispatch grant', { timeout: 10000 }, async () => {
  const directory = fixture(); open(directory).close(); const input = send();
  const source = `import {openChatOperationStore} from ${JSON.stringify(moduleURL)};
    const store = openChatOperationStore(${JSON.stringify({ directory, agentId })});
    process.stdout.write('ready\\n');
    process.stdin.once('data', () => { try { process.stdout.write(JSON.stringify(store.reserve(${JSON.stringify(input)}).dispatchAllowed)+'\\n'); store.close(); process.exit(0); } catch(e) { process.stderr.write(e.code); process.exit(1); } });`;
  const children = [0, 1].map(() => spawn(process.execPath, ['--input-type=module', '-e', source], { stdio: ['pipe', 'pipe', 'pipe'] }));
  const output = children.map(() => ''); const errors = children.map(() => '');
  const exits = children.map((child, i) => new Promise(resolve => {
    child.on('exit', status => resolve(status)); child.on('error', () => resolve('spawn-error'));
    child.stderr.on('data', chunk => { errors[i] += chunk; });
  }));
  const ready = children.map((child, i) => new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', () => { if (!output[i].includes('ready\n')) reject(new Error('Worker exited before ready.')); });
    child.stdout.on('data', chunk => { output[i] += chunk; if (output[i].includes('ready\n')) resolve(); });
    child.stdin.on('error', reject);
  }));
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Worker deadline exceeded.')), 5000); });
  try {
    await Promise.race([Promise.all(ready), deadline]);
    children.forEach(child => child.stdin.end('go'));
    assert.deepEqual(await Promise.race([Promise.all(exits), deadline]), [0, 0], errors.join('\n'));
    assert.deepEqual(output.map(value => JSON.parse(value.trim().split('\n')[1])).sort(), [false, true]);
  } finally {
    clearTimeout(timer);
    for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await Promise.all(exits);
  }
  const store = open(directory); assert.equal(store.reserve(input).dispatchAllowed, false); store.close();
});

test('abrupt process exit after reserve leaves unknown and never grants again', () => {
  const directory = fixture(); const input = send();
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `import {openChatOperationStore} from ${JSON.stringify(moduleURL)};
    const store=openChatOperationStore(${JSON.stringify({ directory, agentId })});
    if (!store.reserve(${JSON.stringify(input)}).dispatchAllowed) process.exit(2); process.exit(0);`], { encoding: 'utf8', timeout: 10000 });
  assert.equal(child.status, 0, child.stderr);
  const store = open(directory); assert.equal(store.get(input.operationId).status, 'unknown');
  assert.equal(store.reserve(input).dispatchAllowed, false); store.close();
});

test('lost commit acknowledgement poisons the handle and retains unknown on reopen', () => {
  const directory = fixture(); let inject = false;
  const store = open(directory, { io: { ...fs, fsyncSync(fd) { if (inject) { inject = false; throw new Error('SECRET path SQL'); } fs.fsyncSync(fd); } } });
  const input = send(); inject = true;
  assert.throws(() => store.reserve(input), code('UNKNOWN_OUTCOME'));
  assert.throws(() => store.reserve(input), code('POISONED'));
  store.close(); const reopened = open(directory);
  assert.equal(reopened.reserve(input).dispatchAllowed, false);
  assert.equal(reopened.get(input.operationId).status, 'unknown'); reopened.close();
});

test('terminal conflict, unsuccessful terminal and narrow predispatch failure are distinct', () => {
  const store = open(fixture()); const first = send(); store.reserve(first);
  assert.throws(() => store.recordFailure({ operationId: first.operationId, source: 'terminal' }), code('CONFLICT'));
  const failed = { ...terminal(first.operationId), stopReason: 'error', error: true };
  store.recordTerminal(failed);
  assert.throws(() => store.recordTerminal({ ...failed, turnId: 'other' }), code('CONFLICT'));
  assert.throws(() => store.completeSend(completion(first.operationId)), code('CONFLICT'));
  assert.throws(() => store.recordFailure({ operationId: first.operationId, source: 'predispatch' }), code('CONFLICT'));
  assert.equal(store.recordFailure({ operationId: first.operationId, source: 'terminal' }).status, 'failed');
  assert.equal(store.recordFailure({ operationId: first.operationId, source: 'terminal' }).status, 'failed');
  assert.equal(store.reserve(first).dispatchAllowed, false);
  const second = create(); store.reserve(second);
  assert.equal(store.recordFailure({ operationId: second.operationId, source: 'predispatch' }).failure, 'predispatch_rejected');
  assert.equal(store.reserve(second).dispatchAllowed, false);
  assert.throws(() => store.completeCreate({ operationId: second.operationId, conversationId: 'conversation-1', operationTag: `personal-co-operation-v1-${second.operationId}` }), code('CONFLICT'));
  const third = send(); store.reserve(third); store.recordTerminal(terminal(third.operationId));
  assert.throws(() => store.recordFailure({ operationId: third.operationId, source: 'terminal' }), code('CONFLICT'));
  store.close();
});

test('hostile descriptors, proxies, extra fields, malformed IDs and bounded payloads fail without executing code', () => {
  const store = open(fixture()); let executed = 0;
  const getter = { ...send() }; Object.defineProperty(getter, 'text', { enumerable: true, get() { executed++; return 'SECRET'; } });
  const toJSON = { ...send(), toJSON() { executed++; return {}; } };
  const proxy = new Proxy(send(), { getOwnPropertyDescriptor() { executed++; throw new Error('SECRET'); } });
  const hidden = { ...send() }; Object.defineProperty(hidden, 'extra', { value: 'x' });
  for (const value of [getter, toJSON, proxy, hidden, { ...send(), text: '\ud800' }, { ...send(), text: 'x'.repeat(16385) },
    { ...create(), title: '界'.repeat(86) }, { ...send(), conversationId: '../outside' }, { ...send(), operationId: 'not-uuid' },
    { ...send(), operationId: `${randomUUID()}\n` }, { ...create(), title: '' }, { ...send(), text: '\0' },
    { ...send(), conversationId: 'default' }]) assert.throws(() => store.reserve(value), code('INVALID'));
  const valid = { ...send(), text: '\u0001'.repeat(16384) }; store.reserve(valid); store.recordTerminal(terminal(valid.operationId));
  const ids = ['assistant']; Object.defineProperty(ids, '0', { get() { executed++; return 'assistant'; } });
  assert.throws(() => store.completeSend({ ...completion(valid.operationId), assistantMessageIds: ids }), code('INVALID'));
  assert.throws(() => store.recordTerminal({ ...terminal(valid.operationId), error: 'SECRET' }), code('INVALID'));
  assert.throws(() => store.completeCreate({ operationId: { toString() { executed++; return 'SECRET'; } }, conversationId: 'c', operationTag: 'wrong' }), code('INVALID'));
  assert.equal(executed, 0); store.close();
  assert.throws(() => openChatOperationStore(new Proxy({}, { ownKeys() { executed++; return []; } })), code('INVALID'));
  assert.equal(executed, 0);
});

test('unsafe permissions, symlinks, hardlinks and noncanonical paths are rejected', () => {
  const loose = fixture(); fs.chmodSync(loose, 0o755); assert.throws(() => open(loose), code('UNSAFE_PATH'));
  const original = fixture(); open(original).close();
  const linkRoot = fixture(); const link = path.join(linkRoot, 'alias'); fs.symlinkSync(original, link);
  assert.throws(() => open(link), code('UNSAFE_PATH'));
  assert.throws(() => open(`${original}/../${path.basename(original)}`), code('UNSAFE_PATH'));
  for (const type of ['symlink', 'hardlink', 'mode', 'directory', 'oversize']) {
    const directory = fixture(); const target = path.join(directory, CHAT_OPERATIONS_FILE);
    if (type === 'symlink') fs.symlinkSync(path.join(original, CHAT_OPERATIONS_FILE), target);
    if (type === 'hardlink') fs.linkSync(path.join(original, CHAT_OPERATIONS_FILE), target);
    if (type === 'mode') fs.writeFileSync(target, '', { mode: 0o644 });
    if (type === 'directory') fs.mkdirSync(target, { mode: 0o700 });
    if (type === 'oversize') { const fd = fs.openSync(target, 'wx', 0o600); fs.ftruncateSync(fd, 256 * 1024 * 1024 + 1); fs.closeSync(fd); }
    assert.throws(() => open(directory), code('UNSAFE_PATH'), type);
  }
});

test('SQLite sidecars are checked before opening including symlinks and foreign WAL', () => {
  for (const suffix of ['-journal', '-wal', '-shm']) {
    const directory = fixture(); open(directory).close(); const untouched = path.join(directory, 'untouched');
    fs.writeFileSync(untouched, 'do not touch', { mode: 0o600 });
    fs.symlinkSync(untouched, path.join(directory, CHAT_OPERATIONS_FILE) + suffix);
    assert.throws(() => open(directory), code('UNSAFE_PATH'));
    assert.equal(fs.readFileSync(untouched, 'utf8'), 'do not touch');
  }
  const directory = fixture(); open(directory).close(); fs.writeFileSync(path.join(directory, `${CHAT_OPERATIONS_FILE}-wal`), '', { mode: 0o600 });
  assert.throws(() => open(directory), code('CORRUPT'));
});

test('foreign Agent, database/schema/version/data corruption fail closed without adoption', () => {
  const directory = fixture(); open(directory).close(); const before = fs.readFileSync(path.join(directory, CHAT_OPERATIONS_FILE));
  assert.throws(() => openChatOperationStore({ directory, agentId: 'other-agent' }), code('BINDING'));
  assert.deepEqual(fs.readFileSync(path.join(directory, CHAT_OPERATIONS_FILE)), before);
  for (const sql of ["PRAGMA user_version = 99", "CREATE TABLE unrelated (x TEXT)", "CREATE TRIGGER hostile AFTER INSERT ON operations BEGIN DELETE FROM binding; END",
    "UPDATE binding SET agent_id = 'other'", "INSERT INTO operations VALUES ('bad', 'unknown', '{}')"]) {
    const root = fixture(); open(root).close(); seed(root, db => db.exec(sql));
    assert.throws(() => open(root), error => ['CORRUPT', 'BINDING'].includes(error.code));
  }
  const empty = fixture(); fs.writeFileSync(path.join(empty, CHAT_OPERATIONS_FILE), '', { mode: 0o600 });
  assert.throws(() => open(empty), code('CORRUPT'));
  const malformed = fixture(); fs.writeFileSync(path.join(malformed, CHAT_OPERATIONS_FILE), 'SECRET not a database', { mode: 0o600 });
  assert.throws(() => open(malformed), code('IO'));
});

for (const [kind, sql] of [
  ['trigger', 'CREATE TRIGGER sqliteXerase AFTER INSERT ON operations BEGIN DELETE FROM operations; END'],
  ['table', 'CREATE TABLE sqliteXextra (x TEXT)'],
  ['view', 'CREATE VIEW sqliteXview AS SELECT operation_id FROM operations'],
  ['index', 'CREATE INDEX sqliteXindex ON operations(status)'],
  ['unexpected internal tables', 'ANALYZE'],
]) test(`unexpected schema ${kind} cannot hide behind the SQLite prefix`, () => {
  const directory = fixture(); open(directory).close(); seed(directory, db => db.exec(sql));
  const databasePath = path.join(directory, CHAT_OPERATIONS_FILE);
  const before = fs.readFileSync(databasePath); const entries = fs.readdirSync(directory).sort();
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.throws(() => { const store = open(directory); store.close(); }, code('CORRUPT'));
    assert.deepEqual(fs.readFileSync(databasePath), before);
    assert.deepEqual(fs.readdirSync(directory).sort(), entries);
  }
});

test('the exact SQLite primary-key autoindex permits reopening without duplicate dispatch', () => {
  const directory = fixture(); const store = open(directory); const input = send();
  assert.equal(store.reserve(input).dispatchAllowed, true); store.close();
  seed(directory, db => {
    const indexes = db.prepare('SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE sql IS NULL').all();
    assert.deepEqual(indexes.map(row => ({ ...row })), [{
      type: 'index', name: 'sqlite_autoindex_operations_1', tbl_name: 'operations', sql: null,
    }]);
  });
  const reopened = open(directory);
  try {
    assert.equal(reopened.reserve(input).dispatchAllowed, false);
    assert.equal(reopened.get(input.operationId).status, 'unknown');
  } finally { reopened.close(); }
});

test('record cap fails closed without pruning and existing receipts remain readable', () => {
  const directory = fixture(); open(directory).close(); let first;
  seed(directory, db => {
    const insert = db.prepare('INSERT INTO operations VALUES (?, ?, ?)'); db.exec('BEGIN');
    for (let i = 0; i < 10000; i++) {
      const input = create(); first ??= input;
      insert.run(input.operationId, 'failed', JSON.stringify({ request: input, status: 'failed', terminal: null, completion: null, failure: 'predispatch_rejected' }));
    }
    db.exec('COMMIT');
  });
  const store = open(directory); assert.throws(() => store.reserve(create()), code('LIMIT'));
  assert.equal(store.reserve(first).dispatchAllowed, false); assert.equal(store.get(first.operationId).status, 'failed'); store.close();
});

test('changed protected file identity and filesystem exceptions sanitize and poison', () => {
  const directory = fixture(); let inject = false;
  const store = open(directory, { io: { ...fs, lstatSync(file) { if (inject) throw new Error('SECRET private/path SQL'); return fs.lstatSync(file); } } });
  inject = true; assert.throws(() => store.reserve(send()), code('IO'));
  assert.throws(() => store.reserve(send()), code('POISONED')); store.close();
  const root = fixture(); const active = open(root); fs.chmodSync(path.join(root, CHAT_OPERATIONS_FILE), 0o644);
  assert.throws(() => active.reserve(send()), code('UNSAFE_PATH'));
  assert.throws(() => active.reserve(send()), code('POISONED')); active.close();
});
