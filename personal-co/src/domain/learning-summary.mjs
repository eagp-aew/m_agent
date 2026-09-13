import { acceptedTutoringSession } from './learning-tutoring.mjs';
import { createGuidedLearningEpisode, serializeLearningEpisode, upsertLearningModelEntry } from './learning.mjs';
import { privacyDecisionForMessage } from './privacy.mjs';

export const SUMMARY_REVIEW_PROMPT = '请审阅：这份总结是否如实记录了你接触的内容、仍需核实的地方和下一步？确认审阅不表示通过测验。';
export const SUMMARY_FIELDS = Object.freeze({ learned: 2400, needsWork: 1000, nextStep: 1000, steps: 2000, result: 2000, basis: 2000 });
const candidates = new WeakMap();
const identities = new Map();
const secret = /\b(?:api[ _-]?key|password|secret|token)\s*[:=]\s*\S+|\bbearer\s+[a-z0-9._~-]{8,}/iu;

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function strings(value) {
  if (typeof value === 'string') return [value];
  return value && typeof value === 'object' ? Object.values(value).flatMap(strings) : [];
}
function safe(value, privacy) {
  for (const raw of strings(value)) {
    const normalized = raw.normalize('NFKC').replace(/\s+/gu, ' ').trim();
    if (secret.test(normalized) || normalized.includes('[[PERSONAL_CO_LEARNING:')) throw new Error('原始学习内容包含凭据或保留标记，不能保存。');
    if (privacyDecisionForMessage(raw, privacy).requestNoMemoryWrites) throw new Error('当前隐私设置禁止保存这些学习内容。');
  }
  if (privacyDecisionForMessage('', privacy).requestNoMemoryWrites) throw new Error('临时对话禁止保存学习总结。');
}
function privacyCheck(candidate, privacy) {
  safe([candidate.session, candidate.review], privacy);
  // The managed Block contains intentional markers; credential/term checks still cover the complete plan.
  for (const raw of strings([candidate.archiveRecord, candidate.modelUpdate, candidate.metadata, candidate.learningBlock])) {
    if (secret.test(raw.normalize('NFKC').replace(/\s+/gu, ' ')) || privacyDecisionForMessage(raw, privacy).requestNoMemoryWrites) {
      throw new Error('当前隐私设置或凭据检查禁止保存预览内容。');
    }
  }
}
function same(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).sort();
  return sameKeys(keys, Object.keys(b).sort()) && keys.every((key) => same(a[key], b[key]));
}
function sameKeys(a, b) { return a.length === b.length && a.every((item, i) => item === b[i]); }
function blockFrom(memory) {
  if (!memory || !Array.isArray(memory.blocks) || !Array.isArray(memory.archive)) throw new Error('记忆快照不完整。');
  const blocks = memory.blocks.filter((block) => block.label === 'LEARNING_MODEL');
  const block = blocks[0];
  if (blocks.length !== 1 || typeof block.id !== 'string' || !block.id.trim() || typeof block.value !== 'string'
    || !Number.isInteger(block.limit) || block.limit <= 0 || block.readOnly === true || block.read_only === true) throw new Error('需要唯一、可写、具有准确 ID 和容量的 LEARNING_MODEL。');
  return block;
}
function assertBlock(candidate, memory) {
  const actual = blockFrom(memory), expected = candidate.learningBlock;
  if (actual.id !== expected.id || actual.limit !== expected.limit
    || actual.readOnly !== expected.readOnly || actual.read_only !== expected.read_only) throw new Error('LEARNING_MODEL 的 ID、容量或权限已变化。');
  if (actual.value === candidate.modelUpdate.nextValue && same(actual.metadata ?? null, candidate.metadata)) return 'planned';
  if (actual.value === expected.value && same(actual.metadata ?? null, expected.metadata ?? null)) return 'baseline';
  throw new Error('LEARNING_MODEL 内容或元数据已变化；保留回执，不能覆盖。');
}
function matchingArchive(candidate, memory) {
  const record = candidate.archiveRecord;
  const related = memory.archive.filter((item) => item.text === record.text || item.tags?.includes(candidate.identityTag)
    || item.tags?.includes(record.tags.find((tag) => tag.startsWith('source:'))));
  if (!related.length) return null;
  const item = related[0];
  const timestamp = Date.parse(item.createdAt);
  if (related.length !== 1 || typeof item.id !== 'string' || !item.id.trim()
    || memory.archive.filter((other) => other.id === item.id).length !== 1
    || candidate.archiveIdsBefore.includes(item.id) || item.text !== record.text
    || !Array.isArray(item.tags) || item.tags.some((tag) => typeof tag !== 'string')
    || !sameKeys([...new Set(item.tags)].sort(), [...new Set(record.tags)].sort())
    || !Number.isFinite(timestamp) || timestamp !== Date.parse(record.createdAt)) throw new Error('Archive 身份重复、字段不匹配或缺少准确回读；不再写入。');
  return item;
}
function realAnswer(session) {
  return [...session.history].reverse().find((turn) => turn.action === 'answer' && turn.question
    && turn.result.answer === turn.userText);
}
function bareAcknowledgment(answer) {
  // Preserve clause boundaries and decimal points. A separate explanation can supply evidence;
  // an object inside a self-report ("I understood the explanation") cannot establish it by itself.
  const clauses = answer.normalize('NFKC').toLowerCase().split(/[。！？!?；;，,:：\r\n]+|(?<!\d)\.|\.(?!\d)/u);
  return clauses.every((raw) => {
    const clause = raw.trim().replace(/[’‘]/gu, "'");
    const compact = clause.replace(/[\s\p{P}\p{S}]/gu, '');
    if (!compact || /^(?:好的|好|是的|是|嗯|啊|哦|噢|ok|okay|yes|gotit|understood)+$/u.test(compact)) return true;
    if (/^(?:非常|十分)?(?:谢谢|感谢)/u.test(compact) || /^(?:thanks\b|thank\s+you\b)/u.test(clause)) return true;
    if (/^(?:我|我们|现在|已经|已|完全|都|终于|真的|基本|好像)*(?:看懂|听懂|弄懂|懂|明白|理解|知道|学会|掌握|会|了解)/u.test(compact)) return true;
    return /^(?:(?:now|already|finally)\s+)?(?:(?:i|we)\s+(?:think|believe)\s+)?(?:i|we)(?:\s+(?:have|had|do)|'ve|'d)?\s+(?:(?:now|already|fully|completely|finally)\s+)*(?:understand|understood|know|knew|learned|learnt|got|get|see)\b/u.test(clause);
  });
}

