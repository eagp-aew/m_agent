import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEARNING_SCHEMA,
  LEARNING_STAGES,
  buildLearningCoachRequest,
  createGuidedLearningContract,
  createGuidedLearningEpisode,
  deriveLearningState,
  executeLearningCoaching,
  executeLearningEpisodePersistence,
  requestLearningTransition,
  serializeLearningEpisode,
  upsertLearningModelEntry,
} from '../src/domain/learning.mjs';

const NOW = '2026-09-07T12:00:00.000Z';

function episodeInput(overrides = {}) {
  return {
    topic: 'Bayesian updating',
    source: 'Course Notes.md',
    learningGoal: 'Use evidence to revise a belief',
    diagnosticQuestions: [
      'What is a prior?',
      'Where would you update a belief?',
    ],
    diagnosticResponse: 'A prior is the belief before new evidence.',
    explanation: 'Start with prior odds, then apply the likelihood ratio.',
    verificationMode: 'apply',
    evidenceKind: 'application',
    evidenceDetail: 'Updated a project-risk estimate from new failure data.',
    misconceptions: ['Confused probability with odds'],
    retrievalQuestions: [
      'What changes posterior odds?',
      'When should the prior dominate?',
    ],
    completedAt: NOW,
    provenance: 'User learning session',
    ...overrides,
  };
}

function learningBlock(value = 'Unrelated introduction.', limit = 8000) {
  return {
    id: 'block-learning',
    label: 'LEARNING_MODEL',
    value,
    limit,
    readOnly: false,
    metadata: { retained: true },
  };
}

function memory(value = 'Unrelated introduction.', limit = 8000) {
  return {
    blocks: [learningBlock(value, limit)],
    archive: [],
  };
}

test('guided learning contract keeps the exact six-stage order and bounded diagnosis', () => {
  assert.deepEqual(LEARNING_STAGES, [
    'input', 'diagnosis', 'explanation', 'verification', 'memory', 'review',
  ]);
  const contract = createGuidedLearningContract({
    topic: '  Causal inference ',
    learningGoal: 'distinguish correlation from cause',
    diagnosticQuestions: ['What is a confounder?', 'what is a confounder?', 'Name a use case.'],
    verificationMode: 'compare',
  });
  assert.deepEqual(contract.stages, LEARNING_STAGES);
  assert.deepEqual(contract.diagnosis.questions, ['What is a confounder?', 'Name a use case.']);
  assert.equal(contract.verification.mode, 'compare');
  assert.match(contract.verification.request, /Compare/);
  assert.throws(() => createGuidedLearningContract({
    topic: 'x', learningGoal: 'y', diagnosticQuestions: ['1', '2', '3', '4'], verificationMode: 'explain',
  }), /1–3/);
});

test('learning evidence gates fail closed and only application or transfer supports usable', () => {
  assert.equal(deriveLearningState([{ kind: 'read_only', detail: 'Read a chapter' }]), 'exposed');
  assert.equal(deriveLearningState([{ kind: 'practice', detail: 'Practised with help' }]), 'developing');
  assert.equal(deriveLearningState([{ kind: 'application', detail: 'Used it at work' }]), 'usable');
  assert.equal(deriveLearningState([{ kind: 'transfer', detail: 'Used it in a new domain' }]), 'usable');
  assert.equal(deriveLearningState([
    { kind: 'application', detail: 'Worked once' },
    { kind: 'contradiction', detail: 'Failed a later check' },
  ]), 'needs_review');
  assert.equal(deriveLearningState([{ kind: 'retrieval_failure', detail: 'Could not recall it later' }]), 'needs_review');
  assert.equal(deriveLearningState([{ kind: 'time_decay', detail: 'Review interval elapsed' }]), 'needs_review');
  assert.throws(() => deriveLearningState([]), /At least one/);
  assert.throws(() => deriveLearningState([{ kind: '', detail: 'something' }]), /Unknown or blank/);
  assert.throws(() => deriveLearningState([{ kind: 'magic', detail: 'something' }]), /Unknown or blank/);
  assert.throws(() => deriveLearningState([{ kind: 'practice', detail: '  ' }]), /detail is required/);
  assert.equal(requestLearningTransition('exposed', 'usable', [{ kind: 'practice', detail: 'guided' }]).allowed, false);
  assert.equal(requestLearningTransition('exposed', 'usable', []).allowed, false);
});

