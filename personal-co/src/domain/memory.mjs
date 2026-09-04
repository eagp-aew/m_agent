export const WRITABLE_MEMORY_LABELS = Object.freeze([
  'PROFILE',
  'CURRENT_CONTEXT',
  'GOALS_AND_DECISIONS',
  'LEARNING_MODEL',
]);

export const POLICY_MEMORY_LABELS = Object.freeze([
  'PERSONA',
  'MEMORY_POLICY',
]);

export const ALL_MEMORY_LABELS = Object.freeze([
  ...WRITABLE_MEMORY_LABELS,
  ...POLICY_MEMORY_LABELS,
]);

const INITIAL_VALUES = Object.freeze({
  PROFILE: 'No confirmed profile facts yet.',
  CURRENT_CONTEXT: 'No active context recorded yet.',
  GOALS_AND_DECISIONS: 'No confirmed goals or decisions yet.',
  LEARNING_MODEL: 'No learning evidence recorded yet.',
});

export function createMemoryBlocks(persona, memoryPolicy) {
  return ALL_MEMORY_LABELS.map((label) => ({
    label,
    value:
      label === 'PERSONA'
        ? persona
        : label === 'MEMORY_POLICY'
          ? memoryPolicy
          : INITIAL_VALUES[label],
    readOnly: POLICY_MEMORY_LABELS.includes(label),
    limit: label === 'CURRENT_CONTEXT' ? 5000 : 8000,
  }));
}

export function validateMemorySchema(blocks) {
  const labels = blocks.map((block) => block.label);
  const unique = new Set(labels);
  const exactLabels =
    labels.length === ALL_MEMORY_LABELS.length &&
    unique.size === ALL_MEMORY_LABELS.length &&
    ALL_MEMORY_LABELS.every((label) => unique.has(label));
  const policyReadOnly = blocks
    .filter((block) => POLICY_MEMORY_LABELS.includes(block.label))
    .every((block) => block.readOnly === true);
  const userWritable = blocks
    .filter((block) => WRITABLE_MEMORY_LABELS.includes(block.label))
    .every((block) => block.readOnly === false);

  return { valid: exactLabels && policyReadOnly && userWritable, exactLabels, policyReadOnly, userWritable };
}

export function authorizeMemoryUpdate(label, confirmed) {
  if (!ALL_MEMORY_LABELS.includes(label)) {
    return { allowed: false, reason: 'Dynamic memory categories are not allowed.' };
  }
  if (POLICY_MEMORY_LABELS.includes(label)) {
    return { allowed: false, reason: `${label} is a read-only policy block.` };
  }
  if ((label === 'PROFILE' || label === 'GOALS_AND_DECISIONS') && !confirmed) {
    return { allowed: false, reason: `${label} requires explicit confirmation.` };
  }
  return { allowed: true, reason: 'Update is allowed by the memory policy.' };
}
