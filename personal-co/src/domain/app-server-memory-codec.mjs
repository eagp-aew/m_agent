import { ALL_MEMORY_LABELS, POLICY_MEMORY_LABELS } from './memory.mjs';

export const APP_SERVER_MEMORY_SCHEMA = 'personal-co-app-server-memory';
export const APP_SERVER_MEMORY_VERSION = 1;

function invalid() {
  // Never attach input values, keys, parser messages, or exception causes.
  throw new Error('Invalid app-server memory data.');
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

// Copy data descriptors without invoking getters or toJSON. JSON has no object
// identity, so shared (noncyclic) references become independent JSON values.
function copyJson(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0)) invalid();
    return value;
  }
  if (typeof value !== 'object' || ancestors.has(value)) invalid();
  const array = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (array && keys.length !== value.length + 1) invalid();
  const copy = array ? [] : {};
  ancestors.add(value);
  for (const key of keys) {
    if (array && key === 'length') continue;
    const descriptor = descriptors[key];
    if (typeof key !== 'string' || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')) invalid();
    if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) invalid();
    Object.defineProperty(copy, key, {
      value: copyJson(descriptor.value, ancestors), enumerable: true, writable: true, configurable: true,
    });
  }
  ancestors.delete(value);
  return Object.freeze(copy);
}

function validateEnvelope(envelope) {
  if (!isRecord(envelope)
      || envelope.schema !== APP_SERVER_MEMORY_SCHEMA
      || envelope.version !== APP_SERVER_MEMORY_VERSION
      || !isId(envelope.agentId) || !isCount(envelope.revision)
      || !Array.isArray(envelope.blocks) || envelope.blocks.length !== ALL_MEMORY_LABELS.length
      || !Array.isArray(envelope.archive)) invalid();

  const labels = new Set();
  const blockIds = new Set();
  for (const block of envelope.blocks) {
    if (!isRecord(block) || !isId(block.id) || blockIds.has(block.id)
        || !ALL_MEMORY_LABELS.includes(block.label) || labels.has(block.label)
        || typeof block.value !== 'string') invalid();
    const camel = Object.hasOwn(block, 'readOnly');
    const snake = Object.hasOwn(block, 'read_only');
    const protectedBlock = POLICY_MEMORY_LABELS.includes(block.label);
    if ((!camel && !snake) || (camel && block.readOnly !== protectedBlock)
        || (snake && block.read_only !== protectedBlock)) invalid();
    if (Object.hasOwn(block, 'limit') && block.limit !== null && !isCount(block.limit)) invalid();
    blockIds.add(block.id);
    labels.add(block.label);
  }

  const archiveIds = new Set();
  for (const item of envelope.archive) {
    if (!isRecord(item) || !isId(item.id) || archiveIds.has(item.id)
        || typeof item.text !== 'string' || !Array.isArray(item.tags)
        || item.tags.some((tag) => typeof tag !== 'string')) invalid();
    for (const field of ['createdAt', 'updatedAt']) {
      if (Object.hasOwn(item, field) && item[field] !== null
          && (typeof item[field] !== 'string' || !Number.isFinite(Date.parse(item[field])))) invalid();
    }
    archiveIds.add(item.id);
  }
}

function parseJson(text) {
  if (typeof text !== 'string') invalid();
  const parsed = JSON.parse(text);
  // JSON.parse silently overwrites duplicate object keys. Check the tokens of
  // the already syntax-validated document, including escaped key spellings.
  const stack = [];
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g;
  for (const [token] of text.matchAll(tokens)) {
    const frame = stack.at(-1);
    if (token === '{') stack.push({ keys: new Set(), nextKey: true });
    else if (token === '[') stack.push({ keys: null });
    else if (token === '}' || token === ']') stack.pop();
    else if (token === ',' && frame?.keys) frame.nextKey = true;
    else if (token === ':' && frame?.keys) frame.nextKey = false;
    else if (token.startsWith('"') && frame?.keys && frame.nextKey) {
      const key = JSON.parse(token);
      if (frame.keys.has(key)) invalid();
      frame.keys.add(key);
    }
  }
  return parsed;
}

/**
 * Serialize { agentId, revision, blocks, archive, ...extensions } as versioned
 * internal data. Existing schema/version fields must match; all own JSON data
 * fields and array order survive. This is not a share-safe export, a migration,
 * a writer authorization check, or an atomic persistence operation.
 */
export function encodeAppServerMemory(memory) {
  try {
    const copy = copyJson(memory);
    if (!isRecord(copy)) invalid();
    const envelope = { ...copy };
    if (!Object.hasOwn(envelope, 'schema')) envelope.schema = APP_SERVER_MEMORY_SCHEMA;
    if (!Object.hasOwn(envelope, 'version')) envelope.version = APP_SERVER_MEMORY_VERSION;
    validateEnvelope(envelope);
    return JSON.stringify(envelope);
  } catch {
    invalid();
  }
}

/** Parse only for the exact expected Agent; return independent frozen data. */
export function decodeAppServerMemory(text, expectedAgentId) {
  try {
    if (!isId(expectedAgentId)) invalid();
    const envelope = copyJson(parseJson(text));
    validateEnvelope(envelope);
    if (envelope.agentId !== expectedAgentId) invalid();
    return envelope;
  } catch {
    invalid();
  }
}
