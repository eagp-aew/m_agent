import {
  ALL_MEMORY_LABELS,
  POLICY_MEMORY_LABELS,
  WRITABLE_MEMORY_LABELS,
  validateMemorySchema,
} from './memory.mjs';
import { normalizeArchiveTags, parseArchiveTags } from './imports.mjs';

export const SNAPSHOT_SCHEMA = 'personal-co-portable-snapshot';
export const SNAPSHOT_VERSION = 1;
const SECRET_KEY = /(api[_-]?key|authorization|cookie|credential|password|secret|token)/i;

export function stripSecretLikeFields(value) {
  if (Array.isArray(value)) return value.map(stripSecretLikeFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, item]) => [key, stripSecretLikeFields(item)]),
  );
}

function snapshotBlock(block) {
  return {
    label: block.label,
    value: String(block.value ?? ''),
    readOnly: block.readOnly === true || block.read_only === true,
    metadata: stripSecretLikeFields(block.metadata ?? {}),
  };
}

function snapshotArchive(item) {
  return {
    id: String(item.id ?? ''),
    text: String(item.text ?? ''),
    tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === 'string') : [],
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : null,
  };
}

function secretFreeBaseUrl(value) {
  const raw = String(value ?? '');
  try {
    const parsed = new URL(raw);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/\/[^/@\s]+@/, '//').split(/[?#]/, 1)[0].replace(/\/$/, '');
  }
}

export function createPortableSnapshot({ agentId, settings, blocks, archive, exportedAt = new Date().toISOString() }) {
  if (!agentId) throw new Error('A connected agent ID is required for export.');
  const safeBlocks = blocks.map(snapshotBlock);
  if (!validateMemorySchema(safeBlocks).valid) {
    throw new Error('Export requires the exact six-block Personal Co memory schema.');
  }
  return {
    schema: SNAPSHOT_SCHEMA,
    version: SNAPSHOT_VERSION,
    agentId,
    exportedAt,
    settings: stripSecretLikeFields({
      baseUrl: secretFreeBaseUrl(settings?.baseUrl),
      modelHandle: settings?.modelHandle ?? '',
      embeddingHandle: settings?.embeddingHandle ?? '',
      language: settings?.language ?? 'English',
      doNotRememberTerms: settings?.doNotRememberTerms ?? [],
    }),
    blocks: safeBlocks,
    archive: archive.map(snapshotArchive),
  };
}

export function validatePortableSnapshot(candidate, connectedAgentId) {
  const errors = [];
  if (!candidate || typeof candidate !== 'object') return { valid: false, errors: ['Snapshot must be a JSON object.'] };
  if (candidate.schema !== SNAPSHOT_SCHEMA) errors.push('Unknown snapshot schema.');
  if (candidate.version !== SNAPSHOT_VERSION) errors.push('Unsupported snapshot version.');
  if (!candidate.agentId || candidate.agentId !== connectedAgentId) errors.push('Snapshot agent ID does not match the connected agent.');
  if (typeof candidate.exportedAt !== 'string' || Number.isNaN(Date.parse(candidate.exportedAt))) errors.push('Snapshot export timestamp is invalid.');
  if (!candidate.settings || typeof candidate.settings !== 'object' || Array.isArray(candidate.settings)) errors.push('Snapshot settings must be an object.');
  if (!Array.isArray(candidate.blocks)) errors.push('Snapshot blocks must be an array.');
  else {
    const schema = validateMemorySchema(candidate.blocks.map((block) => ({
      label: block?.label,
      readOnly: block?.readOnly === true,
    })));
    if (!schema.valid) errors.push('Snapshot must contain the exact four writable and two read-only blocks.');
    if (candidate.blocks.some((block) => typeof block?.value !== 'string')) errors.push('Every snapshot block needs a string value.');
  }
  if (!Array.isArray(candidate.archive)) errors.push('Snapshot archive must be an array.');
  else if (candidate.archive.some((item) => !item || typeof item.id !== 'string' || typeof item.text !== 'string' || !Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string'))) {
    errors.push('Every archive record needs text and tags.');
  }
  return { valid: errors.length === 0, errors };
}

export function archiveFingerprint(item) {
  const tags = [...new Set((item.tags ?? []).filter((tag) => !String(tag).startsWith('provenance:')))].sort();
  return JSON.stringify([String(item.text ?? ''), tags]);
}

export function createRestorePreview(snapshot, current) {
  const validation = validatePortableSnapshot(snapshot, current.agentId);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  const currentBlocks = new Map(current.blocks.map((block) => [block.label, block]));
  const blockChanges = snapshot.blocks
    .filter((block) => WRITABLE_MEMORY_LABELS.includes(block.label))
    .filter((block) => currentBlocks.get(block.label)?.value !== block.value)
    .map((block) => ({ before: currentBlocks.get(block.label), after: snapshotBlock(block) }));
  const fingerprints = new Set(current.archive.map(archiveFingerprint));
  const archiveAdds = [];
  for (const item of snapshot.archive) {
    const fingerprint = archiveFingerprint(item);
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    const metadata = parseArchiveTags(item.tags, item.createdAt);
    archiveAdds.push({
      ...snapshotArchive(item),
      tags: normalizeArchiveTags({
        category: metadata.category,
        source: metadata.source,
        epistemicState: metadata.epistemicState,
        date: metadata.date,
        provenance: 'restore',
        extraTags: item.tags,
      }),
    });
  }
  return {
    agentId: snapshot.agentId,
    blockChanges,
    archiveAdds,
    policyBlocksUnchanged: snapshot.blocks
      .filter((block) => POLICY_MEMORY_LABELS.includes(block.label))
      .map((block) => block.label),
    confirmationPhrase: `RESTORE ${snapshot.agentId}`,
  };
}

export function authorizeSnapshotRestore(preview, confirmation, currentAgentId) {
  return Boolean(
    preview?.agentId
    && preview.agentId === currentAgentId
    && confirmation === `RESTORE ${preview.agentId}`,
  );
}

export function assertCompleteSnapshotLabels(snapshot) {
  return ALL_MEMORY_LABELS.every((label) => snapshot.blocks.some((block) => block.label === label));
}