export function prepareTutoringSummary(session) {
  acceptedTutoringSession(session);
  const last = session.history.at(-1).result, answered = realAnswer(session);
  return {
    learned: last.explanation,
    needsWork: answered?.result.feedback.misconceptions ?? '尚无实际回答证据；讲解内容仍需核实。',
    nextStep: answered?.result.feedback.nextStep ?? '用自己的话回顾关键点，或下次提出一个具体问题。',
    evidenceKind: 'read_only', reviewed: false, steps: '', result: '', basis: '',
  };
}

export function createSummaryEpisode(session, review, completedAt) {
  acceptedTutoringSession(session);
  if (!review || Object.keys(review).length !== 8 || !['evidenceKind', 'reviewed', ...Object.keys(SUMMARY_FIELDS)].every((key) => Object.hasOwn(review, key))) throw new Error('总结审阅字段不完整。');
  for (const [field, limit] of Object.entries(SUMMARY_FIELDS)) {
    if (typeof review[field] !== 'string' || review[field].length > limit
      || (['learned', 'needsWork', 'nextStep'].includes(field) && !review[field].trim())) throw new Error(`${field} 必须为有效原始文本，最多 ${limit} UTF-16 码元；不会截断。`);
  }
  if (review.reviewed !== true) throw new Error('请先确认已审阅总结。');
  const kind = review.evidenceKind;
  if (!['read_only', 'practice', 'application', 'transfer', 'retrieval_failure', 'contradiction'].includes(kind)) throw new Error('无效的总结证据类型。');
  const answer = realAnswer(session);
  if (kind === 'practice' && (!answer || bareAcknowledgment(answer.userText))) throw new Error('练习状态需要真实绑定的作答；“我懂了”等自述不算作答证据。');
  if (['application', 'transfer'].includes(kind) && !['steps', 'result', 'basis'].every((field) => review[field].trim())) throw new Error('应用或迁移需要你填写实际步骤、结果和核实依据。');
  safe([session, review], {});
  const evidence = [
    '用户已审阅；不是模型认证。',
    kind === 'read_only' ? '仅接触讲解或用户自述；没有通过测验的声明。' : `用户选择的证据：${kind}。`,
    answer ? `实际提交问题：${answer.question.text}\n实际提交回答：${answer.userText}` : '无历史作答；仅本次总结审阅确认。',
    `还需核实或练习：${review.needsWork}\n下一步：${review.nextStep}`,
    ...['steps', 'result', 'basis'].map((field) => `${field}（用户填写）：${review[field] || '未填写'}`),
  ].join('\n');
  return createGuidedLearningEpisode({
    topic: session.node?.title ?? session.goal, learningGoal: session.goal,
    source: `chat_tutoring:${session.sessionId}`,
    diagnosticQuestions: answer ? [answer.question.text] : [SUMMARY_REVIEW_PROMPT],
    diagnosticResponse: answer ? answer.userText : '本次总结审阅确认：我已审阅这份总结；并非历史诊断或答题。',
    explanation: `用户审阅的总结（源于模型建议，内容未经独立核实）：${review.learned}`,
    verificationMode: ['application', 'transfer'].includes(kind) ? 'apply' : 'explain',
    evidenceKind: kind, evidenceDetail: evidence,
    misconceptions: [`用户审阅的待核实事项（不代表已证实误解）：${review.needsWork}`],
    retrievalQuestions: [review.nextStep], completedAt, provenance: 'user_reviewed_tutoring_summary',
  });
}

