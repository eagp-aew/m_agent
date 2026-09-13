import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createMemoryBlocks } from '../src/domain/memory.mjs';
import { encodeAppServerMemory, decodeAppServerMemory } from '../src/domain/app-server-memory-codec.mjs';
import {
  openCanonicalMemoryStore, CANONICAL_MEMORY_FILE, CANONICAL_MEMORY_LOCK,
} from '../server/canonical-memory-store.mjs';

const agentId = ' synthetic/Agent-中文 ';
const moduleURL = new URL('../server/canonical-memory-store.mjs', import.meta.url).href;
const retainedRoot = await fs.realpath(await fs.mkdtemp(path.join(tmpdir(), 'canonical-memory-tests-')));
let fixtureNumber = 0;

function memory(revision = 0) {
  return {
    agentId, revision,
    blocks: createMemoryBlocks('人格\n🙂', 'Policy\nexact').map((block, index) => ({
      id: ` block-${index} `, ...block,
      metadata: { nested: ['  中文\r\n🙂 ', null, { evidence: true }] },
      extension: { retained: index },
    })).reverse(),
    archive: [
      { id: 'a-z', text: '  same\n🙂 ', tags: ['z', 'a', 'z', ''], createdAt: null, extra: [1, 2] },
      { id: 'a-a', text: '  same\n🙂 ', tags: ['a', 'z'], updatedAt: '2026-09-12T01:02:03+08:00' },
    ],
    extension: { original: ['z', 'a'] },
  };
}

const block = (candidate, label) => candidate.blocks.find((item) => item.label === label);
const decoded = (candidate) => decodeAppServerMemory(encodeAppServerMemory(candidate), agentId);
const code = (expected) => (error) => {
  assert.equal(error.code, expected);
  assert.equal(error.cause, undefined);
  assert.ok(!error.message.includes(retainedRoot));
  assert.ok(!error.message.includes(agentId));
  return true;
};

async function fixture(t, io) {
  const directory = path.join(retainedRoot, String(++fixtureNumber));
  await fs.mkdir(directory, { mode: 0o700 });
  t.diagnostic(`Retained synthetic directory: ${directory}`);
  const options = { directory, agentId };
  const open = () => openCanonicalMemoryStore(options, io ? { io } : undefined);
  return { directory, options, open, dataPath: path.join(directory, CANONICAL_MEMORY_FILE),
    lockPath: path.join(directory, CANONICAL_MEMORY_LOCK) };
}

// Real filesystem operations remain in use; inject one precise I/O boundary.
function faultIO(control) {
  return {
    ...fs,
    async open(filePath, flags, mode) {
      const handle = await fs.open(filePath, flags, mode);
      return new Proxy(handle, {
        get(target, property) {
          if (property === 'writeFile' || property === 'sync') return async (...args) => {
            const stat = await target.stat();
            const phase = stat.isDirectory() ? 'directory-sync'
              : filePath.endsWith('.tmp') ? `temp-${property}` : `lock-${property}`;
            control.events?.push(phase);
            if (control.fail === phase) throw new Error('PRIVATE-SYNTHETIC-IO');
            return target[property](...args);
          };
          const value = target[property];
          return typeof value === 'function' ? value.bind(target) : value;
        },
      });
    },
    async rename(from, to) {
      control.events?.push('rename');
      if (control.fail === 'rename-before') throw new Error('PRIVATE-SYNTHETIC-IO');
      await fs.rename(from, to);
      if (control.fail === 'rename-after') throw new Error('PRIVATE-SYNTHETIC-IO');
    },
    async link(from, to) {
      control.events?.push('link');
      if (control.beforeLink) await control.beforeLink(to);
      return fs.link(from, to);
    },
    async unlink(filePath) {
      if (control.fail === 'init-unlink' && filePath.endsWith('.canonical-memory-initialize.tmp')) {
        throw new Error('PRIVATE-SYNTHETIC-IO');
      }
      return fs.unlink(filePath);
    },
  };
}

