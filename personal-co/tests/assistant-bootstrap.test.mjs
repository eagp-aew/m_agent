import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { prepareAssistantBootstrap, BOOTSTRAP_INTENT, BOOTSTRAP_LOCK } from '../server/assistant-bootstrap.mjs';
import { openCanonicalMemoryStore, CANONICAL_MEMORY_FILE, CANONICAL_MEMORY_LOCK } from '../server/canonical-memory-store.mjs';
import { decodeAppServerMemory } from '../src/domain/app-server-memory-codec.mjs';
import { createMemoryBlocks } from '../src/domain/memory.mjs';
import { PERSONA_TEXT, MEMORY_POLICY_TEXT } from '../src/domain/policy.mjs';
import { initializeManagedReadSession } from '../server/managed-read-session.mjs';
import { RUNTIME_PIN } from '../server/runtime-sandbox.mjs';
import { openChatOperationStore } from '../server/chat-operation-store.mjs';

const TAG = 'personal-co-v1';
const agentId = 'agent-local-synthetic';
const sha = data => createHash('sha256').update(data).digest('hex');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const failure = code => error => {
  assert.equal(error.message, 'Assistant initialization failed.'); assert.equal(error.cause, undefined);
  if (code) assert.equal(error.code, code); return true;
};
async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0048-unit-'));
  const roots = { stateRoot: path.join(root, 'state'), protectedRoot: path.join(root, 'protected') };
  await fs.mkdir(roots.stateRoot, { mode: 0o700 }); await fs.mkdir(roots.protectedRoot, { mode: 0o700 });
  t.diagnostic(`Retained synthetic fixture: ${root}`);
  return { root, roots, intent: path.join(roots.protectedRoot, BOOTSTRAP_INTENT),
    data: path.join(roots.protectedRoot, CANONICAL_MEMORY_FILE), lock: path.join(roots.protectedRoot, BOOTSTRAP_LOCK) };
}
function nativeFixture(behavior = {}) {
  let agents = []; let creates = 0; const calls = [];
  return {
    get creates() { return creates; }, get agents() { return agents; }, set agents(value) { agents = value; }, calls,
    async createAssistantAgent(marker, options) {
      creates++; calls.push('agent_create'); await behavior.beforeCreate?.(marker, options);
      agents = [{ id: agentId, tags: [TAG, marker, 'native-memfs'] }];
      if (behavior.lost) throw new Error('PRIVATE_LOST_CREATE_REPLY');
      await behavior.afterCreate?.();
      return { success: true, agent: structuredClone(agents[0]) };
    },
    async request(type, input, options) {
      calls.push(type); const result = await behavior.request?.(type, input, options);
      if (result !== undefined) return result;
      if (type === 'agent_list') { assert.deepEqual(input.query, { tags: [TAG], limit: 2 }); return { success: true, agents: structuredClone(agents) }; }
      if (type === 'agent_retrieve') return { success: true, agent: structuredClone(agents.find(agent => agent.id === input.agent_id)) };
      throw new Error('unexpected command');
    },
  };
}
async function initialize(f, client, options, seams) {
  const preparation = await prepareAssistantBootstrap(f.roots, options, seams);
  try { return await preparation.resolve(client); } finally { await preparation.close(); }
}
function faultIO(change) {
  return { ...fs, async open(file, flags, mode) {
    const handle = await fs.open(file, flags, mode);
    return new Proxy(handle, { get(target, property) {
      const value = target[property];
      if (typeof value !== 'function') return value;
      return async (...args) => {
        if (await change(file, property, args, target)) return;
        return value.apply(target, args);
      };
    } });
  } };
}