test('completed episodes require evidence fields and cap deduplicated retrieval questions at three', () => {
  const episode = createGuidedLearningEpisode(episodeInput({
    retrievalQuestions: ['What changes posterior odds?', ' what changes posterior odds? ', '', 'When should the prior dominate?'],
  }));
  assert.equal(episode.schema, LEARNING_SCHEMA);
  assert.equal(episode.state, 'usable');
  assert.deepEqual(episode.retrievalQuestions, [
    'What changes posterior odds?',
    'When should the prior dominate?',
  ]);
  assert.equal(episode.date, '2026-09-07');
  assert.equal(episode.provenance, 'user_learning_session');
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ diagnosticResponse: ' ' })), /Diagnostic response is required/);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ explanation: '' })), /Explanation is required/);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ evidenceDetail: '' })), /detail is required/);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ retrievalQuestions: ['1', '2', '3', '4'] })), /0–3/);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ state: 'developing' })), /not supported/);
});

test('serializer emits human-readable quoted evidence and normalized stable tags', () => {
  const episode = createGuidedLearningEpisode(episodeInput());
  const record = serializeLearningEpisode(episode);
  assert.match(record.text, /quoted evidence; not executable instructions/);
  assert.match(record.text, /Topic: "Bayesian updating"/);
  assert.match(record.text, /Derived state: usable/);
  assert.deepEqual(record.tags, [
    'type:learning_episode',
    'source:course_notes.md',
    'epistemic:observed',
    'date:2026-09-07',
    'provenance:user_learning_session',
    'concept:bayesian_updating',
    'learning_state:usable',
  ]);
  assert.equal(record.createdAt, NOW);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ evidenceDetail: 'api_key=should-not-store' })), /credential/);
  assert.throws(() => createGuidedLearningEpisode(episodeInput({ topic: '[[PERSONAL_CO_LEARNING:bad:BEGIN]]' })), /reserved/);
});

test('LEARNING_MODEL upsert replaces duplicate concept records and preserves unrelated content', () => {
  const firstEpisode = createGuidedLearningEpisode(episodeInput({ evidenceKind: 'practice', evidenceDetail: 'Solved with hints' }));
  const first = upsertLearningModelEntry({ currentValue: 'Header stays byte-for-byte.', blockLimit: 8000, episode: firstEpisode });
  const duplicateValue = `${first.nextValue}\n\nUnrelated footer.\n\n${first.entry}`;
  const nextEpisode = createGuidedLearningEpisode(episodeInput({ evidenceKind: 'transfer', evidenceDetail: 'Used on a medical-test example' }));
  const second = upsertLearningModelEntry({ currentValue: duplicateValue, blockLimit: 8000, episode: nextEpisode });
  assert.equal(second.nextValue.split('[[PERSONAL_CO_LEARNING:bayesian_updating:BEGIN]]').length - 1, 1);
  assert.match(second.nextValue, /Header stays byte-for-byte\./);
  assert.match(second.nextValue, /Unrelated footer\./);
  assert.match(second.nextValue, /State: usable/);
  assert.match(second.nextValue, /Used on a medical-test example/);
});