test('explicit initialization, exact lossless frozen reads, update and reopen with fixed private filenames', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  assert.deepEqual(await fs.readdir(f.directory), [CANONICAL_MEMORY_LOCK]);
  await assert.rejects(store.read(), code('MISSING'));
  await assert.rejects(store.commit(memory(1), { expectedRevision: 0 }), code('MISSING'));
  await assert.rejects(store.initialize(memory(1)), code('INVALID'));
  const source = memory();
  block(source, 'CURRENT_CONTEXT').read_only = false;
  delete block(source, 'CURRENT_CONTEXT').readOnly;
  assert.deepEqual(await store.initialize(source), decoded(source));
  assert.equal((await fs.stat(f.dataPath)).mode & 0o777, 0o600);
  assert.equal((await fs.stat(f.lockPath)).mode & 0o777, 0o600);
  await assert.rejects(store.initialize(source), code('EXISTS'));
  const first = await store.read();
  const second = await store.read();
  assert.deepEqual(first, decoded(source));
  assert.notEqual(first.blocks[0].metadata, second.blocks[0].metadata);
  assert.throws(() => first.archive[0].tags.push('no'), TypeError);
  const next = structuredClone(first);
  next.revision++;
  block(next, 'CURRENT_CONTEXT').value = ' updated\n🙂 ';
  block(next, 'LEARNING_MODEL').metadata = { evidence: ['new'] };
  next.archive.reverse();
  next.archive[0].tags.push('duplicate', 'duplicate');
  next.extension.original.reverse();
  assert.deepEqual(await store.commit(next, { expectedRevision: 0 }), decoded(next));
  await store.close();
  assert.deepEqual(await fs.readdir(f.directory), [CANONICAL_MEMORY_FILE]);
  await assert.rejects(store.read(), code('CLOSED'));
  await assert.rejects(store.commit(memory(2), { expectedRevision: 1 }), code('CLOSED'));
  const reopened = await f.open();
  assert.deepEqual(await reopened.read(), decoded(next));
  await reopened.close();
});

test('same-instance queue commits exactly one stale revision and close drains earlier operations', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  await store.initialize(memory());
  const a = memory(1);
  const b = memory(1);
  block(a, 'CURRENT_CONTEXT').value = 'a';
  block(b, 'CURRENT_CONTEXT').value = 'b';
  const resultsPromise = Promise.allSettled([
    store.commit(a, { expectedRevision: 0 }), store.commit(b, { expectedRevision: 0 }),
  ]);
  const closed = store.close();
  const [first, second] = await resultsPromise;
  assert.equal(first.status, 'fulfilled');
  assert.equal(second.reason.code, 'CONFLICT');
  await closed;
  assert.deepEqual(decodeAppServerMemory(await fs.readFile(f.dataPath, 'utf8'), agentId), decoded(a));
});

test('snapshots initialization, commit payload and confirmation list before any asynchronous queue work', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  const initial = memory();
  const init = store.initialize(initial);
  block(initial, 'PROFILE').value = 'mutated after submission';
  await init;
  assert.deepEqual(await store.read(), decoded(memory()));
  const next = memory(1);
  block(next, 'PROFILE').value = 'approved exact content';
  const confirmedLabels = ['PROFILE'];
  const writing = store.commit(next, { expectedRevision: 0, confirmedLabels });
  block(next, 'PROFILE').value = 'unapproved mutation';
  confirmedLabels.length = 0;
  await writing;
  assert.equal(block(await store.read(), 'PROFILE').value, 'approved exact content');
  const unconfirmed = memory(2);
  const lateLabels = [];
  const rejected = store.commit(unconfirmed, { expectedRevision: 1, confirmedLabels: lateLabels });
  lateLabels.push('PROFILE');
  await assert.rejects(rejected, code('CONFIRMATION_REQUIRED'));
  await store.close();
});

