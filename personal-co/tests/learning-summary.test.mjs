import test from 'node:test';
import assert from 'node:assert/strict';
import { createTutoringSession, prepareTutoringRequest, executeTutoringTurn, TUTORING_SCHEMA } from '../src/domain/learning-tutoring.mjs';
import { SUMMARY_FIELDS, SUMMARY_REVIEW_PROMPT, prepareTutoringSummary, createSummaryEpisode, prepareSummaryCandidate, summaryReceipt, executeSummaryPersistence } from '../src/domain/learning-summary.mjs';

let sequence = 0;
async function session({ mode = 'explain_only', answer, goal = '分数与整体', explanation = '分数表示相对于整体的部分。' } = {}) {
  let current = createTutoringSession({ sessionId: `summary-test-${++sequence}`, agentId: 'agent-1', goal, mode });
  for (const action of answer === undefined ? ['start'] : ['start', 'answer']) {
    const request = prepareTutoringRequest(current, action, action === 'answer' ? answer : '', `r-${sequence}-${action}`);
    const { data } = request;
    const workflow = {
      captureAgentMemory: async () => ({ blocks: [], archive: [] }),
      sendMessage: async () => [{ role: 'assistant', content: JSON.stringify({
        schema: TUTORING_SCHEMA, sessionId: data.sessionId, requestId: data.requestId, action,
        questionId: data.question?.id ?? null, answer: action === 'answer' ? data.userText : null,
        explanation, question: mode === 'practice' && action === 'start' ? { id: data.nextQuestionId, text: '半个大饼和半个小饼一样多吗？' } : null,
        feedback: action === 'answer' ? { correct: '模型称赞，不证明掌握。', misconceptions: '整体是否相同仍需核实。', nextStep: '比较不同整体。' } : null,
      }) }],
      reconcileTemporaryMemory: async (_, before) => ({ success: true, state: before }),
    };
    current = (await executeTutoringTurn({ workflow, expectedAgentId: 'agent-1', request })).session;
  }
  return current;
}
function fixture() {
  const memory = { blocks: [{ id: 'learning-1', label: 'LEARNING_MODEL', value: 'Unrelated learning notes\n', limit: 20000, readOnly: false, metadata: { other: { preserved: true } } }], archive: [{ id: 'old-1', text: 'Older evidence', tags: ['old'], createdAt: '2020-01-01T00:00:00Z' }] };
  const calls = [], hooks = {};
  const workflow = {
    async captureAgentMemory(agentId) { calls.push(['capture', agentId]); await hooks.capture?.(); return structuredClone(memory); },
    async archiveText(agentId, text, tags, createdAt) {
      calls.push(['archive', agentId]); await hooks.beforeArchive?.();
      memory.archive.push({ id: 'saved-1', text, tags: [...tags], createdAt }); await hooks.afterArchive?.();
    },
    async updateBlock(block, value, metadata) {
      calls.push(['block', block.id]); await hooks.beforeBlock?.();
      memory.blocks[0] = { ...block, value, metadata: structuredClone(metadata) }; await hooks.afterBlock?.();
    },
  };
  return { memory, workflow, calls, hooks };
}
async function plan(f = fixture(), current, patch = {}, extra = {}) {
  current ??= await session();
  const review = { ...prepareTutoringSummary(current), reviewed: true, ...patch };
  const candidate = await prepareSummaryCandidate({ workflow: f.workflow, session: current, review, ...extra });
  return { f, current, review, candidate };
}
function save(f, candidate, extra = {}) { return executeSummaryPersistence({ workflow: f.workflow, candidate, confirmed: true, ...extra }); }
function writes(f) { return f.calls.filter(([name]) => name !== 'capture').map(([name]) => name); }

test('summary uses real factory history, deterministic suggestions and explicit present review rather than invented diagnosis', async () => {
  const current = await session();
  const review = prepareTutoringSummary(current);
  assert.deepEqual(review, prepareTutoringSummary(current)); assert.equal(review.reviewed, false);
  assert.equal(review.learned, current.history[0].result.explanation);
  assert.throws(() => prepareTutoringSummary({ ...current }));
  assert.throws(() => prepareTutoringSummary(createTutoringSession({ sessionId: 'empty-summary', agentId: 'agent-1', goal: 'x' })));
  assert.throws(() => createSummaryEpisode(current, review));
  const episode = createSummaryEpisode(current, { ...review, reviewed: true }, '2026-09-12T00:00:00Z');
  assert.deepEqual(episode.diagnosis.questions, [SUMMARY_REVIEW_PROMPT.normalize('NFKC')]);
  assert.match(episode.diagnosis.response, /并非历史诊断或答题/); assert.equal(episode.state, 'exposed');
  assert.match(episode.explanation, /未经独立核实/);
});