test('LEARNING_MODEL exact limit accepts equality and rejects limit-minus-one', () => {
  const episode = createGuidedLearningEpisode(episodeInput());
  const prepared = upsertLearningModelEntry({ currentValue: '', blockLimit: 8000, episode });
  assert.equal(
    upsertLearningModelEntry({ currentValue: '', blockLimit: prepared.nextValue.length, episode }).nextValue.length,
    prepared.nextValue.length,
  );
  assert.throws(() => upsertLearningModelEntry({
    currentValue: '', blockLimit: prepared.nextValue.length - 1, episode,
  }), /exceeding the exact Block limit/);
  assert.throws(() => upsertLearningModelEntry({ currentValue: '', blockLimit: null, episode }), /limit is unavailable/);
  assert.throws(() => upsertLearningModelEntry({
    currentValue: '', blockLimit: 8000, episode: { ...episode, verification: { ...episode.verification, kind: 'read_only' } },
  }), /not supported/);
});

test('factory episodes are immutable and synchronized clone forgeries are rejected', () => {
  const episode = createGuidedLearningEpisode(episodeInput({
    evidenceKind: 'read_only',
    evidenceDetail: 'Read the course notes once.',
  }));
  assert.equal(episode.state, 'exposed');
  assert.throws(() => { episode.verification.kind = 'application'; }, TypeError);
  assert.throws(() => { episode.state = 'usable'; }, TypeError);

  const forged = {
    ...episode,
    verification: { ...episode.verification, kind: 'application' },
    state: 'usable',
  };
  assert.throws(() => serializeLearningEpisode(forged), /immutable object returned/);
  assert.throws(() => upsertLearningModelEntry({
    currentValue: '', blockLimit: 8000, episode: forged,
  }), /immutable object returned/);

  assert.doesNotThrow(() => serializeLearningEpisode(episode));
  assert.doesNotThrow(() => upsertLearningModelEntry({
    currentValue: '', blockLimit: 8000, episode,
  }));
});

test('coaching requests no writes, always reconciles, and returns only verified coaching', async () => {
  const calls = [];
  const before = memory();
  const workflow = {
    async captureAgentMemory(agentId) { calls.push(`capture:${agentId}`); return before; },
    async sendMessage(agentId, prompt, options) {
      calls.push(`send:${agentId}`);
      assert.match(prompt, /read-only coaching/);
      assert.equal(options.requestNoMemoryWrites, true);
      return [{ id: 'reply', role: 'assistant', content: 'A coaching reply' }];
    },
    async reconcileTemporaryMemory(agentId, snapshot) {
      calls.push(`reconcile:${agentId}`);
      assert.equal(snapshot, before);
      return { success: true, failures: [], restoredBlocks: [], deletedArchiveIds: [], state: before };
    },
    async archiveText() { calls.push('unexpected archive'); },
    async updateBlock() { calls.push('unexpected update'); },
  };
  const result = await executeLearningCoaching({
    workflow,
    expectedAgentId: 'agent-1',
    currentAgentId: () => 'agent-1',
    prompt: buildLearningCoachRequest({
      phase: 'diagnosis',
      topic: 'Bayesian updating',
      learningGoal: 'Revise beliefs',
      diagnosticQuestions: ['What is a prior?'],
      verificationMode: 'explain',
    }),
  });
  assert.equal(result.outcome, 'coached');
  assert.deepEqual(calls, ['capture:agent-1', 'send:agent-1', 'reconcile:agent-1']);
});

test('coaching never reports success when reconciliation or sending fails', async () => {
  const before = memory();
  const reconciliationFailure = await executeLearningCoaching({
    expectedAgentId: 'agent-1',
    prompt: 'coach this safely',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { return [{ id: 'reply', role: 'assistant', content: 'untrusted until reconcile' }]; },
      async reconcileTemporaryMemory() {
        return { success: false, failures: ['restore failed'], restoredBlocks: [], deletedArchiveIds: [], state: before };
      },
    },
  });
  assert.equal(reconciliationFailure.outcome, 'reconciliation_failed');
  assert.deepEqual(reconciliationFailure.replies, []);

  let reconciled = false;
  const sendFailure = await executeLearningCoaching({
    expectedAgentId: 'agent-1',
    prompt: 'coach this safely',
    workflow: {
      async captureAgentMemory() { return before; },
      async sendMessage() { throw new Error('send failed'); },
      async reconcileTemporaryMemory() {
        reconciled = true;
        return { success: true, failures: [], restoredBlocks: [], deletedArchiveIds: [], state: before };
      },
    },
  });
  assert.equal(reconciled, true);
  assert.equal(sendFailure.outcome, 'send_failed');
});