/** @param {{workflow: any, session: any, review: any, currentAgentId?: () => string, isCurrent?: () => boolean, getPrivacy?: () => any, metadataForUpdate?: (input: any) => any}} options */
export async function prepareSummaryCandidate({ workflow, session, review, currentAgentId = () => session.agentId,
  isCurrent = () => true, getPrivacy = () => ({}), metadataForUpdate = ({ block }) => block.metadata ?? null }) {
  acceptedTutoringSession(session);
  const capturedReview = structuredClone(review);
  const key = JSON.stringify([session.agentId, session.sessionId]);
  let identity = identities.get(key);
  if (!identity) { identity = { completedAt: new Date().toISOString(), attempted: null }; identities.set(key, identity); }
  if (identity.attempted) throw new Error('本次会话已有保存尝试；请检查原回执，不得生成另一份保存。');
  safe([session, capturedReview], getPrivacy());
  const episode = createSummaryEpisode(session, capturedReview, identity.completedAt);
  const before = await workflow.captureAgentMemory(session.agentId);
  if (!isCurrent() || currentAgentId() !== session.agentId) throw new Error('会话、审阅或 Agent 已变化；预览已取消。');
  const learningBlock = structuredClone(blockFrom(before));
  const archiveRecord = serializeLearningEpisode(episode);
  const identityTag = `summary:${session.sessionId}`;
  archiveRecord.tags.push(identityTag);
  const modelUpdate = upsertLearningModelEntry({ currentValue: learningBlock.value, blockLimit: learningBlock.limit, episode });
  const metadata = structuredClone(metadataForUpdate({ block: learningBlock, nextValue: modelUpdate.nextValue, episode }));
  const candidate = freeze({ session, review: capturedReview, agentId: session.agentId, identityTag, episode,
    archiveRecord, learningBlock, modelUpdate, metadata,
    archiveIdsBefore: before.archive.map((item) => item.id),
  });
  privacyCheck(candidate, getPrivacy());
  if (matchingArchive(candidate, before)) throw new Error('本次总结已存在；请查看 Archive，不生成重复保存。');
  candidates.set(candidate, { identity, attempted: false, busy: false, outcome: 'preview', archiveId: null, error: null, mutations: [] });
  return candidate;
}

