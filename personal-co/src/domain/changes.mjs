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

const SECRET_METADATA_PARTS = new Set([
  'authorization',
  'cookie',
  'credential',
  'password',
  'secret',
  'token',
]);
const FACTORY_PENDING_CHANGES = new WeakSet();

function normalizedMetadataKeyParts(key) {
  return String(key ?? '')
    .normalize('NFKC')
    .replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, '$1_$2')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

function isObviousSecretMetadataKey(key) {
  const parts = normalizedMetadataKeyParts(key);
  if (parts.some((part) => SECRET_METADATA_PARTS.has(part) || part === 'apikey')) return true;
  return parts.some((part, index) => part === 'api' && parts[index + 1] === 'key');
}

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
 *   baseBlockId?: string | null,
 *   baseBlockValue?: string | null,
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
  baseBlockId = null,
  baseBlockValue = null,
}) {
  if (!block || !operation) throw new Error('A memory change needs a block and operation.');
  if (!CHANGE_STATUSES.includes(status)) throw new Error(`Unknown change status: ${status}`);
  const normalizedAgentId = agentId == null ? null : String(agentId).trim() || null;
  const normalizedBaseBlockId = baseBlockId == null ? null : String(baseBlockId).trim() || null;
  const normalizedBaseBlockValue = baseBlockValue == null ? null : String(baseBlockValue);
  if (status === 'pending' && WRITABLE_MEMORY_LABELS.includes(block)) {
    if (!normalizedAgentId) {
      throw new Error('A pending memory change requires a connected agent ID.');
    }
    if (!normalizedBaseBlockId || normalizedBaseBlockValue == null) {
      throw new Error('A pending memory change requires the exact base Block ID and value.');
    }
  }
  const change = {
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
    baseBlockId: normalizedBaseBlockId,
    baseBlockValue: normalizedBaseBlockValue,
  };
  if (status === 'pending') {
    Object.freeze(change);
    FACTORY_PENDING_CHANGES.add(change);
  }
  return change;
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
 *   baseBlockId?: string | null,
 *   baseBlockValue?: string | null,
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
    baseBlockValue: before,
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

function isValidPendingDestination(change, block) {
  return Boolean(
    block
    && block.readOnly !== true
    && block.read_only !== true
    && Number.isInteger(block.limit)
    && block.limit > 0
    && String(change?.after ?? '').length <= block.limit
  );
}

/**
 * @param {ReturnType<typeof createMemoryChange>} change
 * @param {string} connection
 * @param {string | null | undefined} currentAgentId
 * @param {{label?: string, id?: string, value?: string} | null} currentBlock
 */
export function authorizePendingMemoryChange(change, connection, currentAgentId, currentBlock = null) {
  const agentId = String(currentAgentId ?? '').trim();
  return Boolean(
    change?.status === 'pending'
    && FACTORY_PENDING_CHANGES.has(change)
    && WRITABLE_MEMORY_LABELS.includes(change.block)
    && hasConnectedMemoryContext(connection, agentId)
    && change.agentId
    && change.agentId === agentId
    && currentBlock
    && currentBlock.label === change.block
    && currentBlock.id
    && currentBlock.id === change.baseBlockId
    && String(currentBlock.value ?? '') === change.baseBlockValue
    && isValidPendingDestination(change, currentBlock)
  );
}

function requiredPort(workflow, name) {
  if (!workflow || typeof workflow[name] !== 'function') {
    throw new Error(`Pending memory workflow requires ${name}.`);
  }
}

function changeErrorMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

export async function executePendingMemoryChange({
  workflow,
  change,
  expectedAgentId,
  currentAgentId = () => expectedAgentId,
  connection = 'connected',
  metadataForUpdate = ({ block }) => block.metadata ?? null,
}) {
  requiredPort(workflow, 'captureAgentMemory');
  requiredPort(workflow, 'updateBlock');
  const agentId = String(expectedAgentId ?? '').trim();
  if (!agentId) throw new Error('Pending memory Apply requires an exact Agent ID.');
  const before = await workflow.captureAgentMemory(agentId);
  const matches = before.blocks.filter((block) => block.label === change?.block);
  const block = matches.length === 1 ? matches[0] : null;
  const liveAgentId = String(currentAgentId() ?? '').trim();
  if (liveAgentId !== agentId
    || !authorizePendingMemoryChange(change, connection, liveAgentId, block)) {
    return {
      outcome: 'cancelled',
      memory: before,
      error: 'Cancelled because the Agent, Block identity, base value, permissions, or exact limit changed before Apply.',
    };
  }
  const metadata = metadataForUpdate({ block, change });
  try {
    await workflow.updateBlock(block, change.after, metadata);
  } catch (error) {
    return {
      outcome: 'failed',
      memory: before,
      error: changeErrorMessage(error, 'Pending memory update failed.'),
    };
  }
  try {
    const memory = await workflow.captureAgentMemory(agentId);
    const refreshed = memory.blocks.filter((candidate) => candidate.label === change.block);
    const verified = currentAgentId() === agentId
      && refreshed.length === 1
      && refreshed[0].id === change.baseBlockId
      && String(refreshed[0].value ?? '') === change.after
      && refreshed[0].limit === block.limit
      && refreshed[0].readOnly === block.readOnly
      && refreshed[0].read_only === block.read_only
      && isValidPendingDestination(change, refreshed[0]);
    return verified
      ? { outcome: 'applied', memory, error: null }
      : { outcome: 'failed', memory, error: 'Update returned, but exact Agent/Block read-back could not be verified.' };
  } catch (error) {
    return {
      outcome: 'failed',
      memory: before,
      error: `Update returned, but refresh could not verify it: ${changeErrorMessage(error, 'unknown error')}`,
    };
  }
}

function safeMetadataValue(value) {
  if (Array.isArray(value)) return value.map(safeMetadataValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !isObviousSecretMetadataKey(key))
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