test('fresh intent is synced before one create; six stable defaults and exact reopen preserve confirmed data', async t => {
  const f = await fixture(t); const events = [];
  const io = faultIO(async (file, operation) => { if (operation === 'sync') events.push(file); });
  const client = nativeFixture({ beforeCreate: async marker => {
    const intent = JSON.parse(await fs.readFile(f.intent, 'utf8'));
    assert.equal(intent.marker, marker); assert.ok(events.includes(f.intent)); assert.ok(events.includes(f.roots.protectedRoot));
    assert.equal((await fs.stat(f.intent)).mode & 0o777, 0o600);
  } });
  assert.deepEqual(await initialize(f, client, {}, { io }), { agentId });
  const initial = decodeAppServerMemory(await fs.readFile(f.data, 'utf8'), agentId);
  assert.equal(initial.revision, 0); assert.deepEqual(initial.archive, []);
  assert.deepEqual(initial.blocks.map(({ id, ...block }) => block), createMemoryBlocks(PERSONA_TEXT, MEMORY_POLICY_TEXT));
  assert.equal(new Set(initial.blocks.map(block => block.id)).size, 6);
  assert.equal(initial.blocks.filter(block => block.readOnly).length, 2);
  assert.equal(initial.runtimeBinding.stateRoot, f.roots.stateRoot);
  const store = await openCanonicalMemoryStore({ directory: f.roots.protectedRoot, agentId });
  const updated = structuredClone(initial); updated.revision++;
  updated.blocks.find(block => block.label === 'PROFILE').value = 'Confirmed synthetic profile';
  updated.archive.push({ id: 'archive-1', text: 'Synthetic retained item', tags: ['confirmed'] });
  await store.commit(updated, { expectedRevision: 0, confirmedLabels: ['PROFILE'] }); await store.close();
  const before = await fs.readFile(f.data); const intentBefore = await fs.readFile(f.intent);
  assert.deepEqual(await initialize(f, client), { agentId }); assert.equal(client.creates, 1);
  assert.deepEqual(await fs.readFile(f.data), before); assert.deepEqual(await fs.readFile(f.intent), intentBefore);
  assert.deepEqual((await fs.readdir(f.roots.protectedRoot)).sort(), [BOOTSTRAP_INTENT, CANONICAL_MEMORY_FILE].sort());
});

test('existing canonical bootstrap admits real bound receipt database without recreating Agent or redispatch', async t => {
  const f = await fixture(t); const client = nativeFixture(); await initialize(f, client);
  const request = { operationId: '12345678-1234-4234-8234-123456789abc', kind: 'create', title: 'Retained' };
  let store = openChatOperationStore({ directory: f.roots.protectedRoot, agentId });
  assert.equal(store.reserve(request).dispatchAllowed, true); store.close();
  assert.deepEqual(await initialize(f, client), { agentId });
  store = openChatOperationStore({ directory: f.roots.protectedRoot, agentId });
  assert.equal(store.reserve(request).dispatchAllowed, false); store.close();
  assert.equal(client.creates, 1);
});

test('bounded current canonical read requires successful resolve and preserves exact bytes digest and immutable data', async t => {
  const f = await fixture(t); const client = nativeFixture(); const preparation = await prepareAssistantBootstrap(f.roots);
  await assert.rejects(preparation.readMemory(), { code: 'MEMORY_UNAVAILABLE' });
  await preparation.resolve(client);
  const first = await preparation.readMemory(); const bytes = await fs.readFile(f.data);
  assert.equal(first.digest, sha(bytes)); assert.equal(first.memory.agentId, agentId); assert.ok(Object.isFrozen(first.memory.blocks[0]));
  const changed = JSON.parse(bytes); changed.blocks[1].value = 'Current synthetic context'; changed.revision++;
  await fs.writeFile(f.data, JSON.stringify(changed));
  const second = await preparation.readMemory(); assert.equal(second.memory.revision, 1); assert.notEqual(second.digest, first.digest);
  // Same revision and content but changed bytes must still invalidate a preview.
  const formatted = Buffer.from(JSON.stringify(changed, null, 2)); await fs.writeFile(f.data, formatted);
  const third = await preparation.readMemory(); assert.equal(third.digest, sha(formatted)); assert.notEqual(third.digest, second.digest);
  assert.equal(third.memory.revision, second.memory.revision);
  // The actual canonical store preserves BOM for codec rejection. Bootstrap
  // must not silently admit bytes that that owner cannot reopen.
  await fs.writeFile(f.data, Buffer.concat([Buffer.from('\ufeff'), formatted]));
  await assert.rejects(preparation.readMemory(), { code: 'MEMORY_UNAVAILABLE' });
  await assert.rejects(openCanonicalMemoryStore({ directory: f.roots.protectedRoot, agentId }), { code: 'CORRUPT' });
  await preparation.close(); await assert.rejects(preparation.readMemory(), { code: 'MEMORY_UNAVAILABLE' });
});

