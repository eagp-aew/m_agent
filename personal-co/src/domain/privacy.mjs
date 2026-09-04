import { POLICY_MEMORY_LABELS, WRITABLE_MEMORY_LABELS } from './memory.mjs';

export const SUPPORTED_LANGUAGES = Object.freeze(['English', '简体中文']);

export const NO_MEMORY_SYSTEM_MESSAGE = `PERSONAL CO PRIVACY MODE
Do not call any tool that writes, edits, clears, or deletes core or archival memory for this message. Answer the user without retaining this message. The application will verify the memory state after the run.`;

export function parseDoNotRememberTerms(value) {
  return [...new Set(
    String(value ?? '')
      .split(/[\n,]/)
      .map((term) => term.trim())
      .filter(Boolean),
  )];
}

export function createPrivacySettings({
  language = 'English',
  doNotRememberTerms = [],
  temporarySession = false,
} = {}) {
  return {
    language: SUPPORTED_LANGUAGES.includes(language) ? language : 'English',
    doNotRememberTerms: parseDoNotRememberTerms(
      Array.isArray(doNotRememberTerms) ? doNotRememberTerms.join('\n') : doNotRememberTerms,
    ),
    temporarySession: temporarySession === true,
  };
}

export function privacyDecisionForMessage(content, privacy) {
  const settings = createPrivacySettings(privacy);
  const matchingTerms = settings.doNotRememberTerms.filter((term) => String(content).includes(term));
  const requestNoMemoryWrites = settings.temporarySession || matchingTerms.length > 0;
  return {
    requestNoMemoryWrites,
    reason: settings.temporarySession
      ? 'temporary_session'
      : matchingTerms.length
        ? 'do_not_remember_term'
        : 'normal',
    matchingTerms,
  };
}

export function messageEnvelope(content, requestNoMemoryWrites, language = 'English') {
  const userMessage = { role: 'user', content };
  const systemMessages = [];
  if (language === '简体中文') {
    systemMessages.push({ role: 'system', content: 'Respond to this message in Simplified Chinese unless the user explicitly asks for another language.' });
  }
  if (requestNoMemoryWrites) systemMessages.push({ role: 'system', content: NO_MEMORY_SYSTEM_MESSAGE });
  return [...systemMessages, userMessage];
}

function archiveChanged(before, after) {
  return before.text !== after.text
    || JSON.stringify([...(before.tags ?? [])].sort()) !== JSON.stringify([...(after.tags ?? [])].sort());
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableObject(item)]),
  );
}

export function diffAgentMemory(before, after) {
  const beforeBlocks = new Map(before.blocks.map((block) => [block.label, block]));
  const changedBlocks = after.blocks
    .filter((block) => beforeBlocks.has(block.label))
    .filter((block) => {
      const previous = beforeBlocks.get(block.label);
      return previous.value !== block.value
        || JSON.stringify(stableObject(previous.metadata ?? null)) !== JSON.stringify(stableObject(block.metadata ?? null));
    })
    .map((block) => ({ before: beforeBlocks.get(block.label), after: block }));
  const beforeArchive = new Map(before.archive.map((item) => [item.id, item]));
  const afterArchive = new Map(after.archive.map((item) => [item.id, item]));
  return {
    changedBlocks,
    addedArchive: after.archive.filter((item) => !beforeArchive.has(item.id)),
    removedArchive: before.archive.filter((item) => !afterArchive.has(item.id)),
    changedArchive: after.archive
      .filter((item) => beforeArchive.has(item.id) && archiveChanged(beforeArchive.get(item.id), item))
      .map((item) => ({ before: beforeArchive.get(item.id), after: item })),
  };
}

export function planTemporaryReconciliation(before, after) {
  const diff = diffAgentMemory(before, after);
  return {
    blockRestores: diff.changedBlocks
      .filter(({ before: block }) => WRITABLE_MEMORY_LABELS.includes(block.label))
      .map(({ before: block }) => block),
    archiveDeletes: diff.addedArchive,
    violations: [
      ...diff.changedBlocks
        .filter(({ before: block }) => POLICY_MEMORY_LABELS.includes(block.label))
        .map(({ before: block }) => `Read-only policy block changed: ${block.label}`),
      ...diff.removedArchive.map((item) => `Archive passage was removed: ${item.id}`),
      ...diff.changedArchive.map(({ before: item }) => `Archive passage was modified: ${item.id}`),
    ],
  };
}