export function summaryReceipt(candidate) {
  const state = candidates.get(candidate);
  if (!state) throw new Error('需要本页生成的不可变保存预览。');
  return freeze({ agentId: candidate.agentId, identityTag: candidate.identityTag, attempted: state.attempted,
    outcome: state.outcome, archiveId: state.archiveId, error: state.error, mutations: state.mutations.map((item) => ({ ...item })) });
}

/** @param {{workflow: any, candidate: any, confirmed?: boolean, currentAgentId?: () => string, isCurrent?: () => boolean, getPrivacy?: () => any, onReceipt?: (receipt: any) => void}} options */
export async function executeSummaryPersistence({ workflow, candidate, confirmed = false, currentAgentId = () => candidate.agentId,
  isCurrent = () => true, getPrivacy = () => ({}), onReceipt = () => {} }) {
  const state = candidates.get(candidate);
  if (!state) throw new Error('需要本页生成的不可变保存预览。');
  if (state.busy) return { receipt: summaryReceipt(candidate), memory: null };
  if (state.outcome === 'complete') return { receipt: summaryReceipt(candidate), memory: null };
  if (!confirmed) throw new Error('需要明确确认保存或检查。');
  state.busy = true;
  /** @type {any} */
  let memory = null;
  const publish = () => onReceipt(summaryReceipt(candidate));
  const guard = () => {
    if (currentAgentId() !== candidate.agentId || (!state.attempted && !isCurrent())) throw new Error('原 Agent 或未保存预览已变化；不得写入其他助手。');
    privacyCheck(candidate, getPrivacy());
  };
  const capture = async () => { guard(); const result = await workflow.captureAgentMemory(candidate.agentId); guard(); memory = result; return result; };
  try {
    guard();
    await capture();
    let blockState = assertBlock(candidate, memory);
    let archived = matchingArchive(candidate, memory);
    if (!state.attempted) {
      if (state.identity.attempted && state.identity.attempted !== candidate) throw new Error('本次会话另一预览已尝试保存；保留原回执。');
      if (archived || blockState !== 'baseline') throw new Error('预览基线已变化；不得再次追加。');
      guard();
      state.attempted = true;
      state.identity.attempted = candidate;
      state.outcome = 'unknown';
      state.mutations.push({ target: 'ARCHIVE', status: 'pending', error: '追加已尝试，等待精确回读。' });
      publish();
      try { await workflow.archiveText(candidate.agentId, candidate.archiveRecord.text, candidate.archiveRecord.tags, candidate.archiveRecord.createdAt); }
      catch { throw new Error('Archive 追加响应不确定；可能已写入。请检查回执，不会再次追加。'); }
      await capture();
      archived = matchingArchive(candidate, memory);
      blockState = assertBlock(candidate, memory);
    }
    if (!archived) throw new Error('Archive 暂无唯一准确记录；追加结果仍未知。仅可继续检查，不能重发。');
    state.archiveId = archived.id;
    state.mutations[0] = { target: 'ARCHIVE', status: 'applied', error: null };
    state.outcome = 'archive_only';
    publish();
    if (blockState === 'baseline') {
      guard();
      state.mutations.push({ target: 'LEARNING_MODEL', status: 'pending', error: '更新已尝试，等待精确回读。' });
      publish();
      try { await workflow.updateBlock(candidate.learningBlock, candidate.modelUpdate.nextValue, candidate.metadata); }
      catch { throw new Error('Archive 已验证；LEARNING_MODEL 更新响应不确定。请检查并继续未完成保存。'); }
      await capture();
    }
    guard();
    archived = matchingArchive(candidate, memory);
    if (!archived || assertBlock(candidate, memory) !== 'planned') throw new Error('尚未准确回读 Archive 和 LEARNING_MODEL；不能报告完成。');
    state.archiveId = archived.id;
    state.outcome = 'complete';
    state.error = null;
    // Preserve every attempted operation; exact readback proves their intended result, not which retry delivered it.
    state.mutations = state.mutations.map((mutation) => ({ ...mutation, status: 'applied', error: null }));
  } catch (error) {
    state.error = error instanceof Error ? error.message : '无法核实保存结果。';
    state.outcome = state.attempted ? state.archiveId ? 'archive_only' : 'unknown' : 'blocked';
  } finally { state.busy = false; publish(); }
  return { receipt: summaryReceipt(candidate), memory };
}