test('all raw summary bounds reject overflow, unknown fields/types and unreviewed input without truncation', async () => {
  const current = await session(), review = { ...prepareTutoringSummary(current), reviewed: true };
  for (const [field, max] of Object.entries(SUMMARY_FIELDS)) {
    for (const value of [' '.repeat(max + 1), '😀'.repeat(max / 2 + 1), null, 1]) assert.throws(() => createSummaryEpisode(current, { ...review, [field]: value }));
    assert.doesNotThrow(() => createSummaryEpisode(current, { ...review, [field]: '😀'.repeat(max / 2) }));
  }
  for (const patch of [{ reviewed: 'true' }, { evidenceKind: 'mastered' }, { extra: true }, { learned: ' ' }]) assert.throws(() => createSummaryEpisode(current, { ...review, ...patch }));
});

test('evidence defaults conservative; practice needs bound non-acknowledgment answer; application and transfer need all user evidence', async () => {
  const current = await session({ mode: 'practice', answer: '不同，两个整体大小不一样。' });
  const review = { ...prepareTutoringSummary(current), reviewed: true };
  const practice = createSummaryEpisode(current, { ...review, evidenceKind: 'practice' });
  assert.equal(practice.state, 'developing'); assert.equal(practice.diagnosis.response, current.history[1].userText.normalize('NFKC'));
  assert.equal(practice.diagnosis.questions[0], current.history[1].question.text.normalize('NFKC'));
  assert.equal(createSummaryEpisode(current, review).state, 'exposed');
  for (const answer of ['我懂了', '我已经理解这个知识点了', 'I fully understand now.', '明白了！',
    '懂了，谢谢！', 'I have understood.', '谢谢你，我现在明白了。', 'Thanks, I’ve got it now!',
    'We understood, thank you.', 'I learned it.', 'I get it now.', 'I do understand.', '我学会了，谢谢老师', 'Thank you!', '知道啦', '了解了',
    '我已经理解了这个概念。', 'I understood the explanation.', '我明白你的意思了。',
    '我已经理解了这些分数之间的关系。', 'I have understood your explanation of different wholes.',
    '我知道该怎么回答这个问题了，谢谢你的讲解。', 'We now understand how to solve the exercise. Thanks for explaining!',
    '我懂了这个例子；明白了你的意思；谢谢老师。', 'I understood the explanation; I now get the example. Thank you.',
    '现在我已经理解了你刚刚说明的所有内容。', 'Now I understand the point you are making.', '哦，懂了，谢谢你的耐心解释！',
    'I understand that the two wholes differ in size.', '我理解两个整体大小不同了。']) {
    const acknowledgment = await session({ mode: 'practice', answer });
    assert.throws(() => createSummaryEpisode(acknowledgment, { ...prepareTutoringSummary(acknowledgment), reviewed: true, evidenceKind: 'practice' }));
  }
  for (const answer of ['谢谢，不同，两个整体大小不一样。', 'I understand: the two wholes differ in size.',
    '懂了，因为两个饼大小不同，所以半个也不同。', '懂了，因为两个整体大小不同，所以半个也不同。',
    'I understand: the wholes differ in size.', '我明白你的意思了。两个整体大小不同。',
    'I understood the explanation. The two wholes differ in size.', '0.5 × 10 = 5', '不同']) {
    const substantive = await session({ mode: 'practice', answer });
    assert.equal(createSummaryEpisode(substantive, { ...prepareTutoringSummary(substantive), reviewed: true, evidenceKind: 'practice' }).state, 'developing');
  }
  const reading = await session();
  assert.throws(() => createSummaryEpisode(reading, { ...prepareTutoringSummary(reading), reviewed: true, evidenceKind: 'practice' }));
  for (const evidenceKind of ['application', 'transfer']) {
    for (const missing of ['steps', 'result', 'basis']) assert.throws(() => createSummaryEpisode(current, { ...review, evidenceKind, steps: '计算', result: '88元', basis: '代回核实', [missing]: ' ' }));
    const episode = createSummaryEpisode(current, { ...review, evidenceKind, steps: '计算折后税', result: '88元', basis: '代回核实' });
    assert.equal(episode.state, 'usable'); assert.match(episode.verification.detail, /不是模型认证/);
  }
  for (const evidenceKind of ['retrieval_failure', 'contradiction']) assert.equal(createSummaryEpisode(current, { ...review, evidenceKind }).state, 'needs_review');
});

