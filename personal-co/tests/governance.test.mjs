import test from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizeArchiveDelete,
  authorizeForget,
  authorizePendingMemoryChange,
  buildPersonalCoMetadata,
  cancelPendingChangesForConnectionChange,
  CONNECTION_CHANGE_CANCELLATION_REASON,
  createForgetPreview,
  createMemoryChange,
  hasConnectedMemoryContext,
  removeExactTerm,
  stageBlockChange,
  transitionMemoryChange,
} from '../src/domain/changes.mjs';
import {
  authorizeImportDestination,
  createImportCandidates,
  parseArchiveTags,
} from '../src/domain/imports.mjs';
import { createMemoryBlocks } from '../src/domain/memory.mjs';
import {
  diffAgentMemory,
  messageEnvelope,
  parseDoNotRememberTerms,
  planTemporaryReconciliation,
  privacyDecisionForMessage,
} from '../src/domain/privacy.mjs';
import {
  authorizeSnapshotRestore,
  createPortableSnapshot,
  createRestorePreview,
  SNAPSHOT_SCHEMA,
  validatePortableSnapshot,
} from '../src/domain/snapshot.mjs';

const BLOCKS = createMemoryBlocks('persona', 'policy').map((block, index) => ({
  ...block,
  id: `block-${index}`,
}));

test('stable changes remain pending until applied or cancelled and policy blocks reject writes', () => {
  const pending = stageBlockChange({
    id: 'change-1',
    block: 'PROFILE',
    before: 'Old',
    after: 'New',
    agentId: 'agent-1',
    timestamp: '2026-09-04T00:00:00.000Z',
  });
  assert.equal(pending.status, 'pending');
  assert.equal(transitionMemoryChange(pending, 'applied').status, 'applied');
  assert.equal(transitionMemoryChange(pending, 'cancelled').status, 'cancelled');
  assert.throws(() => stageBlockChange({ block: 'PERSONA', before: '', after: '' }), /read-only/);

  const direct = stageBlockChange({ block: 'CURRENT_CONTEXT', before: 'a', after: 'b' });
  assert.equal(direct.status, 'applied');
  const metadata = buildPersonalCoMetadata({ apiKey: 'remove-me', kept: true }, direct);
  assert.equal(metadata.apiKey, undefined);
  assert.equal(metadata.kept, true);
  assert.equal(metadata.personal_co.operation, 'correct');
});

test('connection changes cancel every pending proposal and preserve settled audit records', () => {
  const firstPending = stageBlockChange({
    id: 'pending-profile',
    block: 'PROFILE',
    before: 'old profile',
    after: 'new profile',
    agentId: 'agent-1',
  });
  const secondPending = stageBlockChange({
    id: 'pending-goals',
    block: 'GOALS_AND_DECISIONS',
    before: 'old goals',
    after: 'new goals',
    agentId: 'agent-1',
  });
  const applied = transitionMemoryChange(firstPending, 'applied');
  const alreadyCancelled = transitionMemoryChange(secondPending, 'cancelled', 'user cancelled');

  const result = cancelPendingChangesForConnectionChange([
    firstPending,
    applied,
    secondPending,
    alreadyCancelled,
  ]);

  assert.deepEqual(
    result.map((change) => change.status),
    ['cancelled', 'applied', 'cancelled', 'cancelled'],
  );
  assert.equal(result[0].error, CONNECTION_CHANGE_CANCELLATION_REASON);
  assert.equal(result[2].error, CONNECTION_CHANGE_CANCELLATION_REASON);
  assert.equal(result[1], applied);
  assert.equal(result[3], alreadyCancelled);
  assert.equal(result[3].error, 'user cancelled');
});

test('stable proposals fail closed across the asynchronous connection boundary', () => {
  assert.equal(hasConnectedMemoryContext('connected', 'agent-a'), true);
  assert.equal(hasConnectedMemoryContext('connecting', 'agent-a'), false);
  assert.equal(hasConnectedMemoryContext('connected', ''), false);
  assert.throws(() => stageBlockChange({
    block: 'PROFILE',
    before: 'old',
    after: 'new',
  }), /connected agent ID/);

  const boundToAgentA = stageBlockChange({
    id: 'agent-a-proposal',
    block: 'PROFILE',
    before: 'old',
    after: 'new',
    agentId: 'agent-a',
  });
  assert.equal(authorizePendingMemoryChange(boundToAgentA, 'connected', 'agent-a'), true);
  assert.equal(authorizePendingMemoryChange(boundToAgentA, 'connecting', 'agent-a'), false);
  assert.equal(authorizePendingMemoryChange(boundToAgentA, 'connected', 'agent-b'), false);

  // Simulates a proposal somehow created after connect() starts but before agent B commits.
  const createdDuringTransition = stageBlockChange({
    id: 'transition-window-proposal',
    block: 'GOALS_AND_DECISIONS',
    before: 'agent-a goals',
    after: 'stale proposed goals',
    agentId: 'agent-a',
  });
  const afterAgentBCommit = cancelPendingChangesForConnectionChange([createdDuringTransition]);
  assert.equal(afterAgentBCommit[0].status, 'cancelled');
  assert.equal(authorizePendingMemoryChange(afterAgentBCommit[0], 'connected', 'agent-b'), false);
});

