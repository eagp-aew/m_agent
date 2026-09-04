import {
  POLICY_MEMORY_LABELS,
  WRITABLE_MEMORY_LABELS,
} from './memory.mjs';
import { normalizeEpistemicState } from './policy.mjs';

export const CHANGE_STATUSES = Object.freeze([
  'pending',
  'applied',
  'cancelled',
  'failed',
]);

export const STABLE_MEMORY_LABELS = Object.freeze([
  'PROFILE',
  'GOALS_AND_DECISIONS',
]);

export const CONNECTION_CHANGE_CANCELLATION_REASON = 'Cancelled because the Letta connection context changed before this proposal was applied.';

const SECRET_KEY = /(api[_-]?key|authorization|cookie|credential|password|secret|token)/i;

export function summarizeMemoryValue(value, limit = 140) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim();
  return normalized.length > limit ? `${normalized.slice(0, limit - 1)}…` : normalized;
}

/**
 * @param {{
 *   id?: string,
 *   block: string,
 *   operation: string,
 *   source?: string,
 *   epistemicState?: string,
 *   timestamp?: string,
 *   before?: string,
 *   after?: string,
 *   status?: string,
 *   error?: string | null,
 *   agentId?: string | null,
 * }} input
 */
export function createMemoryChange({
  id,
  block,
  operation,
  source = 'user',
  epistemicState = 'confirmed',
  timestamp = new Date().toISOString(),
  before = '',
  after = '',
  status = 'applied',
  error = null,
  agentId = null,
}) {
  if (!block || !operation) throw new Error('A memory change needs a block and operation.');
  if (!CHANGE_STATUSES.includes(status)) throw new Error(`Unknown change status: ${status}`);
  const normalizedAgentId = agentId == null ? null : String(agentId).trim() || null;
  if (status === 'pending' && STABLE_MEMORY_LABELS.includes(block) && !normalizedAgentId) {
    throw new Error('A pending stable-memory change requires a connected agent ID.');
  }
  return {
    id: id || `change-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    block,
    operation,
    source,
    epistemicState: normalizeEpistemicState(epistemicState),
    timestamp,
    before: String(before ?? ''),
    after: String(after ?? ''),
    beforeSummary: summarizeMemoryValue(before),
    afterSummary: summarizeMemoryValue(after),
    status,
    error,
    agentId: normalizedAgentId,
  };
}

/**
 * @param {{
 *   id?: string,
 *   block: string,
 *   before: string,
 *   after: string,
 *   operation?: string,
 *   source?: string,
 *   epistemicState?: string,
 *   timestamp?: string,
 *   agentId?: string | null,
 * }} input
 */
export function stageBlockChange({ block, before, after, operation = 'correct', ...rest }) {
  if (POLICY_MEMORY_LABELS.includes(block)) {
    throw new Error(`${block} is a read-only policy block.`);
  }
  if (!WRITABLE_MEMORY_LABELS.includes(block)) {
    throw new Error(`${block} is not a Personal Co writable memory block.`);
  }
  return createMemoryChange({
    block,
    before,
    after,
    operation,
    status: STABLE_MEMORY_LABELS.includes(block) ? 'pending' : 'applied',
    ...rest,
  });
}

/** @param {ReturnType<typeof createMemoryChange>} change @param {string} status @param {string | null} [error] */
export function transitionMemoryChange(change, status, error = null) {
  if (!CHANGE_STATUSES.includes(status)) throw new Error(`Unknown change status: ${status}`);
  if (change.status !== 'pending' && status !== 'failed') {
    throw new Error(`Only pending changes can transition to ${status}.`);
  }
  return { ...change, status, error };
}

export function cancelPendingChangesForConnectionChange(
  changes,
  reason = CONNECTION_CHANGE_CANCELLATION_REASON,
) {
  return changes.map((change) => (
    change.status === 'pending'
      ? transitionMemoryChange(change, 'cancelled', reason)
      : change
  ));
}

export function hasConnectedMemoryContext(connection, currentAgentId) {
  return connection === 'connected' && Boolean(String(currentAgentId ?? '').trim());
}

export function authorizePendingMemoryChange(change, connection, currentAgentId) {
  const agentId = String(currentAgentId ?? '').trim();
  return Boolean(
    change?.status === 'pending'
    && STABLE_MEMORY_LABELS.includes(change.block)
    && hasConnectedMemoryContext(connection, agentId)
    && change.agentId
    && change.agentId === agentId,
  );
}

function safeMetadataValue(value) {
  if (Array.isArray(value)) return value.map(safeMetadataValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SECRET_KEY.test(key))
      .map(([key, item]) => [key, safeMetadataValue(item)]),
  );
}

export function buildPersonalCoMetadata(existing, change) {
  const safeExisting = safeMetadataValue(existing && typeof existing === 'object' ? existing : {});
  return {
    ...safeExisting,
    personal_co: {
      source: change.source,
      epistemic_state: change.epistemicState,
      operation: change.operation,
      updated_at: change.timestamp,
    },
  };
}

export function forgetConfirmationPhrase(term) {
  const exactTerm = String(term ?? '').trim();
  if (!exactTerm) throw new Error('Forget requires a non-empty exact term.');
  return `FORGET ${exactTerm}`;
}

export function removeExactTerm(value, term) {
  const exactTerm = String(term ?? '').trim();
  if (!exactTerm) throw new Error('Forget requires a non-empty exact term.');
  return String(value ?? '').split(exactTerm).join('').replace(/[ \t]{2,}/g, ' ').trim();
}

export function createForgetPreview(term, blocks, archive, agentId) {
  const exactTerm = String(term ?? '').trim();
  if (!exactTerm) throw new Error('Forget requires a non-empty exact term.');
  const boundAgentId = String(agentId ?? '').trim();
  if (!boundAgentId) throw new Error('Forget preview requires a connected agent ID.');
  const blockMatches = blocks
    .filter((block) => WRITABLE_MEMORY_LABELS.includes(block.label))
    .filter((block) => String(block.value ?? '').includes(exactTerm));
  const archiveMatches = archive.filter((item) => String(item.text ?? '').includes(exactTerm));
  return {
    agentId: boundAgentId,
    exactTerm,
    confirmationPhrase: forgetConfirmationPhrase(exactTerm),
    blockMatches,
    archiveMatches,
  };
}

export function authorizeForget(preview, confirmation, currentAgentId) {
  return Boolean(
    preview?.agentId
    && preview.agentId === currentAgentId
    && preview?.exactTerm
    && confirmation === forgetConfirmationPhrase(preview.exactTerm),
  );
}

export function archiveDeleteConfirmationPhrase(passageId) {
  const id = String(passageId ?? '').trim();
  if (!id) throw new Error('Archive deletion requires an exact passage ID.');
  return `DELETE ${id}`;
}

export function authorizeArchiveDelete(passageId, confirmation) {
  return confirmation === archiveDeleteConfirmationPhrase(passageId);
}