test('current canonical read revalidates policy, six block identity, Agent/runtime binding and private-file bounds', async t => {
  for (const kind of ['policy', 'block-id', 'agent', 'binding', 'missing-block', 'permission', 'oversize']) {
    const f = await fixture(t); const client = nativeFixture(); const preparation = await prepareAssistantBootstrap(f.roots);
    await preparation.resolve(client);
    const memory = JSON.parse(await fs.readFile(f.data, 'utf8'));
    if (kind === 'policy') memory.blocks.find(row => row.label === 'PERSONA').value = 'Modified policy';
    if (kind === 'block-id') memory.blocks[0].id = 'changed';
    if (kind === 'agent') memory.agentId = 'foreign';
    if (kind === 'binding') memory.runtimeBinding.stateRoot = '/private/tmp/foreign/state';
    if (kind === 'missing-block') memory.blocks.pop();
    await fs.writeFile(f.data, JSON.stringify(memory));
    if (kind === 'permission') await fs.chmod(f.data, 0o644);
    if (kind === 'oversize') await fs.truncate(f.data, 1048577);
    await assert.rejects(preparation.readMemory(), { code: 'MEMORY_UNAVAILABLE' });
    await preparation.close();
  }
});

test('close drains an accepted canonical read and invalidates late delivery', async t => {
  const f = await fixture(t); const gate = deferred(); const entered = deferred(); let block = false;
  const io = faultIO(async (file, operation) => { if (block && file === f.data && operation === 'read') { entered.resolve(); await gate.promise; } });
  const preparation = await prepareAssistantBootstrap(f.roots, {}, { io }); await preparation.resolve(nativeFixture()); block = true;
  const reading = preparation.readMemory(); const rejected = assert.rejects(reading, { code: 'MEMORY_UNAVAILABLE' });
  await entered.promise; let closed = false; const closing = preparation.close().then(() => { closed = true; });
  await tick(); assert.equal(closed, false); gate.resolve(); await rejected; await closing;
});

test('uncertain canonical read handle close remains explicit in bootstrap cleanup', async t => {
  const f = await fixture(t); let inject = false;
  const io = faultIO(async (file, operation, _args, handle) => {
    if (inject && file === f.data && operation === 'close') { await handle.close(); throw new Error('PRIVATE_CLOSE'); }
  });
  const preparation = await prepareAssistantBootstrap(f.roots, {}, { io }); await preparation.resolve(nativeFixture()); inject = true;
  await assert.rejects(preparation.readMemory(), { code: 'MEMORY_UNAVAILABLE' });
  await assert.rejects(preparation.close(), failure('CLEANUP_FAILED'));
});

for (const kind of ['close', 'read']) test(`managed acquisition canonical ${kind} fault preserves cleanup truth`, async t => {
  const f = await fixture(t); await initialize(f, nativeFixture());
  let diagnosticHandle; let acquisitionCode; let starts = 0;
  const io = faultIO(async (file, operation, _args, handle) => {
    if (file === f.data && operation === kind) { diagnosticHandle = handle; throw new Error('PRIVATE_CANONICAL_FAULT'); }
  });
  const roots = { ...f.roots, dependencyRoot: '/private/tmp/synthetic-dependencies/node_modules' };
  const seams = {
    makeAuth: async () => ({ launchSpec: {}, dispose: async () => {} }),
    prepare: async (input, options) => {
      try { return await prepareAssistantBootstrap(input, options, { io }); }
      catch (error) { acquisitionCode = error.code; throw error; }
    },
    start: () => { starts++; assert.fail('Native start must not run after acquisition failure'); },
  };
  const session = initializeManagedReadSession(roots, {}, seams);
  try {
    await assert.rejects(session.ready, { code: 'STARTUP_FAILED' });
    const terminal = await session.terminal;
    const handleOpen = await diagnosticHandle.stat().then(() => true, () => false);
    t.diagnostic(JSON.stringify({ acquisitionCode, handleOpen, terminal }));
    assert.equal(starts, 0); assert.equal(handleOpen, kind === 'close');
    assert.equal(terminal.cleanup.confirmed, kind !== 'close');
    assert.equal(acquisitionCode, kind === 'close' ? 'CLEANUP_FAILED' : 'IO');
    if (kind === 'close') {
      assert.equal(terminal.phase, 'failed'); assert.ok(terminal.errors.includes('LATE_CLEANUP_FAILED'));
      assert.throws(() => initializeManagedReadSession(roots, {}, seams), { code: 'STATE_IN_USE' });
    } else {
      assert.deepEqual(terminal.errors, []);
      const next = initializeManagedReadSession(roots, {}, seams);
      assert.equal((await next.close()).cleanup.confirmed, true);
    }
  } finally { await session.close(); await diagnosticHandle?.close(); }
});

