import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { authorizePendingMemoryChange } from '../src/domain/changes.mjs';
import {
  CONNECTION_TYPES,
  REFLECTION_SCHEMA,
  WEEKLY_REVIEW_SECTIONS,
  buildWeeklyReviewCoachRequest,
  createCrossDomainConnection,
  createGrowthHypothesis,
  createWeeklyReview,
  executeWeeklyReviewCoaching,
  executeWeeklyReviewPersistence,
  prepareWeeklyReviewProposals,
  serializeWeeklyReview,
} from '../src/domain/reflection.mjs';

const NOW = '2026-09-07T18:00:00.000Z';

function connection(overrides = {}) {
  return {
    from: 'Bayesian updating',
    to: 'Project risk',
    relationship: 'transfer',
    sharedMechanism: 'Both revise expectations when new evidence arrives.',
    importantDifference: 'Project evidence is sparse and socially generated.',
    futureLearningValue: 'Use posterior-style updates in the next risk review.',
    ...overrides,
  };
}

function hypothesis(overrides = {}) {
  return {
    statement: 'Written briefs may improve decision quality.',
    status: 'hypothesis',
    confidence: 0.6,
    evidence: [{
      detail: 'Two scoped projects finished without late requirement changes.',
      source: 'weekly project log',
      observedAt: '2026-09-07',
    }],
    alternatives: ['The projects may simply have been smaller.'],
    falsifier: 'Three comparable briefed projects still show late requirement churn.',
    userConfirmed: false,
    ...overrides,
  };
}

function reviewInput(overrides = {}) {
  return {
    progress: ['Completed a risk model', 'Practised counterexamples'],
    learningStateChanges: ['Bayesian updating moved from developing to usable'],
    unfinishedThreads: ['Validate the model on a second project'],
    possiblePatterns: ['Written briefs may reduce ambiguity'],
    nextWeekFocus: 'Test the risk model in one live planning conversation.',
    connections: [connection()],
    hypotheses: [hypothesis()],
    source: 'Weekly Notes.md',
    provenance: 'User weekly review',
    completedAt: NOW,
    ...overrides,
  };
}

function blocks(learningValue = 'Keep this unrelated introduction.', learningLimit = 8000) {
  return [
    { id: 'profile-id', label: 'PROFILE', value: 'Profile base', limit: 8000, readOnly: false, read_only: false },
    { id: 'goals-id', label: 'GOALS_AND_DECISIONS', value: 'Goals base', limit: 8000, readOnly: false, read_only: false },
    { id: 'learning-id', label: 'LEARNING_MODEL', value: learningValue, limit: learningLimit, readOnly: false, read_only: false },
    { id: 'context-id', label: 'CURRENT_CONTEXT', value: 'Context base', limit: 8000, readOnly: false, read_only: false },
    { id: 'persona-id', label: 'PERSONA', value: 'Policy', limit: 8000, readOnly: true, read_only: true },
    { id: 'policy-id', label: 'MEMORY_POLICY', value: 'Policy', limit: 8000, readOnly: true, read_only: true },
  ];
}

function memory(learningValue, learningLimit) {
  return { blocks: blocks(learningValue, learningLimit), archive: [] };
}

test('connection records whitelist five relationships, require explanatory fields, deduplicate, and cap at three', () => {
  assert.deepEqual(CONNECTION_TYPES, ['analogy', 'prerequisite', 'causal', 'contradiction', 'transfer']);
  for (const relationship of CONNECTION_TYPES) {
    assert.equal(createCrossDomainConnection(connection({ relationship })).relationship, relationship);
  }
  assert.throws(() => createCrossDomainConnection(connection({ relationship: 'similar' })), /Unknown cross-domain/);
  assert.throws(() => createCrossDomainConnection(connection({ to: 'bayesian updating' })), /distinct endpoints/);
  assert.throws(() => createCrossDomainConnection(connection({ sharedMechanism: '' })), /Shared mechanism is required/);
  assert.throws(() => createCrossDomainConnection(connection({ importantDifference: '' })), /difference or boundary is required/);
  assert.throws(() => createCrossDomainConnection(connection({ futureLearningValue: '' })), /Future-learning value is required/);

  const review = createWeeklyReview(reviewInput({ connections: [connection(), connection()] }));
  assert.equal(review.connections.length, 1);
  assert.throws(() => createWeeklyReview(reviewInput({
    connections: [
      connection(),
      connection({ to: 'Medical testing' }),
      connection({ to: 'Forecasting' }),
      connection({ to: 'Debugging' }),
    ],
  })), /at most three/);
});