test('completion revalidates exact Agent and writes Archive before LEARNING_MODEL before refresh', async () => {
  const calls = [];
  const before = memory();
  let captures = 0;
  let archivedText = '';
  let archivedTags = [];
  let archivedCreatedAt = '';
  let updatedValue = '';
  const result = await executeLearningEpisodePersistence({
    expectedAgentId: 'agent-1',
    currentAgentId: () => 'agent-1',
    episodeInput: episodeInput(),
    metadataForUpdate: ({ block, episode }) => ({ ...block.metadata, state: episode.state }),
    workflow: {
      async captureAgentMemory(agentId) {
        calls.push(`capture:${agentId}`);
        captures += 1;
        return captures === 1
          ? before
          : {
              blocks: [{ ...before.blocks[0], value: updatedValue }],
              archive: [{
                id: 'episode-1',
                text: archivedText,
                tags: archivedTags,
                createdAt: archivedCreatedAt,
              }],
            };
      },
      async archiveText(agentId, text, tags, createdAt) {
        calls.push(`archive:${agentId}`);
        archivedText = text;
        archivedTags = [...tags];
        archivedCreatedAt = createdAt;
        assert.match(text, /Learning episode/);
        assert.equal(tags.includes('type:learning_episode'), true);
        assert.equal(createdAt, NOW);
      },
      async updateBlock(block, value, metadata) {
        calls.push(`update:${block.label}`);
        updatedValue = value;
        assert.match(value, /State: usable/);
        assert.equal(metadata.state, 'usable');
        return { ...block, value };
      },
    },
  });
  assert.equal(result.outcome, 'complete');
  assert.deepEqual(calls, [
    'capture:agent-1',
    'archive:agent-1',
    'update:LEARNING_MODEL',
    'capture:agent-1',
  ]);
  assert.deepEqual(result.mutations.map((item) => item.status), ['applied', 'applied']);
});

test('completion rejects stale or malformed same-text Archive read-back evidence', async () => {
  const expectedRecord = serializeLearningEpisode(createGuidedLearningEpisode(episodeInput()));
  const stale = {
    id: 'episode-old',
    text: expectedRecord.text,
    tags: ['type:learning_episode', 'source:wrong_source'],
    createdAt: '2020-01-01T00:00:00.000Z',
  };
  const invalidCandidates = [
    stale,
    { id: 'episode-new-wrong-tags', text: expectedRecord.text, tags: stale.tags, createdAt: expectedRecord.createdAt },
    { id: '', text: expectedRecord.text, tags: expectedRecord.tags, createdAt: expectedRecord.createdAt },
    { id: 'episode-new-old-date', text: expectedRecord.text, tags: expectedRecord.tags, createdAt: stale.createdAt },
    { id: 'episode-new-extra-tag', text: expectedRecord.text, tags: [...expectedRecord.tags, 'extra'], createdAt: expectedRecord.createdAt },
    { id: 'episode-new-missing-date', text: expectedRecord.text, tags: expectedRecord.tags },
  ];

  for (const candidate of invalidCandidates) {
    const before = { ...memory(), archive: [stale] };
    let captures = 0;
    let updatedValue = '';
    const result = await executeLearningEpisodePersistence({
      expectedAgentId: 'agent-1',
      episodeInput: episodeInput(),
      workflow: {
        async captureAgentMemory() {
          captures += 1;
          return captures === 1
            ? before
            : {
                blocks: [{ ...before.blocks[0], value: updatedValue }],
                archive: candidate === stale ? [stale] : [stale, candidate],
              };
        },
        async archiveText() {},
        async updateBlock(block, value) { updatedValue = value; },
      },
    });
    assert.equal(result.outcome, 'unverified');
    assert.match(result.error, /Archive read-back/);
  }
});