test('receipt metadata admission rejects unsafe files, missing canonical, orphan journal and unknown sidecars', async t => {
  for (const kind of ['permissions', 'symlink', 'hardlink', 'directory', 'oversize', 'orphan', 'wal', 'shm', 'unknown', 'missing-canonical']) {
    const f = await fixture(t); const client = nativeFixture();
    if (kind === 'missing-canonical') {
      const lost = nativeFixture({ lost: true }); await assert.rejects(initialize(f, lost)); client.agents = lost.agents;
    } else await initialize(f, client);
    const database = path.join(f.roots.protectedRoot, 'operations.sqlite');
    if (kind === 'symlink' || kind === 'hardlink') {
      const target = path.join(f.root, 'synthetic-receipts'); await fs.writeFile(target, 'synthetic', { mode: 0o600 });
      if (kind === 'symlink') await fs.symlink(target, database); else await fs.link(target, database);
    } else if (kind === 'directory') await fs.mkdir(database, { mode: 0o700 });
    else if (!['orphan', 'wal', 'shm', 'unknown'].includes(kind)) {
      await fs.writeFile(database, 'synthetic', { mode: kind === 'permissions' ? 0o644 : 0o600 });
      if (kind === 'oversize') await fs.truncate(database, 256 * 1024 * 1024 + 1);
    } else await fs.writeFile(path.join(f.roots.protectedRoot,
      kind === 'orphan' ? 'operations.sqlite-journal' : kind === 'unknown' ? 'unknown' : `operations.sqlite-${kind}`), 'synthetic', { mode: 0o600 });
    await assert.rejects(initialize(f, client), failure());
  }
  const f = await fixture(t); const client = nativeFixture(); await initialize(f, client);
  for (const name of ['operations.sqlite', 'operations.sqlite-journal']) await fs.writeFile(path.join(f.roots.protectedRoot, name), 'metadata-only', { mode: 0o600 });
  assert.deepEqual(await initialize(f, client), { agentId });
  assert.throws(() => openChatOperationStore({ directory: f.roots.protectedRoot, agentId }));
});

test('lost creation reply resumes only same marker Agent; missing outcome never creates again', async t => {
  for (const absent of [false, true]) {
    const f = await fixture(t); const client = nativeFixture({ lost: true });
    await assert.rejects(initialize(f, client), failure('INITIALIZATION_FAILED'));
    const intent = await fs.readFile(f.intent);
    if (absent) client.agents = [];
    if (absent) await assert.rejects(initialize(f, client), failure('INITIALIZATION_FAILED'));
    else assert.deepEqual(await initialize(f, client), { agentId });
    assert.equal(client.creates, 1); assert.deepEqual(await fs.readFile(f.intent), intent);
  }
});

test('fresh nonempty state/protected or tagged inventory cannot be adopted or overwritten', async t => {
  for (const kind of ['state', 'protected', 'inventory']) {
    const f = await fixture(t); const client = nativeFixture();
    if (kind !== 'inventory') await fs.writeFile(path.join(kind === 'state' ? f.roots.stateRoot : f.roots.protectedRoot, 'foreign'), 'PRIVATE_SYNTHETIC', { mode: 0o600 });
    else client.agents = [{ id: 'agent-foreign', tags: [TAG] }];
    await assert.rejects(initialize(f, client), failure(kind === 'inventory' ? 'INITIALIZATION_FAILED' : 'EXISTING_DATA'));
    assert.equal(client.creates, 0); await assert.rejects(fs.stat(f.intent), { code: 'ENOENT' });
  }
});