test('only symmetric connection relationships deduplicate reversed endpoints', () => {
  for (const relationship of ['prerequisite', 'causal', 'transfer']) {
    const forward = connection({ relationship, from: 'Domain A', to: 'Domain B' });
    const reverse = connection({ relationship, from: 'Domain B', to: 'Domain A' });
    assert.equal(createWeeklyReview(reviewInput({ connections: [forward, reverse] })).connections.length, 2);
  }
  for (const relationship of ['analogy', 'contradiction']) {
    const forward = connection({ relationship, from: 'Domain A', to: 'Domain B' });
    const reverse = connection({ relationship, from: 'Domain B', to: 'Domain A' });
    assert.equal(createWeeklyReview(reviewInput({ connections: [forward, reverse] })).connections.length, 1);
  }
});

test('growth hypotheses require attributable evidence, alternatives, falsifiers, bounded confidence, and exact confirmation', () => {
  const record = createGrowthHypothesis(hypothesis({ userConfirmed: true, status: 'inferred' }));
  assert.equal(record.userConfirmed, true);
  assert.equal(record.status, 'inferred');
  assert.throws(() => createGrowthHypothesis(hypothesis({ confidence: 1.1 })), /0 through 1/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ confidence: '   ' })), /0 through 1/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ status: 'confirmed' })), /inferred or hypothesis/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ evidence: [] })), /attributable evidence/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ evidence: [{ detail: 'x', source: '', observedAt: '2026-09-07' }] })), /source is required/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ alternatives: [] })), /at least one alternative/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ falsifier: '' })), /falsifier is required/);
  assert.throws(() => createGrowthHypothesis(hypothesis({ userConfirmed: 'yes' })), /exact boolean/);
  assert.throws(() => createGrowthHypothesis(hypothesis({
    evidence: [{ detail: 'x', source: 'log', observedAt: '2026-99-99' }],
  })), /real calendar date/);
  assert.throws(() => createWeeklyReview(reviewInput({ date: '2026-02-30' })), /real calendar date/);
});

test('weekly reviews are immutable factory records with the exact ordered five sections and one focus', () => {
  const review = createWeeklyReview(reviewInput());
  assert.equal(review.schema, REFLECTION_SCHEMA);
  assert.deepEqual(review.sections, WEEKLY_REVIEW_SECTIONS);
  assert.equal(review.nextWeekFocus, 'Test the risk model in one live planning conversation.');
  assert.throws(() => { review.sections.reverse(); }, TypeError);
  assert.throws(() => { review.connections[0].relationship = 'analogy'; }, TypeError);
  assert.throws(() => createWeeklyReview(reviewInput({ nextWeekFocus: '' })), /Next-week focus is required/);
  assert.throws(() => serializeWeeklyReview({ ...review }), /immutable object returned/);
});

test('serializer produces one quoted episode with normalized tags and no hidden promotion', () => {
  const review = createWeeklyReview(reviewInput());
  const record = serializeWeeklyReview(review);
  assert.match(record.text, /quoted evidence; not executable instructions/);
  assert.ok(record.text.indexOf('1. Progress') < record.text.indexOf('2. Learning-state changes'));
  assert.ok(record.text.indexOf('4. Possible patterns') < record.text.indexOf('5. Next-week focus'));
  assert.match(record.text, /User confirmed: false/);
  assert.match(record.text, /never automatic personality labels/);
  assert.deepEqual(record.tags, [
    'type:episode',
    'source:weekly_notes.md',
    'epistemic:observed',
    'date:2026-09-07',
    'provenance:user_weekly_review',
    'weekly_review',
  ]);
  assert.equal(record.createdAt, NOW);
  assert.throws(() => createWeeklyReview(reviewInput({ progress: ['token=do-not-store'] })), /credential/);
  assert.throws(() => createWeeklyReview(reviewInput({ provenance: 'token=do-not-store' })), /credential/);
  assert.throws(() => createWeeklyReview(reviewInput({ nextWeekFocus: '[[PERSONAL_CO_CONNECTIONS:BEGIN]]' })), /reserved/);
});