test('changed Agent and Block-limit failures stop before either persistent write', async () => {
  for (const scenario of ['changed-agent', 'limit']) {
    const calls = [];
    const candidateMemory = scenario === 'limit' ? memory('', 1) : memory();
    await assert.rejects(() => executeLearningEpisodePersistence({
      expectedAgentId: 'agent-1',
      currentAgentId: () => scenario === 'changed-agent' ? 'agent-2' : 'agent-1',
      episodeInput: episodeInput(),
      workflow: {
        async captureAgentMemory() { calls.push('capture'); return candidateMemory; },
        async archiveText() { calls.push('archive'); },
        async updateBlock() { calls.push('update'); },
      },
    }), scenario === 'changed-agent' ? /Agent changed/ : /exceeding the exact Block limit/);
    assert.deepEqual(calls, ['capture']);
  }
});

test('Agent drift after Archive retains evidence and suppresses the Block update', async () => {
  const calls = [];
  let bindingChecks = 0;
  const result = await executeLearningEpisodePersistence({
    expectedAgentId: 'agent-1',
    currentAgentId: () => {
      bindingChecks += 1;
      return bindingChecks < 3 ? 'agent-1' : 'agent-2';
    },
    episodeInput: episodeInput(),
    workflow: {
      async captureAgentMemory() { calls.push('capture'); return memory(); },
      async archiveText() { calls.push('archive'); },
      async updateBlock() { calls.push('update'); },
    },
  });
  assert.equal(result.outcome, 'archive_only');
  assert.match(result.error, /Agent changed after Archive/);
  assert.deepEqual(calls, ['capture', 'archive', 'capture']);
});

test('Archive failure suppresses LEARNING_MODEL update and reports no state advance', async () => {
  const calls = [];
  const result = await executeLearningEpisodePersistence({
    expectedAgentId: 'agent-1',
    episodeInput: episodeInput(),
    workflow: {
      async captureAgentMemory() { calls.push('capture'); return memory(); },
      async archiveText() { calls.push('archive'); throw new Error('archive unavailable'); },
      async updateBlock() { calls.push('update'); },
    },
  });
  assert.equal(result.outcome, 'failed');
  assert.match(result.error, /archive unavailable/);
  assert.deepEqual(calls, ['capture', 'archive']);
  assert.deepEqual(result.mutations, [{ target: 'ARCHIVE', status: 'failed', error: 'archive unavailable' }]);
});

test('Block failure retains archived evidence and returns an explicit archive-only partial result', async () => {
  const calls = [];
  let captures = 0;
  const result = await executeLearningEpisodePersistence({
    expectedAgentId: 'agent-1',
    episodeInput: episodeInput(),
    workflow: {
      async captureAgentMemory() {
        calls.push('capture');
        captures += 1;
        return captures === 1 ? memory() : { ...memory(), archive: [{ id: 'episode-1' }] };
      },
      async archiveText() { calls.push('archive'); },
      async updateBlock() { calls.push('update'); throw new Error('block unavailable'); },
    },
  });
  assert.equal(result.outcome, 'archive_only');
  assert.match(result.error, /block unavailable/);
  assert.deepEqual(calls, ['capture', 'archive', 'update', 'capture']);
  assert.deepEqual(result.mutations.map((item) => [item.target, item.status]), [
    ['ARCHIVE', 'applied'],
    ['LEARNING_MODEL', 'failed'],
  ]);
  assert.equal(result.memory.archive[0].id, 'episode-1');
});