test('duplicate, foreign marker, retrieval mismatch and changed canonical binding fail without replacement', async t => {
  for (const kind of ['duplicate', 'marker', 'retrieve', 'binding', 'agent-id', 'policy', 'block-id']) {
    const f = await fixture(t); const client = nativeFixture(); await initialize(f, client);
    if (kind === 'duplicate') client.agents = [...client.agents, { ...client.agents[0], id: 'agent-duplicate' }];
    if (kind === 'marker') client.agents[0].tags = [TAG, `personal-co-bootstrap-v1-${'0'.repeat(32)}`];
    if (kind === 'retrieve') {
      const original = client.request; client.request = async (type, ...args) => type === 'agent_retrieve'
        ? { success: true, agent: { ...client.agents[0], id: 'agent-other' } } : original(type, ...args);
    }
    if (['binding', 'agent-id', 'policy', 'block-id'].includes(kind)) {
      const memory = JSON.parse(await fs.readFile(f.data, 'utf8'));
      if (kind === 'binding') memory.runtimeBinding.stateRoot = '/private/tmp/foreign/state';
      if (kind === 'agent-id') client.agents[0].id = 'agent-replaced';
      if (kind === 'policy') memory.blocks.find(block => block.label === 'PERSONA').value = 'wrong policy';
      if (kind === 'block-id') memory.blocks[0].id = 'different-block';
      await fs.writeFile(f.data, JSON.stringify(memory));
    }
    const before = await fs.readFile(f.data);
    await assert.rejects(initialize(f, client), failure('INITIALIZATION_FAILED'));
    assert.equal(client.creates, 1); assert.deepEqual(await fs.readFile(f.data), before);
  }
});

test('private path, symlink, hardlink, corrupt and oversized intent checks reject before creation', async t => {
  for (const kind of ['permission', 'directory-link', 'intent-link', 'hardlink', 'corrupt', 'oversize', 'wrong-root']) {
    const f = await fixture(t); const client = nativeFixture();
    if (kind === 'permission') await fs.chmod(f.roots.protectedRoot, 0o755);
    else if (kind === 'directory-link') {
      const alias = path.join(f.root, 'alias'); await fs.symlink(f.roots.protectedRoot, alias); f.roots.protectedRoot = alias;
    } else if (kind === 'intent-link' || kind === 'hardlink') {
      const target = path.join(f.root, 'synthetic-target'); await fs.writeFile(target, '{}', { mode: 0o600 });
      if (kind === 'intent-link') await fs.symlink(target, f.intent); else await fs.link(target, f.intent);
    } else {
      const value = kind === 'corrupt' ? '{broken' : kind === 'oversize' ? 'x'.repeat(4097)
        : JSON.stringify({ schema: 'personal-co-bootstrap', version: 1, stateRoot: '/private/tmp/wrong/state',
          protectedRoot: f.roots.protectedRoot, marker: `personal-co-bootstrap-v1-${'1'.repeat(32)}` });
      await fs.writeFile(f.intent, value, { mode: 0o600 });
    }
    await assert.rejects(initialize(f, client), failure()); assert.equal(client.creates, 0);
  }
});

test('concurrent lock is never stolen; configuration is captured and repeated resolve is rejected', async t => {
  const f = await fixture(t); const original = { ...f.roots }; const opening = prepareAssistantBootstrap(f.roots);
  f.roots.stateRoot = '/private/tmp/changed/state'; const preparation = await opening;
  await assert.rejects(prepareAssistantBootstrap(original), failure('LOCKED'));
  const client = nativeFixture(); assert.deepEqual(await preparation.resolve(client), { agentId });
  await assert.rejects(preparation.resolve(client), failure('ALREADY_ATTEMPTED'));
  assert.equal(preparation.close(), preparation.close()); await preparation.close();
  let getter = false;
  await assert.rejects(prepareAssistantBootstrap({ get stateRoot() { getter = true; } }), failure('INVALID_CONFIG'));
  assert.equal(getter, false);
});

test('cancellation before create, after intent sync and after creation never dispatches late or overwrites evidence', async t => {
  for (const kind of ['before', 'intent-sync', 'created']) {
    const f = await fixture(t); const abort = new AbortController();
    const client = nativeFixture({ afterCreate: async () => { if (kind === 'created') abort.abort(); } });
    const io = faultIO(async (file, operation, args, handle) => {
      if (kind === 'intent-sync' && file === f.intent && operation === 'sync') { await handle.sync(); abort.abort(); return true; }
    });
    if (kind === 'before') abort.abort();
    await assert.rejects(initialize(f, client, { signal: abort.signal }, { io }), failure());
    assert.equal(client.creates, kind === 'created' ? 1 : 0);
    if (kind !== 'before') {
      const before = await fs.readFile(f.intent);
      if (kind === 'created') assert.deepEqual(await initialize(f, client), { agentId });
      else await assert.rejects(initialize(f, client), failure('INITIALIZATION_FAILED'));
      assert.deepEqual(await fs.readFile(f.intent), before);
    }
  }
});