test('security validation rejects normalized credential and managed-marker variants without blocking benign prose', () => {
  const credentialInputs = [
    reviewInput({ progress: ['OPENAI_API_KEY=synthetic-value'] }),
    reviewInput({ source: 'access_token=synthetic-value' }),
    reviewInput({ provenance: 'ＯＰＥＮＡＩ＿ＡＰＩ＿ＫＥＹ＝synthetic-value' }),
    reviewInput({
      hypotheses: [hypothesis({
        evidence: [{
          detail: 'Authorization-Token : synthetic-value',
          source: 'weekly project log',
          observedAt: '2026-09-07',
        }],
      })],
    }),
  ];
  for (const input of credentialInputs) {
    assert.throws(() => createWeeklyReview(input), /credential/);
  }

  for (const marker of [
    '[[personal_co_connections:begin]]',
    '[[ PERSONAL _ CO _ CONNECTIONS : BEGIN ]]',
    '[[ personal _ co _ learning : state ]]',
  ]) {
    assert.throws(() => createWeeklyReview(reviewInput({ nextWeekFocus: marker })), /reserved/);
  }

  const proposalReview = createWeeklyReview(reviewInput({ connections: [] }));
  for (const after of [
    'ACCESS-TOKEN = synthetic-value',
    '[[ personal_co_connections : begin ]]',
    '[[PERSONAL _ CO _ LEARNING:state]]',
  ]) {
    assert.throws(() => prepareWeeklyReviewProposals({
      review: proposalReview,
      blocks: blocks(),
      expectedAgentId: 'agent-1',
      suggestedChanges: [{ block: 'PROFILE', after }],
    }), /credential|reserved/);
  }

  const benign = createWeeklyReview(reviewInput({
    progress: ['Tokenization improves parsing without containing a credential assignment.'],
    source: 'Tokenization Notes.md',
    provenance: 'Tokenization review',
    connections: [],
  }));
  assert.match(serializeWeeklyReview(benign).text, /Tokenization improves parsing/);
  assert.doesNotThrow(() => prepareWeeklyReviewProposals({
    review: benign,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'Tokenization and personal co connections are useful concepts.' }],
  }));
});

test('coaching asks for no writes, reconciles, and accepts only the ordered five headings', async () => {
  const calls = [];
  const before = memory();
  const headings = WEEKLY_REVIEW_SECTIONS.map((name, index) => `${index + 1}. ${name.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(index === 0 ? ' ' : '-')}`);
  const validReply = [
    'Assistant coaching',
    '1. Progress',
    '2. Learning-state changes',
    '3. Unfinished threads',
    '4. Possible patterns',
    '5. Next-week focus',
  ].join('\n');
  assert.equal(headings.length, 5);
  const result = await executeWeeklyReviewCoaching({
    expectedAgentId: 'agent-1',
    prompt: buildWeeklyReviewCoachRequest(reviewInput()),
    workflow: {
      async captureAgentMemory(agentId) { calls.push(`capture:${agentId}`); return before; },
      async sendMessage(agentId, prompt, options) {
        calls.push(`send:${agentId}`);
        assert.match(prompt, /exactly these five headings/);
        assert.equal(options.requestNoMemoryWrites, true);
        return [{ id: 'reply', role: 'assistant', content: validReply }];
      },
      async reconcileTemporaryMemory(agentId, snapshot) {
        calls.push(`reconcile:${agentId}`);
        assert.equal(snapshot, before);
        return { success: true, failures: [], restoredBlocks: [], deletedArchiveIds: [], state: before };
      },
    },
  });
  assert.equal(result.outcome, 'coached');
  assert.deepEqual(calls, ['capture:agent-1', 'send:agent-1', 'reconcile:agent-1']);

  const invalid = await executeWeeklyReviewCoaching({
    expectedAgentId: 'agent-1',
    prompt: 'safe prompt',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { return [{ content: '1. Progress\n5. Next-week focus' }]; },
      async reconcileTemporaryMemory() { return { success: true, failures: [], state: before, restoredBlocks: [], deletedArchiveIds: [] }; },
    },
  });
  assert.equal(invalid.outcome, 'invalid_coaching');
  assert.deepEqual(invalid.replies, []);

  for (const content of [
    `0. Introduction\n${validReply}`,
    `${validReply}\n6. Additional heading`,
    `${validReply}\n3. Unfinished threads`,
    `## Extra heading\n${validReply}`,
    `${validReply}\n### Extra heading`,
    `6) Extra heading\n${validReply}`,
    `(6) Extra heading\n${validReply}`,
  ]) {
    const extraHeading = await executeWeeklyReviewCoaching({
      expectedAgentId: 'agent-1',
      prompt: 'safe prompt',
      workflow: {
        async captureAgentMemory() { return before; },
        async sendMessage() { return [{ content }]; },
        async reconcileTemporaryMemory() { return { success: true, failures: [], state: before, restoredBlocks: [], deletedArchiveIds: [] }; },
      },
    });
    assert.equal(extraHeading.outcome, 'invalid_coaching');
    assert.deepEqual(extraHeading.replies, []);
  }
});