test('policy blocks, block order, IDs, labels, limits, flag representation and extensions are immutable', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  await store.initialize(memory());
  const before = await fs.readFile(f.dataPath);
  const mutations = [
    (m) => { block(m, 'PERSONA').value += ' changed'; },
    (m) => { block(m, 'MEMORY_POLICY').metadata.nested.push('changed'); },
    (m) => { block(m, 'CURRENT_CONTEXT').id = 'replacement'; },
    (m) => { block(m, 'CURRENT_CONTEXT').limit++; },
    (m) => { block(m, 'CURRENT_CONTEXT').extension.retained++; },
    (m) => { block(m, 'CURRENT_CONTEXT').read_only = false; },
    (m) => { m.blocks.reverse(); },
  ];
  for (const mutate of mutations) {
    const next = memory(1); mutate(next);
    await assert.rejects(store.commit(next, { expectedRevision: 0, confirmedLabels: ['PROFILE', 'GOALS_AND_DECISIONS'] }), code('PROTECTED'));
    assert.deepEqual(await fs.readFile(f.dataPath), before);
  }
  await store.close();
});

test('PROFILE and GOALS_AND_DECISIONS values and metadata each require confirmation for that commit', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  await store.initialize(memory());
  let current = memory();
  for (const label of ['PROFILE', 'GOALS_AND_DECISIONS']) {
    for (const field of ['value', 'metadata']) {
      const next = structuredClone(current); next.revision++;
      block(next, label)[field] = field === 'value' ? 'confirmed update' : { verified: true };
      await assert.rejects(store.commit(next, { expectedRevision: current.revision }), code('CONFIRMATION_REQUIRED'));
      await store.commit(next, { expectedRevision: current.revision, confirmedLabels: [label] });
      current = next;
    }
  }
  assert.deepEqual(await store.read(), decoded(current));
  await store.close();
});

test('invalid candidate/revision/Agent/schema and accessors fail without changing bytes or leaking content', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  await store.initialize(memory());
  const before = await fs.readFile(f.dataPath);
  for (const expectedRevision of [-1, -0, 0.5, '0', null, NaN, Number.MAX_SAFE_INTEGER]) {
    await assert.rejects(store.commit(memory(1), { expectedRevision }), code('INVALID'));
  }
  for (const mutate of [
    (m) => { m.agentId = 'other'; }, (m) => { m.schema = 'unknown'; },
    (m) => { m.revision = 3; }, (m) => { m.blocks[0].readOnly = false; },
    (m) => { m.archive[0].text = null; },
  ]) {
    const next = memory(1); mutate(next);
    await assert.rejects(store.commit(next, { expectedRevision: 0 }), code('INVALID'));
  }
  let calls = 0;
  const next = memory(1);
  Object.defineProperty(next, 'private', { enumerable: true, get() { calls++; throw new Error(agentId); } });
  await assert.rejects(store.commit(next, { expectedRevision: 0 }), code('INVALID'));
  assert.equal(calls, 0);
  assert.deepEqual(await fs.readFile(f.dataPath), before);
  await store.close();
});

test('same-process and separate-process owners fail closed; stale crash lock is retained', async (t) => {
  const f = await fixture(t);
  const store = await f.open();
  await assert.rejects(f.open(), code('LOCKED'));
  const childSource = `import { openCanonicalMemoryStore } from ${JSON.stringify(moduleURL)};
    try { await openCanonicalMemoryStore(JSON.parse(process.argv[1])); process.exitCode = 2; }
    catch (error) { process.stdout.write(error.code); }`;
  const child = spawn(process.execPath, ['--input-type=module', '-e', childSource, JSON.stringify(f.options)]);
  let output = ''; child.stdout.on('data', (part) => { output += part; });
  const [exitCode] = await once(child, 'close');
  assert.equal(exitCode, 0); assert.equal(output, 'LOCKED');
  await store.close();
  const crashing = spawn(process.execPath, ['--input-type=module', '-e',
    `import { openCanonicalMemoryStore } from ${JSON.stringify(moduleURL)};
     await openCanonicalMemoryStore(JSON.parse(process.argv[1])); process.exit(0);`, JSON.stringify(f.options)]);
  assert.equal((await once(crashing, 'close'))[0], 0);
  const stale = await fs.readFile(f.lockPath);
  await assert.rejects(f.open(), code('LOCKED'));
  assert.deepEqual(await fs.readFile(f.lockPath), stale);
});