test('forget is literal, scoped to writable blocks, and tied to an exact confirmation phrase', () => {
  const blocks = BLOCKS.map((block) => ({
    ...block,
    value: block.label === 'PROFILE' || block.label === 'PERSONA' ? 'Keep Acme literal.' : block.value,
  }));
  const archive = [{ id: 'passage-1', text: 'Acme observation', tags: [] }];
  const preview = createForgetPreview('Acme', blocks, archive, 'agent-1');
  assert.deepEqual(preview.blockMatches.map((block) => block.label), ['PROFILE']);
  assert.deepEqual(preview.archiveMatches.map((item) => item.id), ['passage-1']);
  assert.equal(authorizeForget(preview, 'forget Acme', 'agent-1'), false);
  assert.equal(authorizeForget(preview, 'FORGET Acme', 'agent-1'), true);
  assert.equal(authorizeForget(preview, 'FORGET Acme', 'agent-2'), false);
  assert.equal(removeExactTerm('Acme and Acme', 'Acme'), 'and');
  assert.throws(() => createForgetPreview('   ', blocks, archive, 'agent-1'), /non-empty/);
  assert.throws(() => createForgetPreview('Acme', blocks, archive, ''), /connected agent ID/);
});

test('forget execution can replace a stale zero-match preview with a fresh agent-bound plan', () => {
  const stale = createForgetPreview('Acme', BLOCKS, [], 'agent-1');
  assert.equal(stale.blockMatches.length + stale.archiveMatches.length, 0);
  assert.equal(authorizeForget(stale, 'FORGET Acme', 'agent-1'), true);

  const freshBlocks = BLOCKS.map((block) => (
    block.label === 'CURRENT_CONTEXT' ? { ...block, value: 'Acme appeared after preview.' } : block
  ));
  const fresh = createForgetPreview(
    stale.exactTerm,
    freshBlocks,
    [{ id: 'new-passage', text: 'New Acme evidence', tags: [] }],
    'agent-1',
  );
  assert.deepEqual(fresh.blockMatches.map((block) => block.label), ['CURRENT_CONTEXT']);
  assert.deepEqual(fresh.archiveMatches.map((item) => item.id), ['new-passage']);
  assert.equal(authorizeForget(fresh, 'FORGET Acme', 'agent-1'), true);
  assert.equal(authorizeForget(fresh, 'FORGET Acme', 'agent-2'), false);
});

test('archive deletion requires the exact passage-specific phrase', () => {
  assert.equal(authorizeArchiveDelete('passage-1', 'DELETE passage-1'), true);
  assert.equal(authorizeArchiveDelete('passage-1', 'DELETE passage-2'), false);
});

test('imports carry normalized provenance and cannot target policy or external actions', () => {
  const [candidate] = createImportCandidates('Observed fact', 'Meeting Notes.md', '2026-09-04T12:00:00.000Z');
  assert.deepEqual(parseArchiveTags(candidate.normalizedTags), {
    category: 'external import',
    source: 'meeting notes.md',
    epistemicState: 'observed',
    date: '2026-09-04',
    provenance: 'original',
  });
  assert.equal(authorizeImportDestination(candidate, 'PERSONA', true).allowed, false);
  assert.equal(authorizeImportDestination(candidate, 'external_action', true).allowed, false);
});

test('privacy decisions request no writes and reconciliation restores only writable changes', () => {
  assert.deepEqual(parseDoNotRememberTerms('alpha, beta\nalpha'), ['alpha', 'beta']);
  assert.equal(
    privacyDecisionForMessage('contains alpha', { doNotRememberTerms: ['alpha'] }).requestNoMemoryWrites,
    true,
  );
  assert.equal(messageEnvelope('hello', true)[0].role, 'system');

  const before = { blocks: BLOCKS, archive: [{ id: 'old', text: 'old', tags: [] }] };
  const after = {
    blocks: BLOCKS.map((block) => block.label === 'CURRENT_CONTEXT' ? { ...block, value: 'changed' } : block),
    archive: [...before.archive, { id: 'new', text: 'new', tags: [] }],
  };
  assert.equal(diffAgentMemory(before, after).changedBlocks.length, 1);
  const plan = planTemporaryReconciliation(before, after);
  assert.deepEqual(plan.blockRestores.map((block) => block.label), ['CURRENT_CONTEXT']);
  assert.deepEqual(plan.archiveDeletes.map((item) => item.id), ['new']);
  assert.deepEqual(plan.violations, []);
});

