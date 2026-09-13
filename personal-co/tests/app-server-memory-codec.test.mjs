import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryBlocks } from '../src/domain/memory.mjs';
import {
  APP_SERVER_MEMORY_SCHEMA, APP_SERVER_MEMORY_VERSION,
  encodeAppServerMemory, decodeAppServerMemory,
} from '../src/domain/app-server-memory-codec.mjs';

function memory() {
  return {
    agentId: ' agent-原文 ', revision: 0,
    blocks: createMemoryBlocks('人格\n🙂', 'Policy\nexact').map((block, index) => ({
      id: ` block-${index} `, ...block,
      metadata: { nested: [null, true, 2.5, { text: '  中文\n\r\t🙂  ' }], token: 'synthetic-preserved' },
    })).reverse(),
    archive: [
      { id: 'archive-z', text: '  同一内容\n🙂  ', tags: ['z', 'a', 'z', '', ' 中文 '],
        createdAt: '2026-09-12T10:30:00.123+08:00', updatedAt: null,
        provenance: { originalId: 'source-1', tags: ['b', 'a'] }, metadata: null },
      { id: 'archive-a', text: '  同一内容\n🙂  ', tags: ['a', 'z'],
        updatedAt: '2026-09-12T03:00:00Z', extra: [1, { retained: false }] },
    ],
    extension: { order: ['z', 'a'], constructor: 'ordinary-data' },
  };
}

function envelope(candidate) {
  const result = { ...candidate };
  if (!Object.hasOwn(result, 'schema')) result.schema = APP_SERVER_MEMORY_SCHEMA;
  if (!Object.hasOwn(result, 'version')) result.version = APP_SERVER_MEMORY_VERSION;
  return result;
}

function rejectBoth(mutate) {
  const candidate = memory();
  mutate(candidate);
  assert.throws(() => encodeAppServerMemory(candidate), /^Error: Invalid app-server memory data\.$/);
  assert.throws(() => decodeAppServerMemory(JSON.stringify(envelope(candidate)), candidate.agentId),
    /^Error: Invalid app-server memory data\.$/);
}

test('versioned roundtrip preserves every field, whitespace, order, duplicates and metadata', () => {
  const source = memory();
  source.blocks[0].limit = null;
  source.blocks[1].metadata = null;
  delete source.blocks[2].limit;
  source.blocks[3].limit = 0;
  source.blocks[4].limit = Number.MAX_SAFE_INTEGER;
  source.blocks[5].metadata = JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":"data"},"toJSON":"data"}');
  const text = encodeAppServerMemory(source);
  const decoded = decodeAppServerMemory(text, source.agentId);
  assert.deepEqual(decoded, envelope(source));
  assert.equal(text, JSON.stringify(envelope(source)));
  assert.equal(encodeAppServerMemory(decoded), text);
  assert.equal(Object.hasOwn(decoded.blocks[5].metadata, '__proto__'), true);
  assert.equal(decoded.blocks[5].metadata.__proto__.polluted, true);
  assert.equal({}.polluted, undefined);
});

test('accepts camel, snake, mixed and equal dual readonly aliases without normalization', () => {
  for (const mode of ['camel', 'snake', 'mixed', 'dual']) {
    const source = memory();
    for (const [index, block] of source.blocks.entries()) {
      if (mode === 'snake' || mode === 'dual' || (mode === 'mixed' && index % 2)) {
        block.read_only = block.readOnly;
        if (mode !== 'dual') delete block.readOnly;
      }
    }
    assert.deepEqual(decodeAppServerMemory(encodeAppServerMemory(source), source.agentId), envelope(source));
  }
});

test('empty Archive, empty text, null timestamps and absent optional fields are lossless', () => {
  const source = memory();
  source.archive = [];
  source.blocks[0].value = '';
  assert.deepEqual(decodeAppServerMemory(encodeAppServerMemory(source), source.agentId), envelope(source));
  source.archive = [{ id: 'a', text: '', tags: [], createdAt: null, updatedAt: null }];
  assert.deepEqual(decodeAppServerMemory(encodeAppServerMemory(source), source.agentId), envelope(source));
});

