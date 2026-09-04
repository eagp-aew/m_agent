import test from 'node:test';
import assert from 'node:assert/strict';

import {
  planAgentConfigurationUpdate,
  selectTaggedAgent,
  validateExistingAgentBlocks,
} from '../src/domain/agent.mjs';
import { createMemoryBlocks } from '../src/domain/memory.mjs';

const TAG = 'personal-co-v1';

function serverBlocks() {
  return createMemoryBlocks('persona', 'policy').map(({ label, readOnly }) => ({
    label,
    read_only: readOnly,
  }));
}

test('tagged-agent selection handles zero and one exact match', () => {
  assert.equal(selectTaggedAgent([], TAG), null);

  const match = { id: 'agent-1', tags: [TAG, 'another-tag'] };
  assert.equal(
    selectTaggedAgent([match, { id: 'other', tags: ['another-tag'] }], TAG),
    match,
  );
});

test('tagged-agent selection rejects duplicate exact matches', () => {
  assert.throws(
    () => selectTaggedAgent([
      { id: 'agent-1', tags: [TAG] },
      { id: 'agent-2', tags: [TAG] },
    ], TAG),
    /Found 2 agents tagged personal-co-v1/,
  );
});

test('existing blocks must have the exact labels and permissions', () => {
  assert.deepEqual(validateExistingAgentBlocks(serverBlocks()), {
    valid: true,
    exactLabels: true,
    policyReadOnly: true,
    userWritable: true,
  });

  const missingBlock = serverBlocks().slice(0, -1);
  assert.equal(validateExistingAgentBlocks(missingBlock).valid, false);

  const extraBlock = [...serverBlocks(), { label: 'DYNAMIC', read_only: false }];
  assert.equal(validateExistingAgentBlocks(extraBlock).valid, false);

  const writablePolicy = serverBlocks().map((block) =>
    block.label === 'PERSONA' ? { ...block, read_only: false } : block,
  );
  assert.equal(validateExistingAgentBlocks(writablePolicy).policyReadOnly, false);

  const readOnlyUserBlock = serverBlocks().map((block) =>
    block.label === 'PROFILE' ? { ...block, read_only: true } : block,
  );
  assert.equal(validateExistingAgentBlocks(readOnlyUserBlock).userWritable, false);
});

test('configuration updates preserve the selected agent ID and disable sleeptime', () => {
  const update = planAgentConfigurationUpdate(
    {
      id: 'agent-1',
      model: 'old-model',
      embedding: 'old-embedding',
      enable_sleeptime: true,
    },
    'new-model',
    'new-embedding',
  );

  assert.deepEqual(update, {
    agentId: 'agent-1',
  });

  assert.equal(
    planAgentConfigurationUpdate(
      {
        id: 'agent-1',
        model: 'new-model',
        embedding: 'new-embedding',
        enable_sleeptime: false,
      },
      'new-model',
      'new-embedding',
    ),
    null,
  );
});
