import { routeUncertainInformation } from './policy.mjs';

export function createImportCandidates(text, sourceName = 'pasted text') {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((content, index) => ({
      id: `import-${index + 1}`,
      content,
      sourceName,
      sourceType: 'external_import',
      tags: ['external_import'],
      epistemicState: 'observed',
      destination: 'archive',
      confirmedForStableMemory: false,
    }));
}

export function authorizeImportDestination(candidate, destination, confirmed = false) {
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