test('coaching always reconciles a send failure and discards replies when reconciliation fails', async () => {
  const before = memory();
  let reconciled = false;
  const sendFailed = await executeWeeklyReviewCoaching({
    expectedAgentId: 'agent-1',
    prompt: 'safe prompt',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { throw new Error('offline'); },
      async reconcileTemporaryMemory() { reconciled = true; return { success: true, failures: [], state: before, restoredBlocks: [], deletedArchiveIds: [] }; },
    },
  });
  assert.equal(reconciled, true);
  assert.equal(sendFailed.outcome, 'send_failed');

  const reconcileFailed = await executeWeeklyReviewCoaching({
    expectedAgentId: 'agent-1',
    prompt: 'safe prompt',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { return [{ content: 'untrusted' }]; },
      async reconcileTemporaryMemory() { return { success: false, failures: ['restore failed'], state: before, restoredBlocks: [], deletedArchiveIds: [] }; },
    },
  });
  assert.equal(reconcileFailed.outcome, 'reconciliation_failed');
  assert.deepEqual(reconcileFailed.replies, []);

  let bindingChecks = 0;
  const changedAgent = await executeWeeklyReviewCoaching({
    expectedAgentId: 'agent-1',
    currentAgentId: () => {
      bindingChecks += 1;
      return bindingChecks === 1 ? 'agent-1' : 'agent-2';
    },
    prompt: 'safe prompt',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { return [{ content: '1. Progress\n2. Learning-state changes\n3. Unfinished threads\n4. Possible patterns\n5. Next-week focus' }]; },
      async reconcileTemporaryMemory() { return { success: true, failures: [], state: before, restoredBlocks: [], deletedArchiveIds: [] }; },
    },
  });
  assert.equal(changedAgent.outcome, 'agent_changed');
  assert.deepEqual(changedAgent.replies, []);
});

test('proposal preparation preserves unrelated LEARNING_MODEL content, enforces one destination and exact limits', () => {
  const review = createWeeklyReview(reviewInput());
  const proposals = prepareWeeklyReviewProposals({ review, blocks: blocks(), expectedAgentId: 'agent-1' });
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].block, 'LEARNING_MODEL');
  assert.equal(proposals[0].status, 'pending');
  assert.equal(proposals[0].baseBlockId, 'learning-id');
  assert.match(proposals[0].after, /Keep this unrelated introduction\./);
  assert.match(proposals[0].after, /Relationship: transfer/);
  assert.match(proposals[0].after, /Future-learning value/);
  assert.equal(authorizePendingMemoryChange(proposals[0], 'connected', 'agent-1', blocks()[2]), true);
  assert.equal(authorizePendingMemoryChange({ ...proposals[0] }, 'connected', 'agent-1', blocks()[2]), false);

  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'LEARNING_MODEL', after: 'arbitrary' }],
  }), /cannot coexist/);
  const duplicatedManaged = `${proposals[0].after}\n\n${proposals[0].after}`;
  const replaced = prepareWeeklyReviewProposals({ review, blocks: blocks(duplicatedManaged), expectedAgentId: 'agent-1' })[0].after;
  assert.equal(replaced.split('[[PERSONAL_CO_CONNECTIONS:BEGIN]]').length - 1, 1);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks('Unrelated\n[[PERSONAL_CO_CONNECTIONS:BEGIN]]\nmalformed'),
    expectedAgentId: 'agent-1',
  }), /could not prove one current managed connection section/);
  const emptyPrepared = prepareWeeklyReviewProposals({ review, blocks: blocks(''), expectedAgentId: 'agent-1' })[0].after;
  assert.doesNotThrow(() => prepareWeeklyReviewProposals({ review, blocks: blocks('', emptyPrepared.length), expectedAgentId: 'agent-1' }));
  assert.throws(() => prepareWeeklyReviewProposals({ review, blocks: blocks('', emptyPrepared.length - 1), expectedAgentId: 'agent-1' }), /exceeding the exact Block limit/);

  const whitespace = 'Line one\n\n\n\nLine two  \n';
  const whitespaceProposal = prepareWeeklyReviewProposals({ review, blocks: blocks(whitespace), expectedAgentId: 'agent-1' })[0];
  assert.equal(whitespaceProposal.after.slice(0, whitespace.length), whitespace);
});