test('decode requires an exact explicit nonblank Agent and valid versioned JSON envelope', () => {
  const source = memory();
  const text = encodeAppServerMemory(source);
  for (const expected of [undefined, null, '', ' ', 1, source.agentId.trim(), 'other-agent']) {
    assert.throws(() => decodeAppServerMemory(text, expected));
  }
  for (const invalid of [null, undefined, {}, [], 1, '', '{', 'null', '[]', '{}']) {
    assert.throws(() => decodeAppServerMemory(invalid, source.agentId));
  }
  for (const field of ['schema', 'version', 'agentId', 'revision', 'blocks', 'archive']) {
    const candidate = envelope(source);
    delete candidate[field];
    assert.throws(() => decodeAppServerMemory(JSON.stringify(candidate), source.agentId));
  }
  rejectBoth((m) => { m.schema = 'unknown'; });
  rejectBoth((m) => { m.version = 2; });
});

test('rejects invalid identity, revision, collections, labels, IDs, values, flags and limits', () => {
  const mutations = [
    ...['', ' ', null, 1].map((id) => (m) => { m.agentId = id; }),
    ...[-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '1', null].map((n) => (m) => { m.revision = n; }),
    (m) => { delete m.revision; }, (m) => { m.blocks = {}; }, (m) => { m.archive = {}; },
    (m) => { m.blocks.pop(); }, (m) => { m.blocks.push({ ...m.blocks[0], id: 'extra' }); },
    (m) => { m.blocks[0] = null; }, (m) => { m.blocks[0].label = 'EXTRA'; },
    (m) => { m.blocks[0].label = m.blocks[1].label; },
    (m) => { m.blocks[0].id = m.blocks[1].id; },
    ...['', ' ', 2, null].map((id) => (m) => { m.blocks[0].id = id; }),
    (m) => { delete m.blocks[0].id; },
    ...[null, 1, {}].map((v) => (m) => { m.blocks[0].value = v; }),
    (m) => { delete m.blocks[0].value; },
    (m) => { delete m.blocks[0].readOnly; },
    (m) => { m.blocks[0].readOnly = false; },
    (m) => { m.blocks[5].readOnly = true; },
    (m) => { m.blocks[0].read_only = false; },
    (m) => { m.blocks[5].read_only = true; },
    (m) => { m.blocks[0].readOnly = 'true'; },
    ...[-1, 1.5, '8000', {}, Number.MAX_SAFE_INTEGER + 1].map((n) => (m) => { m.blocks[0].limit = n; }),
  ];
  for (const mutate of mutations) rejectBoth(mutate);
});

test('rejects malformed Archive identity, text, tags and timestamps without rewriting dates', () => {
  const mutations = [
    (m) => { m.archive[0] = null; }, (m) => { m.archive[0].id = m.archive[1].id; },
    ...['', ' ', 1, null].map((v) => (m) => { m.archive[0].id = v; }),
    ...[null, {}, 1].map((v) => (m) => { m.archive[0].text = v; }),
    ...[null, 'tag', {}, [1], ['ok', null]].map((v) => (m) => { m.archive[0].tags = v; }),
    ...['id', 'text', 'tags'].map((key) => (m) => { delete m.archive[0][key]; }),
  ];
  for (const field of ['createdAt', 'updatedAt']) {
    for (const value of ['', 'invalid-date', 1, true, {}]) {
      mutations.push((m) => { m.archive[0][field] = value; });
    }
  }
  for (const mutate of mutations) rejectBoth(mutate);
  const source = memory();
  source.archive[0].createdAt = 'Sat, 12 Sep 2026 12:34:56 GMT';
  assert.equal(decodeAppServerMemory(encodeAppServerMemory(source), source.agentId).archive[0].createdAt,
    source.archive[0].createdAt);
});

