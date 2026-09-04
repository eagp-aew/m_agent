import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_MEMORY_LABELS,
  authorizeMemoryUpdate,
  createMemoryBlocks,
  validateMemorySchema,
} from '../src/domain/memory.mjs';
import { authorizeImportDestination, createImportCandidates } from '../src/domain/imports.mjs';
import {
  LEARNING_STATES,
  deriveLearningState,
  requestLearningTransition,
} from '../src/domain/learning.mjs';
import {
  EPISTEMIC_STATES,
  routeUncertainInformation,
  requiresExternalWriteConfirmation,
} from '../src/domain/policy.mjs';

test('the memory schema has exactly four writable and two read-only blocks', () => {
  const blocks = createMemoryBlocks('persona', 'policy');
  assert.deepEqual(blocks.map((block) => block.label), ALL_MEMORY_LABELS);
  assert.deepEqual(validateMemorySchema(blocks), {
    valid: true,
    exactLabels: true,
    policyReadOnly: true,
    userWritable: true,
  });
  assert.equal(blocks.filter((block) => !block.readOnly).length, 4);
  assert.equal(blocks.filter((block) => block.readOnly).length, 2);
});

test('stable and policy blocks reject unsafe writes', () => {
  assert.equal(authorizeMemoryUpdate('PROFILE', false).allowed, false);
  assert.equal(authorizeMemoryUpdate('GOALS_AND_DECISIONS', true).allowed, true);
  assert.equal(authorizeMemoryUpdate('PERSONA', true).allowed, false);
  assert.equal(authorizeMemoryUpdate('NEW_CATEGORY', true).allowed, false);
});

test('epistemic policy knows all five states and routes uncertainty to archive', () => {
  assert.deepEqual(EPISTEMIC_STATES, [
    'confirmed', 'observed', 'inferred', 'hypothesis', 'superseded',
  ]);
  assert.deepEqual(routeUncertainInformation({ state: 'inferred', destination: 'PROFILE' }), {
    allowed: false,
    destination: 'archive',
    reason: 'Uncertain information is archive-first.',
  });
  assert.equal(requiresExternalWriteConfirmation({ kind: 'external_write', confirmed: false }), true);
});

test('external imports remain archive candidates until explicit promotion', () => {
  const [candidate] = createImportCandidates('May prefer morning meetings', 'notes.txt');
  assert.equal(candidate.sourceType, 'external_import');
  assert.deepEqual(candidate.tags, ['external_import']);
  assert.equal(candidate.destination, 'archive');
  assert.equal(authorizeImportDestination(candidate, 'PROFILE').allowed, false);
  assert.equal(authorizeImportDestination(candidate, 'PROFILE', true).allowed, true);
});

test('read-only exposure never becomes usable without stronger evidence', () => {
  assert.deepEqual(LEARNING_STATES, ['exposed', 'developing', 'usable', 'needs_review']);
  const reading = [{ kind: 'read_only', detail: 'Read an article' }];
  assert.equal(deriveLearningState(reading), 'exposed');
  assert.equal(requestLearningTransition('exposed', 'usable', reading).allowed, false);
  const practice = [...reading, { kind: 'practice', detail: 'Practised with guidance' }];
  assert.equal(deriveLearningState(practice), 'developing');
  const applied = [...reading, { kind: 'application', detail: 'Used it in a project' }];
  assert.equal(requestLearningTransition('exposed', 'usable', applied).allowed, true);
  const transferred = [{ kind: 'transfer', detail: 'Applied it in a new domain' }];
  assert.equal(deriveLearningState(transferred), 'usable');
  const contradicted = [...applied, { kind: 'contradiction', detail: 'Failed later check' }];
  assert.equal(deriveLearningState(contradicted), 'needs_review');
});