test('review proposals may target all four writable Blocks but reject duplicates and policy Blocks', () => {
  const review = createWeeklyReview(reviewInput({ connections: [] }));
  const proposals = prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [
      { block: 'PROFILE', after: 'Profile proposal' },
      { block: 'GOALS_AND_DECISIONS', after: 'Goals proposal' },
      { block: 'LEARNING_MODEL', after: 'Learning proposal' },
      { block: 'CURRENT_CONTEXT', after: 'Context proposal' },
    ],
  });
  assert.deepEqual(proposals.map((item) => item.block), ['PROFILE', 'GOALS_AND_DECISIONS', 'LEARNING_MODEL', 'CURRENT_CONTEXT']);
  assert.equal(proposals.every((item) => item.status === 'pending' && item.agentId === 'agent-1'), true);
  assert.equal(proposals[0].after, 'Profile proposal');
  const multiline = 'Line one\n\nLine two  ';
  assert.equal(prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: multiline }],
  })[0].after, multiline);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks().map((block) => block.label === 'PROFILE' ? { ...block, limit: 3 } : block),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'four' }],
  }), /exceeding the exact Block limit/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks().map((block) => block.label === 'PROFILE' ? { ...block, limit: null } : block),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'value' }],
  }), /limit is unavailable/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'a' }, { block: 'PROFILE', after: 'b' }],
  }), /Only one pending proposal/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PERSONA', after: 'no' }],
  }), /read-only/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: [...blocks(), { id: 'profile-copy', label: 'PROFILE', value: 'duplicate', limit: 8000 }],
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'new' }],
  }), /exactly one PROFILE/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks().map((block) => block.label === 'PROFILE' ? { ...block, readOnly: true } : block),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'new' }],
  }), /not writable/);
  assert.throws(() => prepareWeeklyReviewProposals({
    review,
    blocks: blocks(),
    expectedAgentId: 'agent-1',
    suggestedChanges: [{ block: 'PROFILE', after: 'api_key=do-not-store' }],
  }), /credential/);
});

test('completion prepares proposals before mutation, writes Archive only, and verifies exact fresh evidence', async () => {
  const calls = [];
  const before = memory();
  let captures = 0;
  let archiveRecord;
  const result = await executeWeeklyReviewPersistence({
    expectedAgentId: 'agent-1',
    currentAgentId: () => 'agent-1',
    reviewInput: reviewInput(),
    suggestedChanges: [{ block: 'PROFILE', after: 'A pending profile refinement' }],
    workflow: {
      async captureAgentMemory(agentId) {
        calls.push(`capture:${agentId}`);
        captures += 1;
        return captures === 1 ? before : {
          blocks: before.blocks.map((block) => ({ ...block })),
          archive: [{ id: 'weekly-1', ...archiveRecord }],
        };
      },
      async archiveText(agentId, text, tags, createdAt) {
        calls.push(`archive:${agentId}`);
        archiveRecord = { text, tags: [...tags], createdAt };
      },
      async updateBlock() { calls.push('unexpected update'); },
    },
  });
  assert.equal(result.outcome, 'complete');
  assert.deepEqual(calls, ['capture:agent-1', 'archive:agent-1', 'capture:agent-1']);
  assert.deepEqual(result.mutations, [{ target: 'ARCHIVE', status: 'applied', error: null }]);
  assert.deepEqual(result.proposals.map((item) => item.block), ['PROFILE', 'LEARNING_MODEL']);
});