test('rejects lossy JavaScript data anywhere, including array properties and hidden fields', () => {
  const cycle = {}; cycle.self = cycle;
  const sparse = []; sparse.length = 1;
  const extraArray = [1]; extraArray.extra = 'lost';
  const hidden = Object.defineProperty({}, 'hidden', { value: 'lost' });
  const symbolKey = { [Symbol('hidden')]: 'lost' };
  const nonplain = Object.create({ inherited: true });
  const unsupported = [undefined, NaN, Infinity, -Infinity, -0, 1n, () => {}, Symbol('value'),
    new Date(), new Map(), new Set(), /regex/, new Number(1), new String('a'),
    cycle, sparse, extraArray, hidden, symbolKey, nonplain];
  for (const value of unsupported) {
    for (const place of ['root', 'block', 'archive', 'array']) {
      const source = memory();
      if (place === 'root') source.extension = value;
      if (place === 'block') source.blocks[0].metadata = value;
      if (place === 'archive') source.archive[0].provenance = value;
      if (place === 'array') source.archive[0].extra = [value];
      assert.throws(() => encodeAppServerMemory(source));
    }
  }
  for (const source of [undefined, null, [], 'text', 1]) assert.throws(() => encodeAppServerMemory(source));
});

test('accessors and toJSON functions are never executed and exceptions reveal no content', () => {
  let calls = 0;
  const secret = 'PRIVATE-SYNTHETIC-CONTENT';
  for (const target of ['root', 'block', 'archive', 'nested', 'array']) {
    const source = memory();
    source.extension = { nested: {}, array: [0] };
    const object = target === 'root' ? source : target === 'block' ? source.blocks[0]
      : target === 'archive' ? source.archive[0] : source.extension[target];
    Object.defineProperty(object, target === 'array' ? '0' : secret, {
      enumerable: true, get() { calls++; throw new Error(secret); },
    });
    assert.throws(() => encodeAppServerMemory(source), (error) => {
      assert.equal(error.message, 'Invalid app-server memory data.');
      assert.equal(error.cause, undefined);
      return true;
    });
  }
  const source = memory();
  source.toJSON = () => { calls++; return {}; };
  assert.throws(() => encodeAppServerMemory(source));
  assert.equal(calls, 0);
  assert.throws(() => decodeAppServerMemory(`{"${secret}":`, source.agentId),
    /^Error: Invalid app-server memory data\.$/);
});

test('rejects duplicate JSON keys, nonfinite parsed numbers and negative zero', () => {
  const source = memory();
  const text = encodeAppServerMemory(source);
  for (const field of ['"revision":1,"revision":2', '"revision":1,"revis\\u0069on":2',
    '"extra":{"a":1,"a":2}', '"extra":1e999', '"extra":-0']) {
    const candidate = text.replace('"revision":0', `"revision":0,${field}`);
    assert.throws(() => decodeAppServerMemory(candidate, source.agentId));
  }
});

test('decoded data is recursively frozen and independent from callers and other decodes', () => {
  const source = memory();
  const text = encodeAppServerMemory(source);
  const decoded = decodeAppServerMemory(text, source.agentId);
  const second = decodeAppServerMemory(text, source.agentId);
  function assertFrozen(value) {
    if (value !== null && typeof value === 'object') {
      assert.ok(Object.isFrozen(value));
      for (const item of Object.values(value)) assertFrozen(item);
    }
  }
  assertFrozen(decoded);
  assert.notEqual(decoded.blocks[0], source.blocks[0]);
  assert.notEqual(decoded.archive[0].tags, second.archive[0].tags);
  assert.throws(() => { decoded.blocks[0].value = 'changed'; }, TypeError);
  assert.throws(() => { decoded.archive[0].tags.push('changed'); }, TypeError);
  source.blocks[0].metadata.nested[3].text = 'changed';
  source.archive[0].tags.reverse();
  assert.equal(encodeAppServerMemory(decoded), text);
  assert.equal(Object.isFrozen(source.blocks[0]), false);
});
