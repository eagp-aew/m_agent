import { normalizeEpistemicState, routeUncertainInformation } from './policy.mjs';

const RESERVED_TAG_PREFIXES = ['type:', 'source:', 'epistemic:', 'date:', 'provenance:'];

function normalizeTagValue(value, fallback) {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || fallback;
}

export function normalizeArchiveTags({
  category = 'archive',
  source = 'agent',
  epistemicState = 'hypothesis',
  date = new Date().toISOString().slice(0, 10),
  provenance,
  extraTags = [],
} = {}) {
  const normalized = [
    `type:${normalizeTagValue(category, 'archive')}`,
    `source:${normalizeTagValue(source, 'unknown')}`,
    `epistemic:${normalizeEpistemicState(epistemicState)}`,
    `date:${/^\d{4}-\d{2}-\d{2}$/.test(date) ? date : 'unknown'}`,
  ];
  if (provenance) normalized.push(`provenance:${normalizeTagValue(provenance, 'unknown')}`);
  for (const tag of extraTags) {
    if (typeof tag === 'string' && tag.trim() && !RESERVED_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix))) {
      normalized.push(tag.trim());
    }
  }
  return [...new Set(normalized)];
}

export function parseArchiveTags(tags = [], createdAt) {
  const find = (prefix, fallback) => {
    const tag = tags.find((item) => typeof item === 'string' && item.startsWith(prefix));
    return tag ? tag.slice(prefix.length).replaceAll('_', ' ') : fallback;
  };
  return {
    category: find('type:', 'archive'),
    source: find('source:', 'agent'),
    epistemicState: normalizeEpistemicState(find('epistemic:', 'hypothesis')),
    date: find('date:', createdAt ? String(createdAt).slice(0, 10) : 'unknown'),
    provenance: find('provenance:', 'original'),
  };
}

export function createImportCandidates(text, sourceName = 'pasted text', now = new Date().toISOString()) {
  const selectedSource = String(sourceName ?? '').trim() || 'pasted text';
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((content, index) => ({
      id: `import-${index + 1}`,
      content,
      sourceName: selectedSource,
      sourceType: 'external_import',
      tags: ['external_import'],
      normalizedTags: normalizeArchiveTags({
        category: 'external_import',
        source: selectedSource,
        epistemicState: 'observed',
        date: now.slice(0, 10),
        extraTags: ['external_import'],
      }),
      epistemicState: 'observed',
      destination: 'archive',
      confirmedForStableMemory: false,
    }));
}

export function authorizeImportDestination(candidate, destination, confirmed = false) {
  if (destination === 'PERSONA' || destination === 'MEMORY_POLICY' || destination === 'external_action') {
    return {
      allowed: false,
      destination: 'archive',
      reason: 'Imported content cannot modify policy blocks or trigger external actions.',
    };
  }
  if (destination === 'PROFILE' || destination === 'GOALS_AND_DECISIONS') {
    return confirmed
      ? { allowed: true, destination, reason: 'User explicitly confirmed promotion.' }
      : {
          allowed: false,
          destination: 'archive',
          reason: 'External imports cannot change stable memory without confirmation.',
        };
  }
  return routeUncertainInformation({
    state: candidate.epistemicState,
    destination: destination === 'archive' ? 'archive' : destination,
  });
}