test('completion fails honestly for changed Agent, Archive failure, false read-back, and changed Blocks', async () => {
  await assert.rejects(() => executeWeeklyReviewPersistence({
    expectedAgentId: 'agent-1',
    currentAgentId: () => 'agent-2',
    reviewInput: reviewInput(),
    workflow: { async captureAgentMemory() { return memory(); }, async archiveText() {} },
  }), /Agent changed/);

  const failed = await executeWeeklyReviewPersistence({
    expectedAgentId: 'agent-1',
    reviewInput: reviewInput(),
    workflow: {
      async captureAgentMemory() { return memory(); },
      async archiveText() { throw new Error('archive unavailable'); },
    },
  });
  assert.equal(failed.outcome, 'failed');
  assert.deepEqual(failed.proposals, []);

  let bindingChecks = 0;
  let savedAfterDrift;
  let driftCaptures = 0;
  const drifted = await executeWeeklyReviewPersistence({
    expectedAgentId: 'agent-1',
    currentAgentId: () => {
      bindingChecks += 1;
      return bindingChecks < 3 ? 'agent-1' : 'agent-2';
    },
    reviewInput: reviewInput(),
    workflow: {
      async captureAgentMemory() {
        driftCaptures += 1;
        return driftCaptures === 1
          ? memory()
          : { ...memory(), archive: [{ id: 'drifted-review', ...savedAfterDrift }] };
      },
      async archiveText(agentId, text, tags, createdAt) { savedAfterDrift = { text, tags, createdAt }; },
    },
  });
  assert.equal(drifted.outcome, 'unverified');
  assert.match(drifted.error, /Agent binding/);
  assert.deepEqual(drifted.proposals, []);

  for (const mode of ['stale-id', 'wrong-tags', 'old-date', 'changed-block']) {
    let captures = 0;
    let saved;
    const before = memory();
    const result = await executeWeeklyReviewPersistence({
      expectedAgentId: 'agent-1',
      reviewInput: reviewInput(),
      workflow: {
        async captureAgentMemory() {
          captures += 1;
          if (captures === 1) return before;
          return {
            blocks: mode === 'changed-block'
              ? before.blocks.map((block) => block.label === 'PROFILE' ? { ...block, value: 'changed' } : block)
              : before.blocks,
            archive: [{
              id: mode === 'stale-id' ? '' : 'weekly-new',
              text: saved.text,
              tags: mode === 'wrong-tags' ? ['type:episode'] : saved.tags,
              createdAt: mode === 'old-date' ? '2020-01-01T00:00:00.000Z' : saved.createdAt,
            }],
          };
        },
        async archiveText(agentId, text, tags, createdAt) { saved = { text, tags, createdAt }; },
      },
    });
    assert.equal(result.outcome, 'unverified');
    assert.deepEqual(result.proposals, []);
  }
});

test('completion rejects every Block contract drift but accepts metadata key reordering', async () => {
  const before = {
    blocks: blocks().map((block) => ({ ...block, metadata: { nested: { b: 2, a: 1 }, source: 'server' } })),
    archive: [],
  };
  async function runWithBlocks(afterBlocks) {
    let captures = 0;
    let saved;
    return executeWeeklyReviewPersistence({
      expectedAgentId: 'agent-1',
      reviewInput: reviewInput(),
      workflow: {
        async captureAgentMemory() {
          captures += 1;
          return captures === 1 ? before : { blocks: afterBlocks, archive: [{ id: 'weekly-new', ...saved }] };
        },
        async archiveText(agentId, text, tags, createdAt) { saved = { text, tags, createdAt }; },
      },
    });
  }

  const reordered = before.blocks.map((block) => ({
    ...block,
    metadata: { source: 'server', nested: { a: 1, b: 2 } },
  }));
  assert.equal((await runWithBlocks(reordered)).outcome, 'complete');

  for (const mutate of [
    (block) => ({ ...block, limit: block.limit + 1 }),
    (block) => ({ ...block, readOnly: !block.readOnly }),
    (block) => ({ ...block, read_only: !block.read_only }),
    (block) => ({ ...block, metadata: { nested: { a: 1, b: 3 }, source: 'server' } }),
  ]) {
    const after = before.blocks.map((block) => block.label === 'PROFILE' ? mutate(block) : { ...block });
    const result = await runWithBlocks(after);
    assert.equal(result.outcome, 'unverified');
    assert.deepEqual(result.proposals, []);
  }
});

test('Reflection UI manages up to three removable connection drafts and submits every nonblank draft', () => {
  const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(appSource, /reflectionConnections\.map\(/);
  assert.match(appSource, /function addReflectionConnection\(\)/);
  assert.match(appSource, /current\.length >= 3/);
  assert.match(appSource, /function removeReflectionConnection\(id: string\)/);
  assert.match(appSource, /connections: reflectionConnections[\s\S]*?\.filter\([\s\S]*?\.map\(/);
});