test('partial intent publication is retained; unknown canonical publication reconciles without replay', async t => {
  const f = await fixture(t); const client = nativeFixture();
  const io = faultIO(async (file, operation, args, handle) => {
    if (file === f.intent && operation === 'writeFile') { await handle.writeFile('{partial'); throw new Error('PRIVATE_IO'); }
  });
  await assert.rejects(initialize(f, client, {}, { io }), failure('INITIALIZATION_FAILED'));
  assert.equal(await fs.readFile(f.intent, 'utf8'), '{partial');
  await assert.rejects(initialize(f, client), failure()); assert.equal(client.creates, 0);
  const complete = await fixture(t); const native = nativeFixture();
  let initializations = 0;
  const openStore = async options => {
    const store = await openCanonicalMemoryStore(options);
    return { ...store, async initialize(value) { initializations++; await store.initialize(value); throw new Error('PRIVATE_UNKNOWN_PUBLICATION'); } };
  };
  await assert.rejects(initialize(complete, native, {}, { openStore }), failure('INITIALIZATION_FAILED'));
  const before = await fs.readFile(complete.data);
  assert.deepEqual(await initialize(complete, native, {}, { openStore }), { agentId });
  assert.equal(initializations, 1); assert.equal(native.creates, 1); assert.deepEqual(await fs.readFile(complete.data), before);
});

test('failed lock acquisition cleanup and canonical close uncertainty are explicit, not swallowed', async t => {
  const f = await fixture(t);
  const io = { ...faultIO(async (file, operation) => {
    if (file === f.lock && operation === 'sync') throw new Error('PRIVATE_SYNC');
  }), async unlink() { throw new Error('PRIVATE_UNLINK'); } };
  await assert.rejects(prepareAssistantBootstrap(f.roots, {}, { io }), failure('CLEANUP_FAILED'));
  assert.ok((await fs.stat(f.lock)).isFile());
  const g = await fixture(t); const native = nativeFixture();
  const preparation = await prepareAssistantBootstrap(g.roots, {}, { openStore: async options => {
    const store = await openCanonicalMemoryStore(options);
    return { ...store, async close() { await store.close(); throw new Error('PRIVATE_CLOSE'); } };
  } });
  await assert.rejects(preparation.resolve(native), failure('INITIALIZATION_FAILED'));
  await assert.rejects(preparation.close(), failure('CLEANUP_FAILED')); assert.equal(native.creates, 1);
});

test('rejected canonical acquisition with a retained lock remains cleanup uncertainty', async t => {
  const f = await fixture(t); const native = nativeFixture();
  const canonicalLock = path.join(f.roots.protectedRoot, CANONICAL_MEMORY_LOCK);
  const io = { ...faultIO(async (file, operation) => {
    if (file === canonicalLock && operation === 'sync') throw new Error('PRIVATE_ACQUISITION_SYNC');
  }), async unlink(file) {
    if (file === canonicalLock) throw new Error('PRIVATE_ACQUISITION_UNLINK');
    return fs.unlink(file);
  } };
  const preparation = await prepareAssistantBootstrap(f.roots, {}, {
    openStore: options => openCanonicalMemoryStore(options, { io }),
  });
  await assert.rejects(preparation.resolve(native), failure('INITIALIZATION_FAILED'));
  assert.ok((await fs.stat(canonicalLock)).isFile());
  await assert.rejects(preparation.close(), failure('CLEANUP_FAILED'));
  assert.ok((await fs.stat(canonicalLock)).isFile()); assert.equal(native.creates, 1);
});