test('immutable fresh preview makes no writes; explicit confirm saves Archive before Block and preserves old records/content', async () => {
  const { f, review, candidate } = await plan();
  assert.deepEqual(writes(f), []); assert.ok(Object.isFrozen(candidate.metadata.other));
  review.learned = 'edited'; assert.notEqual(candidate.review.learned, review.learned);
  await assert.rejects(() => executeSummaryPersistence({ workflow: f.workflow, candidate }), /明确确认/);
  assert.throws(() => summaryReceipt({ ...candidate }));
  const result = await save(f, candidate);
  assert.equal(result.receipt.outcome, 'complete'); assert.equal(result.receipt.archiveId, 'saved-1');
  assert.deepEqual(writes(f), ['archive', 'block']); assert.equal(f.memory.archive[0].id, 'old-1');
  assert.ok(f.memory.blocks[0].value.startsWith('Unrelated learning notes\n'));
  assert.deepEqual(f.memory.blocks[0].metadata, { other: { preserved: true } });
  await save(f, candidate); assert.deepEqual(writes(f), ['archive', 'block']);
  await assert.rejects(() => plan(f, candidate.session), /已有保存尝试/);
});

for (const target of ['text', 'tags', 'time', 'id', 'duplicate', 'duplicate-id', 'missing', 'block-value', 'block-metadata', 'block-limit', 'block-permission']) {
  test(`exact readback rejects ${target}; never promotes HTTP alone`, async () => {
    const { f, candidate } = await plan();
    const damage = () => {
      const item = f.memory.archive.at(-1);
      if (target === 'text') item.text += 'changed';
      if (target === 'tags') item.tags.push('unexpected');
      if (target === 'time') item.createdAt = '2000-01-01T00:00:00Z';
      if (target === 'id') item.id = '';
      if (target === 'duplicate') f.memory.archive.push({ ...item, id: 'duplicate' });
      if (target === 'duplicate-id') f.memory.archive.push({ id: item.id, text: 'unrelated', tags: [] });
      if (target === 'missing') f.memory.archive.pop();
      if (target === 'block-value') f.memory.blocks[0].value = 'wrong readback';
      if (target === 'block-metadata') f.memory.blocks[0].metadata = { drift: true };
      if (target === 'block-limit') f.memory.blocks[0].limit += 1;
      if (target === 'block-permission') f.memory.blocks[0].readOnly = true;
    };
    if (target.startsWith('block-')) f.hooks.afterBlock = damage; else f.hooks.afterArchive = damage;
    const result = await save(f, candidate); assert.notEqual(result.receipt.outcome, 'complete');
    const before = writes(f); await save(f, candidate); assert.deepEqual(writes(f), before);
  });
}

test('partial Block failure resumes only missing update after exact Archive proof and never reappends', async () => {
  const { f, candidate } = await plan();
  f.hooks.beforeBlock = () => { throw new Error('PATCH failure'); };
  const result = await save(f, candidate); assert.equal(result.receipt.outcome, 'archive_only');
  assert.deepEqual(result.receipt.mutations.map(({ status }) => status), ['applied', 'pending']);
  delete f.hooks.beforeBlock;
  const recovered = (await save(f, candidate)).receipt;
  assert.equal(recovered.outcome, 'complete');
  assert.deepEqual(recovered.mutations.map(({ target, status }) => [target, status]), [['ARCHIVE', 'applied'], ['LEARNING_MODEL', 'applied'], ['LEARNING_MODEL', 'applied']]);
  assert.deepEqual(writes(f), ['archive', 'block', 'block']); assert.equal(f.memory.archive.length, 2);
});

test('recovery finding an externally completed exact Block does not invent a local Block attempt', async () => {
  const { f, candidate } = await plan();
  f.hooks.afterArchive = () => { throw new Error('lost append response'); };
  await save(f, candidate);
  f.memory.blocks[0] = { ...candidate.learningBlock, value: candidate.modelUpdate.nextValue, metadata: candidate.metadata };
  const { receipt } = await save(f, candidate);
  assert.equal(receipt.outcome, 'complete');
  assert.deepEqual(receipt.mutations, [{ target: 'ARCHIVE', status: 'applied', error: null }]);
  assert.deepEqual(writes(f), ['archive']);
});