test('rejects missing, relative, aliased, symlinked and nonprivate directories without repair', async (t) => {
  const f = await fixture(t);
  for (const directory of ['relative', '/', `${f.directory}/../1`, `${f.directory}/missing`]) {
    await assert.rejects(openCanonicalMemoryStore({ directory, agentId }));
  }
  const alias = path.join(retainedRoot, `alias-${fixtureNumber}`);
  await fs.symlink(f.directory, alias);
  await assert.rejects(openCanonicalMemoryStore({ directory: alias, agentId }), code('UNSAFE_PATH'));
  await fs.chmod(f.directory, 0o750);
  await assert.rejects(f.open(), code('UNSAFE_PATH'));
  assert.deepEqual(await fs.readdir(f.directory), []);
});

test('rejects symlink/nonregular/nonprivate/hardlinked data and unsafe lock targets', async (t) => {
  for (const kind of ['data-symlink', 'data-directory', 'data-public', 'data-hardlink', 'lock-symlink', 'lock-directory']) {
    const f = await fixture(t);
    const other = path.join(f.directory, 'synthetic-other');
    await fs.writeFile(other, encodeAppServerMemory(memory()), { mode: 0o600, flag: 'wx' });
    const target = kind.startsWith('lock') ? f.lockPath : f.dataPath;
    if (kind.endsWith('symlink')) await fs.symlink(other, target);
    if (kind.endsWith('directory')) await fs.mkdir(target, { mode: 0o700 });
    if (kind === 'data-public') await fs.writeFile(target, encodeAppServerMemory(memory()), { mode: 0o644, flag: 'wx' });
    if (kind === 'data-hardlink') await fs.link(other, target);
    await assert.rejects(f.open(), code(kind.startsWith('lock') ? 'LOCKED' : 'UNSAFE_PATH'));
    assert.equal(await fs.readFile(other, 'utf8'), encodeAppServerMemory(memory()));
  }
});

test('corrupt or wrong-Agent existing records never auto-initialize; corrupt bytes remain untouched', async (t) => {
  for (const bytes of ['{PRIVATE-SYNTHETIC', encodeAppServerMemory({ ...memory(), agentId: 'other' }), Buffer.from([0xff])]) {
    const f = await fixture(t);
    await fs.writeFile(f.dataPath, bytes, { mode: 0o600, flag: 'wx' });
    const before = await fs.readFile(f.dataPath);
    await assert.rejects(f.open());
    assert.deepEqual(await fs.readFile(f.dataPath), before);
    assert.deepEqual(await fs.readdir(f.directory), [CANONICAL_MEMORY_FILE]);
  }
  const f = await fixture(t);
  const store = await f.open();
  await store.initialize(memory());
  await fs.writeFile(f.dataPath, '{corrupt');
  await assert.rejects(store.initialize(memory()), code('CORRUPT'));
  await assert.rejects(store.commit(memory(1), { expectedRevision: 0 }), code('CORRUPT'));
  assert.equal(await fs.readFile(f.dataPath, 'utf8'), '{corrupt');
  await store.close();
});

test('lock content/identity interference fails closed and close never unlinks a replacement lock', async (t) => {
  for (const replacement of [false, true]) {
    const f = await fixture(t);
    const store = await f.open();
    await store.initialize(memory());
    if (replacement) await fs.rename(f.lockPath, path.join(f.directory, 'retained-original-lock'));
    await fs.writeFile(f.lockPath, 'foreign-owner', { mode: 0o600 });
    await assert.rejects(store.read(), code('LOCK_LOST'));
    await assert.rejects(store.commit(memory(1), { expectedRevision: 0 }), code('LOCK_LOST'));
    await assert.rejects(store.close(), code('LOCK_LOST'));
    assert.equal(await fs.readFile(f.lockPath, 'utf8'), 'foreign-owner');
    assert.deepEqual(decodeAppServerMemory(await fs.readFile(f.dataPath, 'utf8'), agentId), decoded(memory()));
  }
});