test('close waits accepted filesystem work and abort prevents late canonical/create publication', async t => {
  const f = await fixture(t); const gate = deferred(); const entered = deferred(); const abort = new AbortController();
  const client = nativeFixture({ request: async type => { if (type === 'agent_list') { entered.resolve(); await gate.promise; } } });
  const preparation = await prepareAssistantBootstrap(f.roots, { signal: abort.signal });
  const resolving = preparation.resolve(client); const rejected = assert.rejects(resolving, failure('ABORTED'));
  await entered.promise; abort.abort(); let finished = false;
  const closing = preparation.close().then(() => { finished = true; }); await tick(); assert.equal(finished, false);
  gate.resolve(); await rejected; await closing; assert.equal(client.creates, 0);
  await assert.rejects(fs.stat(f.intent), { code: 'ENOENT' });
});

// Change-detection/operator attestation only. Independent review is a separate
// prerequisite; the digest itself is not authentication or proof of review.
const reviewFiles = ['../server/assistant-bootstrap.mjs', './assistant-bootstrap.test.mjs',
  '../server/authenticated-app-server.mjs', './authenticated-app-server.test.mjs',
  '../server/managed-read-session.mjs', './managed-read-session.test.mjs',
  '../server/runtime-process.mjs', '../server/runtime-sandbox.mjs', '../server/conversation-reader.mjs',
  '../server/canonical-memory-store.mjs', '../src/domain/app-server-memory-codec.mjs',
  '../src/domain/memory.mjs', '../src/domain/policy.mjs', '../server/package.json', '../server/package-lock.json',
  '../../scripts/probe_runtime_confinement.mjs'];
async function reviewDigest() {
  const digest = createHash('sha256'); for (const file of reviewFiles) digest.update(await fs.readFile(new URL(file, import.meta.url)));
  return digest.digest('hex');
}
test('native assistant bootstrap and same-Agent reopen (opt-in after frozen-source security PASS)', {
  skip: process.env.WP0048_RUN_NATIVE !== '1', timeout: 90000,
}, async t => {
  assert.equal(process.platform, 'darwin');
  assert.equal(process.env.WP0048_REVIEWED_SHA256, await reviewDigest(), 'Review digest missing or changed.');
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0048-native-'));
  const roots = { dependencyRoot: process.env.WP0048_DEPENDENCY_ROOT ?? '/private/tmp/personal-co-wp0041.qRnOrc/node_modules',
    stateRoot: path.join(root, 'state'), protectedRoot: path.join(root, 'protected') };
  await fs.mkdir(roots.stateRoot, { mode: 0o700 }); await fs.mkdir(roots.protectedRoot, { mode: 0o700 });
  const controller = new AbortController(); const cancel = () => controller.abort();
  process.on('SIGINT', cancel); process.on('SIGTERM', cancel); t.signal.addEventListener('abort', cancel, { once: true });
  const runs = []; let session; let original; let identity;
  try {
    for (let run = 0; run < 2; run++) {
      const events = []; session = initializeManagedReadSession(roots, { signal: controller.signal }, { observe: event => events.push(event) });
      const ready = await session.ready; const page = await session.listConversations(); assert.deepEqual(page.items, []);
      const bytes = await fs.readFile(path.join(roots.protectedRoot, CANONICAL_MEMORY_FILE));
      const memory = decodeAppServerMemory(bytes.toString('utf8'), ready.agentId);
      assert.equal(memory.blocks.length, 6); assert.equal(memory.revision, 0); assert.deepEqual(memory.archive, []);
      if (run === 0) { original = bytes; identity = ready.agentId; }
      else { assert.equal(ready.agentId, identity); assert.deepEqual(bytes, original); }
      const cleanup = await session.close(); assert.equal(cleanup.cleanup.confirmed, true); assert.equal(cleanup.cleanup.listenerGone, true);
      runs.push({ run, agentId: ready.agentId, canonicalSha256: sha(bytes), blockCount: memory.blocks.length,
        revision: memory.revision, conversationCount: page.items.length, events, cleanup });
    }
    t.diagnostic(JSON.stringify({ schema: 'wp0048-native-bootstrap-reopen-v1', root, pin: RUNTIME_PIN,
      reviewedSourceSha256: await reviewDigest(), runs }));
  } finally {
    const result = await session?.close();
    process.off('SIGINT', cancel); process.off('SIGTERM', cancel); t.signal.removeEventListener('abort', cancel);
    if (result) assert.equal(result.cleanup.confirmed, true, 'Native cleanup unconfirmed.');
  }
});