test('lost Archive responses retain stable identity; absent result check-only, saved result safely resumes', async () => {
  for (const saved of [false, true]) {
    const { f, candidate } = await plan();
    f.hooks[saved ? 'afterArchive' : 'beforeArchive'] = () => { throw new Error('response lost'); };
    const result = await save(f, candidate); assert.equal(result.receipt.outcome, 'unknown'); assert.equal(result.receipt.attempted, true);
    assert.deepEqual(writes(f), ['archive']);
    const recovered = await save(f, candidate);
    assert.equal(recovered.receipt.outcome, saved ? 'complete' : 'unknown');
    assert.deepEqual(writes(f), saved ? ['archive', 'block'] : ['archive']);
    assert.equal(candidate.archiveRecord.createdAt, candidate.episode.completedAt);
  }
});

test('Block response loss after successful update checks exact planned metadata and performs no second update', async () => {
  const { f, candidate } = await plan(); f.hooks.afterBlock = () => { throw new Error('lost'); };
  assert.equal((await save(f, candidate)).receipt.outcome, 'archive_only');
  assert.equal((await save(f, candidate)).receipt.outcome, 'complete'); assert.deepEqual(writes(f), ['archive', 'block']);
});

test('fresh baselines/Agent/private settings are rechecked on preview, save and recovery', async () => {
  for (const drift of ['id', 'value', 'metadata', 'limit', 'readOnly']) {
    const { f, candidate } = await plan(); f.memory.blocks[0][drift] = drift === 'limit' ? 19999 : drift === 'readOnly' ? true : 'drift';
    assert.equal((await save(f, candidate)).receipt.outcome, 'blocked'); assert.deepEqual(writes(f), []);
  }
  for (const privacy of [{ temporarySession: true }, { doNotRememberTerms: ['分数'] }]) {
    const f = fixture(), current = await session();
    await assert.rejects(() => plan(f, current, {}, { getPrivacy: () => privacy })); assert.deepEqual(writes(f), []);
    const { candidate } = await plan(f, current);
    assert.equal((await save(f, candidate, { getPrivacy: () => privacy })).receipt.outcome, 'blocked'); assert.deepEqual(writes(f), []);
    f.hooks.beforeBlock = () => { throw new Error('partial'); }; await save(f, candidate);
    const before = writes(f); assert.equal((await save(f, candidate, { getPrivacy: () => privacy })).receipt.outcome, 'archive_only'); assert.deepEqual(writes(f), before);
  }
  const { f, candidate } = await plan();
  assert.equal((await save(f, candidate, { currentAgentId: () => 'agent-2' })).receipt.outcome, 'blocked'); assert.deepEqual(writes(f), []);
  let id = 'agent-1'; f.hooks.afterArchive = () => { id = 'agent-2'; };
  assert.equal((await save(f, candidate, { currentAgentId: () => id })).receipt.outcome, 'unknown'); assert.deepEqual(writes(f), ['archive']);
});

test('raw privacy and secret checks cover historical answers, discarded review fields and settings changed across waits', async () => {
  const current = await session({ mode: 'practice', answer: '原始\n秘密字词' });
  await assert.rejects(() => plan(fixture(), current, {}, { getPrivacy: () => ({ doNotRememberTerms: ['原始\n秘密'] }) }));
  const f = fixture(), clean = await session();
  await assert.rejects(() => plan(f, clean, { steps: 'ａｐｉ＿ｋｅｙ＝synthetic' }));
  let privacy = {}; f.hooks.capture = () => { privacy = { temporarySession: true }; };
  await assert.rejects(() => plan(f, clean, {}, { getPrivacy: () => privacy })); assert.deepEqual(writes(f), []);
});

test('candidate guard closes synchronously before Archive wait; obsolete preview/history and capture failures are safe', async () => {
  const { f, candidate } = await plan(); let release;
  f.hooks.beforeArchive = () => new Promise((resolve) => { release = resolve; });
  const first = save(f, candidate);
  for (let i = 0; i < 20 && !release; i++) await Promise.resolve();
  assert.equal(summaryReceipt(candidate).attempted, true);
  await save(f, candidate); assert.deepEqual(writes(f), ['archive']); release(); await first;
  const other = await plan(); assert.equal((await save(other.f, other.candidate, { isCurrent: () => false })).receipt.outcome, 'blocked'); assert.deepEqual(writes(other.f), []);
  const failed = fixture(), current = await session(); failed.hooks.capture = () => { throw new Error('offline'); };
  await assert.rejects(() => plan(failed, current)); delete failed.hooks.capture;
  assert.ok((await plan(failed, current)).candidate); assert.deepEqual(writes(failed), []);
});