test('temp write and file-sync failures preserve old bytes, clean only owned temp and allow safe retry', async (t) => {
  for (const phase of ['temp-writeFile', 'temp-sync']) {
    const control = {};
    const f = await fixture(t, faultIO(control));
    const store = await f.open();
    await store.initialize(memory());
    const before = await fs.readFile(f.dataPath);
    control.fail = phase;
    await assert.rejects(store.commit(memory(1), { expectedRevision: 0 }), code('IO'));
    assert.deepEqual(await fs.readFile(f.dataPath), before);
    assert.deepEqual((await fs.readdir(f.directory)).sort(), [CANONICAL_MEMORY_FILE, CANONICAL_MEMORY_LOCK].sort());
    control.fail = null;
    await store.commit(memory(1), { expectedRevision: 0 });
    await store.close();
  }
});

test('rename uncertainty and directory-sync failure poison writes; read/reopen reconcile actual outcome', async (t) => {
  for (const phase of ['rename-before', 'rename-after', 'directory-sync']) {
    const control = {};
    const f = await fixture(t, faultIO(control));
    const store = await f.open();
    await store.initialize(memory());
    control.fail = phase;
    await assert.rejects(store.commit(memory(1), { expectedRevision: 0 }), code('UNKNOWN_OUTCOME'));
    const actualRevision = phase === 'rename-before' ? 0 : 1;
    assert.equal((await store.read()).revision, actualRevision);
    control.fail = null;
    await assert.rejects(store.commit(memory(actualRevision + 1), { expectedRevision: actualRevision }), code('POISONED'));
    await store.close();
    const reopened = await f.open();
    assert.equal((await reopened.read()).revision, actualRevision);
    await reopened.commit(memory(actualRevision + 1), { expectedRevision: actualRevision });
    await reopened.close();
  }
});

test('initialization races never overwrite; post-publication unlink failure retains a readable proven alias', async (t) => {
  const control = {};
  const f = await fixture(t, faultIO(control));
  const store = await f.open();
  const existing = memory(); existing.extension = { raced: true };
  control.beforeLink = (target) => fs.writeFile(target, encodeAppServerMemory(existing), { flag: 'wx', mode: 0o600 });
  await assert.rejects(store.initialize(memory()), code('EXISTS'));
  assert.deepEqual(await store.read(), decoded(existing));
  await store.close();
  const failed = { fail: 'init-unlink' };
  const g = await fixture(t, faultIO(failed));
  const owner = await g.open();
  await assert.rejects(owner.initialize(memory()), code('UNKNOWN_OUTCOME'));
  assert.equal((await fs.stat(g.dataPath)).nlink, 2);
  assert.deepEqual(await owner.read(), decoded(memory()));
  await assert.rejects(owner.initialize(memory()), code('POISONED'));
  await owner.close();
  const reopened = await g.open();
  assert.deepEqual(await reopened.read(), decoded(memory()));
  await reopened.commit(memory(1), { expectedRevision: 0 });
  await reopened.close();
  assert.ok((await fs.readdir(g.directory)).includes('.canonical-memory-initialize.tmp'));
});

test('observed syscall order syncs complete temp before publication and directory before success', async (t) => {
  const control = { events: [] };
  const f = await fixture(t, faultIO(control));
  const store = await f.open();
  control.events.length = 0;
  await store.initialize(memory());
  assert.deepEqual(control.events, ['temp-writeFile', 'temp-sync', 'link', 'directory-sync']);
  control.events.length = 0;
  await store.commit(memory(1), { expectedRevision: 0 });
  assert.deepEqual(control.events, ['temp-writeFile', 'temp-sync', 'rename', 'directory-sync']);
  await store.close();
});
