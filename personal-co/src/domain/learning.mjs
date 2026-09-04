export const LEARNING_STATES = Object.freeze([
  'exposed',
  'developing',
  'usable',
  'needs_review',
]);
export const EVIDENCE_KINDS = Object.freeze([
  'read_only',
  'practice',
  'application',
  'transfer',
  'contradiction',
]);

export function deriveLearningState(evidence) {
  if (evidence.some((item) => item.kind === 'contradiction')) return 'needs_review';
  if (evidence.some((item) => item.kind === 'application' || item.kind === 'transfer')) return 'usable';
  if (evidence.some((item) => item.kind === 'practice')) return 'developing';
  return 'exposed';
}

export function requestLearningTransition(current, requested, evidence) {
  const supported = deriveLearningState(evidence);
  if (!LEARNING_STATES.includes(current) || !LEARNING_STATES.includes(requested)) {
    return { allowed: false, state: current, reason: 'Unknown learning state.' };
  }
  if (requested === 'needs_review') {
    return supported === 'needs_review'
      ? { allowed: true, state: requested, reason: 'Contradictory evidence requires review.' }
      : { allowed: false, state: current, reason: 'No review-triggering evidence was provided.' };
  }
  const rank = { exposed: 0, developing: 1, usable: 2 };
  if (supported === 'needs_review' || rank[requested] > rank[supported]) {
    return {
      allowed: false,
      state: current,
      reason: 'The requested state is not supported by application or transfer evidence.',
    };
  }
  return { allowed: true, state: requested, reason: 'Evidence supports this transition.' };
}