test('temporary reconciliation flags policy mutation and irreversible archive changes', () => {
  const before = { blocks: BLOCKS, archive: [{ id: 'old', text: 'old', tags: [] }] };
  const after = {
    blocks: BLOCKS.map((block) => block.label === 'PERSONA' ? { ...block, value: 'changed' } : block),
    archive: [],
  };
  const plan = planTemporaryReconciliation(before, after);
  assert.equal(plan.blockRestores.length, 0);
  assert.match(plan.violations.join(' '), /Read-only policy block changed/);
  assert.match(plan.violations.join(' '), /Archive passage was removed/);
});

test('portable snapshots are versioned, secret-free, and locked to the connected agent', () => {
  const snapshot = createPortableSnapshot({
    agentId: 'agent-1',
    settings: {
      baseUrl: 'http://name:password@localhost:8283/v1?api_key=query-secret#token=hash-secret',
      modelHandle: 'model',
      embeddingHandle: 'embedding',
      apiKey: 'never-export',
      language: 'English',
    },
    blocks: BLOCKS.map((block) => ({ ...block, metadata: { token: 'remove', source: 'user' } })),
    archive: [{ id: 'a1', text: 'record', tags: ['type:observation'] }],
    exportedAt: '2026-09-04T00:00:00.000Z',
  });
  assert.equal(snapshot.schema, SNAPSHOT_SCHEMA);
  assert.equal(snapshot.agentId, 'agent-1');
  assert.equal(JSON.stringify(snapshot).includes('never-export'), false);
  assert.equal(JSON.stringify(snapshot).includes('remove'), false);
  assert.equal(JSON.stringify(snapshot).includes('password'), false);
  assert.equal(JSON.stringify(snapshot).includes('query-secret'), false);
  assert.equal(JSON.stringify(snapshot).includes('hash-secret'), false);
  assert.equal(snapshot.settings.baseUrl, 'http://localhost:8283/v1');
  assert.equal(validatePortableSnapshot(snapshot, 'agent-1').valid, true);
  assert.equal(validatePortableSnapshot(snapshot, 'agent-2').valid, false);
});

test('restore preview changes writable blocks only and appends only missing archive records', () => {
  const current = {
    agentId: 'agent-1',
    blocks: BLOCKS,
    archive: [{ id: 'existing', text: 'same', tags: ['type:note'] }],
  };
  const snapshot = createPortableSnapshot({
    agentId: 'agent-1',
    settings: {},
    blocks: BLOCKS.map((block) => ({ ...block, value: `${block.value} restored` })),
    archive: [
      { id: 'old-id', text: 'same', tags: ['type:note'] },
      { id: 'missing', text: 'missing', tags: ['type:note'] },
      { id: 'duplicate-missing', text: 'missing', tags: ['type:note'] },
      { id: 'next-missing', text: 'next', tags: ['type:note'] },
    ],
  });
  const preview = createRestorePreview(snapshot, current);
  assert.equal(preview.blockChanges.length, 4);
  assert.deepEqual(preview.policyBlocksUnchanged, ['PERSONA', 'MEMORY_POLICY']);
  assert.deepEqual(preview.archiveAdds.map((item) => item.id), ['missing', 'next-missing']);
  assert.equal(preview.archiveAdds[0].tags.includes('provenance:restore'), true);
  assert.equal(authorizeSnapshotRestore(preview, 'RESTORE agent-1', 'agent-1'), true);
  assert.equal(authorizeSnapshotRestore(preview, 'RESTORE agent-2', 'agent-1'), false);
  assert.equal(authorizeSnapshotRestore(preview, 'RESTORE agent-1', 'agent-2'), false);

  const converged = createRestorePreview(snapshot, {
    agentId: 'agent-1',
    blocks: snapshot.blocks,
    archive: snapshot.archive,
  });
  assert.equal(converged.blockChanges.length + converged.archiveAdds.length, 0);
  assert.equal(preview.blockChanges.length + preview.archiveAdds.length, 6);
  assert.throws(
    () => createRestorePreview(snapshot, { ...current, agentId: 'agent-2' }),
    /does not match the connected agent/,
  );
});

test('change records expose summaries and all required audit fields', () => {
  const change = createMemoryChange({
    id: 'c1',
    block: 'Archive',
    operation: 'delete',
    source: 'user',
    epistemicState: 'observed',
    timestamp: '2026-09-04T00:00:00.000Z',
    before: 'before',
    after: 'after',
    status: 'failed',
    error: 'network',
  });
  assert.deepEqual(
    Object.keys(change),
    ['id', 'block', 'operation', 'source', 'epistemicState', 'timestamp', 'before', 'after', 'beforeSummary', 'afterSummary', 'status', 'error', 'agentId'],
  );
  assert.equal(change.agentId, null);
});
