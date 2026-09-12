import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import {
  DEFAULT_SETTINGS,
  RECOMMENDED_MODEL_HANDLES,
  normalizeSettings,
  type ConnectionSettings,
} from './src/config';
import {
  authorizeArchiveDelete,
  authorizeForget,
  authorizePendingMemoryChange,
  buildPersonalCoMetadata,
  cancelPendingChangesForConnectionChange,
  createForgetPreview,
  createMemoryChange,
  executePendingMemoryChange,
  hasConnectedMemoryContext,
  removeExactTerm,
  stageBlockChange,
  transitionMemoryChange,
} from './src/domain/changes.mjs';
import {
  authorizeImportDestination,
  createImportCandidates,
} from './src/domain/imports.mjs';
import {
  EVIDENCE_KINDS,
  LEARNING_STAGES,
  VERIFICATION_MODES,
  buildLearningCoachRequest,
  deriveLearningState,
  executeLearningCoaching,
  executeLearningEpisodePersistence,
} from './src/domain/learning.mjs';
import {
  CONNECTION_TYPES,
  WEEKLY_REVIEW_SECTIONS,
  buildWeeklyReviewCoachRequest,
  executeWeeklyReviewCoaching,
  executeWeeklyReviewPersistence,
} from './src/domain/reflection.mjs';
import {
  ALL_MEMORY_LABELS,
  authorizeMemoryUpdate,
  createMemoryBlocks,
  POLICY_MEMORY_LABELS,
} from './src/domain/memory.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT } from './src/domain/policy.mjs';
import {
  PRIMARY_SECTIONS,
  SECONDARY_SECTIONS,
  PROMPT_STARTERS,
  primaryForSurface,
  preparePromptDraft,
  completeChatDraft,
} from './src/domain/navigation.mjs';
import {
  createPrivacySettings,
  diffAgentMemory,
  parseDoNotRememberTerms,
  privacyDecisionForMessage,
} from './src/domain/privacy.mjs';
import {
  authorizeSnapshotRestore,
  createPortableSnapshot,
  createRestorePreview,
} from './src/domain/snapshot.mjs';
import {
  ModelSwitchError,
  PersonalCoLettaClient,
  type AgentBlock,
  type AgentSummary,
  type ArchiveItem,
  type ChatMessage,
  type PersistentWorkflow,
} from './src/services/letta';

type Surface = 'Chat' | 'Today' | 'Learning' | 'Reflection' | 'Core Memory' | 'Memory Changes' | 'Archive' | 'Import' | 'Settings';
type ConnectionState = 'offline' | 'connecting' | 'connected' | 'error';
type ModelSwitchState = 'idle' | 'switching' | 'rollback_locked';
type LearningCoachPhase = 'diagnosis' | 'explanation' | 'verification';
type LearningFeedbackTone = 'neutral' | 'good' | 'warn';
type ReflectionConnectionDraft = {
  id: string;
  from: string;
  to: string;
  relationship: string;
  sharedMechanism: string;
  importantDifference: string;
  futureLearningValue: string;
};

type MemoryChangeRecord = {
  id: string;
  block: string;
  operation: string;
  source: string;
  epistemicState: string;
  timestamp: string;
  before: string;
  after: string;
  beforeSummary: string;
  afterSummary: string;
  status: 'pending' | 'applied' | 'cancelled' | 'failed';
  error: string | null;
  agentId: string | null;
  baseBlockId: string | null;
  baseBlockValue: string | null;
};

function emptyReflectionConnection(id: string): ReflectionConnectionDraft {
  return {
    id,
    from: '',
    to: '',
    relationship: 'transfer',
    sharedMechanism: '',
    importantDifference: '',
    futureLearningValue: '',
  };
}

function splitLearningLines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function SurfaceTitle({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <View style={styles.surfaceTitle}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{copy}</Text>
    </View>
  );
}

function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  return (
    <View style={[styles.pill, tone === 'good' && styles.pillGood, tone === 'warn' && styles.pillWarn]}>
      <Text style={[styles.pillText, tone === 'good' && styles.pillTextGood, tone === 'warn' && styles.pillTextWarn]}>{children}</Text>
    </View>
  );
}

function EmptyState({ symbol, title, copy }: { symbol: string; title: string; copy: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptySymbol}>{symbol}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyCopy}>{copy}</Text>
    </View>
  );
}

export default function App() {
  const { width } = useWindowDimensions();
  const compact = width < 820;
  const [surface, setSurface] = useState<Surface>('Chat');
  const [draftSettings, setDraftSettings] = useState<ConnectionSettings>(DEFAULT_SETTINGS);
  const [activeSettings, setActiveSettings] = useState<ConnectionSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('offline');
  const [connectionError, setConnectionError] = useState('');
  const [client, setClient] = useState<PersonalCoLettaClient | null>(null);
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState('');
  const [blocks, setBlocks] = useState<AgentBlock[]>(
    createMemoryBlocks(PERSONA_TEXT, MEMORY_POLICY_TEXT),
  );
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [clearConfirmationLabel, setClearConfirmationLabel] = useState<string | null>(null);
  const [changes, setChanges] = useState<MemoryChangeRecord[]>([]);
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveDeleteTarget, setArchiveDeleteTarget] = useState<ArchiveItem | null>(null);
  const [archiveDeleteConfirmation, setArchiveDeleteConfirmation] = useState('');
  const [importText, setImportText] = useState('');
  const [importSource, setImportSource] = useState('pasted text');
  const [importBusy, setImportBusy] = useState(false);
  const [learningTopic, setLearningTopic] = useState('');
  const [learningSource, setLearningSource] = useState('conversation');
  const [learningGoal, setLearningGoal] = useState('');
  const [learningDiagnosticQuestions, setLearningDiagnosticQuestions] = useState(
    'What do you already understand about this topic?\nWhere would you use it?',
  );
  const [learningDiagnosticResponse, setLearningDiagnosticResponse] = useState('');
  const [learningExplanation, setLearningExplanation] = useState('');
  const [learningVerificationMode, setLearningVerificationMode] = useState('explain');
  const [learningEvidenceKind, setLearningEvidenceKind] = useState('read_only');
  const [learningEvidenceDetail, setLearningEvidenceDetail] = useState('');
  const [learningMisconceptions, setLearningMisconceptions] = useState('');
  const [learningRetrievalQuestions, setLearningRetrievalQuestions] = useState('');
  const [learningBusy, setLearningBusy] = useState(false);
  const [learningCoachOutput, setLearningCoachOutput] = useState('');
  const [learningFeedback, setLearningFeedback] = useState('');
  const [learningFeedbackTone, setLearningFeedbackTone] = useState<LearningFeedbackTone>('neutral');
  const [reflectionProgress, setReflectionProgress] = useState('');
  const [reflectionLearningChanges, setReflectionLearningChanges] = useState('');
  const [reflectionUnfinished, setReflectionUnfinished] = useState('');
  const [reflectionPatterns, setReflectionPatterns] = useState('');
  const [reflectionFocus, setReflectionFocus] = useState('');
  const [reflectionConnections, setReflectionConnections] = useState<ReflectionConnectionDraft[]>([
    emptyReflectionConnection('connection-1'),
  ]);
  const [hypothesisStatement, setHypothesisStatement] = useState('');
  const [hypothesisConfidence, setHypothesisConfidence] = useState('0.5');
  const [hypothesisEvidence, setHypothesisEvidence] = useState('');
  const [hypothesisEvidenceSource, setHypothesisEvidenceSource] = useState('weekly reflection');
  const [hypothesisAlternative, setHypothesisAlternative] = useState('');
  const [hypothesisFalsifier, setHypothesisFalsifier] = useState('');
  const [hypothesisConfirmed, setHypothesisConfirmed] = useState(false);
  const [reflectionProposalValues, setReflectionProposalValues] = useState<Record<string, string>>({});
  const [reflectionBusy, setReflectionBusy] = useState(false);
  const [reflectionCoachOutput, setReflectionCoachOutput] = useState('');
  const [reflectionFeedback, setReflectionFeedback] = useState('');
  const [reflectionFeedbackTone, setReflectionFeedbackTone] = useState<LearningFeedbackTone>('neutral');
  const [privacy, setPrivacy] = useState(() => createPrivacySettings());
  const [doNotRememberText, setDoNotRememberText] = useState('');
  const [forgetTerm, setForgetTerm] = useState('');
  const [forgetPreview, setForgetPreview] = useState<ReturnType<typeof createForgetPreview> | null>(null);
  const [forgetConfirmation, setForgetConfirmation] = useState('');
  const [governanceNotice, setGovernanceNotice] = useState('');
  const [snapshotText, setSnapshotText] = useState('');
  const [restorePreview, setRestorePreview] = useState<ReturnType<typeof createRestorePreview> | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [modelSwitchState, setModelSwitchState] = useState<ModelSwitchState>('idle');
  const [modelSwitchOutcome, setModelSwitchOutcome] = useState('');
  const connectionSwitchGuard = useRef<'idle' | 'connecting' | 'switching' | 'learning' | 'reflection' | 'memory_change' | 'rollback_locked'>('idle');
  const agentBindingRef = useRef<{ client: PersonalCoLettaClient; agentId: string } | null>(null);

  const importCandidates = useMemo(
    () => createImportCandidates(importText, importSource),
    [importSource, importText],
  );

  const learningDerivedState = useMemo(() => {
    try {
      return deriveLearningState([{ kind: learningEvidenceKind, detail: learningEvidenceDetail }]);
    } catch {
      return null;
    }
  }, [learningEvidenceDetail, learningEvidenceKind]);

  function appendChanges(...nextChanges: MemoryChangeRecord[]) {
    setChanges((current) => [...nextChanges, ...current]);
  }

  async function connect() {
    if (sending || connectionSwitchGuard.current !== 'idle') {
      setConnectionError('Connection changes are unavailable while a persistent workflow, model switch, or rollback lock is active.');
      return;
    }
    connectionSwitchGuard.current = 'connecting';
    setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
    setConnection('connecting');
    setConnectionError('');
    setModelSwitchOutcome('');
    setEditingLabel(null);
    setClearConfirmationLabel(null);
    setForgetPreview(null);
    setForgetConfirmation('');
    setArchiveDeleteTarget(null);
    setArchiveDeleteConfirmation('');
    setRestorePreview(null);
    setRestoreConfirmation('');
    try {
      const normalized = normalizeSettings(draftSettings);
      const nextClient = new PersonalCoLettaClient(normalized, apiKey);
      await nextClient.testConnection();
      const nextAgent = await nextClient.ensureAgent(normalized);
      const [nextBlocks, nextMessages, nextArchive] = await Promise.all([
        nextClient.listBlocks(nextAgent.id),
        nextClient.listMessages(nextAgent.id),
        nextClient.listArchive(nextAgent.id),
      ]);
      setDraftSettings(normalized);
      setActiveSettings(normalized);
      setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
      agentBindingRef.current = { client: nextClient, agentId: nextAgent.id };
      setClient(nextClient);
      setAgent(nextAgent);
      if (nextBlocks.length) setBlocks(nextBlocks);
      setMessages(nextMessages);
      setArchive(nextArchive);
      setConnection('connected');
      setSurface('Chat');
    } catch (error) {
      setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
      if (!client || !agent || !activeSettings) agentBindingRef.current = null;
      setConnection(client && agent && activeSettings ? 'connected' : 'error');
      setConnectionError(error instanceof Error ? error.message : 'Could not connect to Letta.');
    } finally {
      if (connectionSwitchGuard.current === 'connecting') connectionSwitchGuard.current = 'idle';
    }
  }

  async function switchGenerationModel() {
    if (connectionSwitchGuard.current !== 'idle') {
      setModelSwitchOutcome('A connection, learning workflow, or model-switch operation is already active.');
      return;
    }
    if (!client || !agent || connection !== 'connected' || !activeSettings) {
      setModelSwitchOutcome('Connect the exact Personal Co Agent before switching its model.');
      return;
    }

    connectionSwitchGuard.current = 'switching';
    setModelSwitchState('switching');
    setModelSwitchOutcome('');
    setConnectionError('');
    let retainRollbackLock = false;
    try {
      const normalizedDraft = normalizeSettings(draftSettings);
      if (normalizedDraft.baseUrl !== activeSettings.baseUrl) {
        throw new Error('The draft Base URL differs from the active connection. Reconnect before switching models.');
      }
      if (normalizedDraft.embeddingHandle !== activeSettings.embeddingHandle) {
        throw new Error('Model switching cannot change the active embedding handle. Reconnect only after an explicit migration plan.');
      }
      const result = await client.switchGenerationModel({
        agentId: agent.id,
        currentModelHandle: activeSettings.modelHandle,
        targetModelHandle: normalizedDraft.modelHandle,
        embeddingHandle: activeSettings.embeddingHandle,
      });
      const committed = {
        ...activeSettings,
        modelHandle: normalizedDraft.modelHandle,
      };
      setActiveSettings(committed);
      setDraftSettings(committed);
      setAgent(result.agent);
      setBlocks(result.memory.blocks);
      setArchive(result.memory.archive);
      setModelSwitchOutcome(`Switched Agent ${result.agent.id} to ${committed.modelHandle}; memory and embedding invariants were verified.`);
    } catch (error) {
      if (error instanceof ModelSwitchError) {
        if (error.agent) setAgent(error.agent);
        if (error.memory) {
          setBlocks(error.memory.blocks);
          setArchive(error.memory.archive);
        }
        retainRollbackLock = error.writesLocked;
        setModelSwitchState(error.writesLocked ? 'rollback_locked' : 'idle');
        setModelSwitchOutcome(error.message);
        if (error.writesLocked) setConnectionError(error.message);
      } else {
        setModelSwitchOutcome(error instanceof Error ? error.message : 'Model switch failed before it could be verified.');
      }
    } finally {
      if (retainRollbackLock) {
        connectionSwitchGuard.current = 'rollback_locked';
      } else {
        connectionSwitchGuard.current = 'idle';
        setModelSwitchState('idle');
      }
    }
  }

  async function sendMessage() {
    const submittedDraft = draft;
    const content = draft.trim();
    if (!content || sending) return;
    if (connectionSwitchGuard.current !== 'idle') {
      setSendFeedback('正在处理另一项操作，请稍后发送。你的草稿已保留。');
      return;
    }
    if (!client || !agent || connection !== 'connected') {
      setSendFeedback('尚未发送。请先打开连接设置接通助手，你的草稿会保留。');
      return;
    }
    const userMessage: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setSending(true);
    setSendFeedback('');
    let delivery: 'not_sent' | 'unknown' | 'received' = 'not_sent';
    let workflowSucceeded = true;
    try {
      const decision = privacyDecisionForMessage(content, privacy);
      await client.runPersistentWorkflow('message and memory reconciliation', async (workflow) => {
        const before = await workflow.captureAgentMemory(agent.id);
        let sendError: unknown = null;
        try {
          delivery = 'unknown';
          const replies = await workflow.sendMessage(agent.id, content, {
            requestNoMemoryWrites: decision.requestNoMemoryWrites,
            language: privacy.language,
          });
          delivery = 'received';
          setMessages((current) => [
            ...current,
            ...replies,
          ]);
          if (!replies.length) setSendFeedback('服务已完成本次请求，但没有返回助手回复。请查看对话，避免重复发送。');
        } catch (error) {
          sendError = error;
        }
        if (decision.requestNoMemoryWrites) {
          const reconciled = await workflow.reconcileTemporaryMemory(agent.id, before);
          workflowSucceeded = reconciled.success;
          setBlocks(reconciled.state.blocks);
          setArchive(reconciled.state.archive);
          const reconciliationChange = createMemoryChange({
            block: 'SESSION',
            operation: 'temporary_reconcile',
            source: decision.reason,
            epistemicState: 'confirmed',
            before: `${reconciled.restoredBlocks.length} block and ${reconciled.deletedArchiveIds.length} archive write(s) detected`,
            after: reconciled.success ? 'Pre-message memory state restored' : 'Memory reconciliation incomplete',
            status: reconciled.success ? 'applied' : 'failed',
            error: reconciled.failures.join(' ') || null,
          }) as MemoryChangeRecord;
          appendChanges(reconciliationChange);
          setGovernanceNotice(
            reconciled.success
              ? 'Privacy reconciliation completed and verified.'
              : `Privacy reconciliation reported failures: ${reconciled.failures.join(' ')}`,
          );
        } else {
          workflowSucceeded = await recordAgentMemoryWrites(before, workflow);
        }
        if (sendError) throw sendError;
      });
      setDraft((current) => completeChatDraft(current, submittedDraft, workflowSucceeded));
      if (!workflowSucceeded) setSendFeedback('消息已返回，但记忆检查未通过。草稿已保留；请先查看变更记录中的失败结果，不要重复发送。');
    } catch (error) {
      const stage = String(delivery);
      if (stage === 'not_sent') setMessages((current) => current.filter((message) => message.id !== userMessage.id));
      setSendFeedback(`${stage === 'not_sent' ? '尚未发送。草稿已保留，可检查连接后重试。' : stage === 'received' ? '消息已返回，但后续记忆检查失败。草稿已保留，请先核对结果，不要重复发送。' : '发送结果待核实，服务可能已经收到消息。草稿已保留；请在连接设置中重新连接并核对历史，再决定是否重发。'} ${error instanceof Error ? error.message : '连接异常。'}`);
    } finally {
      setSending(false);
    }
  }

  function learningEpisodeDraft(completedAt = new Date().toISOString()) {
    return {
      topic: learningTopic,
      source: learningSource,
      learningGoal,
      diagnosticQuestions: splitLearningLines(learningDiagnosticQuestions),
      diagnosticResponse: learningDiagnosticResponse,
      explanation: learningExplanation,
      verificationMode: learningVerificationMode,
      evidenceKind: learningEvidenceKind,
      evidenceDetail: learningEvidenceDetail,
      misconceptions: splitLearningLines(learningMisconceptions),
      retrievalQuestions: splitLearningLines(learningRetrievalQuestions),
      completedAt,
      provenance: 'user_learning_session',
    };
  }

  function currentLearningAgentId(expectedClient: PersonalCoLettaClient): string {
    const binding = agentBindingRef.current;
    return binding?.client === expectedClient ? binding.agentId : '__changed_agent__';
  }

  async function requestLearningCoaching(phase: LearningCoachPhase) {
    if (learningBusy) return;
    if (connectionSwitchGuard.current !== 'idle') {
      setLearningFeedbackTone('warn');
      setLearningFeedback('Learning coaching is unavailable while another persistent workflow or model switch is active.');
      return;
    }
    if (!client || !agent || connection !== 'connected') {
      setConnectionError('Connect the exact Personal Co Agent before requesting learning coaching.');
      setSurface('Settings');
      return;
    }

    const expectedClient = client;
    const expectedAgentId = agent.id;
    connectionSwitchGuard.current = 'learning';
    setLearningBusy(true);
    setLearningCoachOutput('');
    setLearningFeedback('');
    try {
      const prompt = buildLearningCoachRequest({
        phase,
        topic: learningTopic,
        learningGoal,
        diagnosticQuestions: splitLearningLines(learningDiagnosticQuestions),
        diagnosticResponse: learningDiagnosticResponse,
        explanation: learningExplanation,
        verificationMode: learningVerificationMode,
      });
      await expectedClient.runPersistentWorkflow(`learning ${phase} coaching`, async (workflow) => {
        const result = await executeLearningCoaching({
          workflow,
          expectedAgentId,
          currentAgentId: () => currentLearningAgentId(expectedClient),
          prompt,
          language: privacy.language,
        });
        setBlocks(result.memory.blocks);
        setArchive(result.memory.archive);
        const reconciliation = result.reconciliation;
        appendChanges(createMemoryChange({
          block: 'SESSION',
          operation: 'learning_coaching_reconcile',
          source: `learning_${phase}`,
          epistemicState: 'confirmed',
          before: reconciliation
            ? `${reconciliation.restoredBlocks.length} block and ${reconciliation.deletedArchiveIds.length} archive write(s) detected`
            : 'Memory state captured before coaching',
          after: result.outcome === 'reconciliation_failed'
            ? 'Memory reconciliation incomplete; coaching discarded'
            : 'Pre-coaching memory state restored and verified',
          status: result.outcome === 'reconciliation_failed' ? 'failed' : 'applied',
          error: result.outcome === 'reconciliation_failed' ? result.error : null,
          agentId: expectedAgentId,
        }) as MemoryChangeRecord);
        if (result.outcome === 'coached') {
          setLearningCoachOutput(
            result.replies.length
              ? result.replies.map((reply: ChatMessage) => reply.content).join('\n\n')
              : 'The coaching run completed without an assistant message.',
          );
          setLearningFeedbackTone('neutral');
          setLearningFeedback('Assistant coaching is shown separately below. Copy only evidence you personally verified into the form.');
        } else {
          setLearningFeedbackTone('warn');
          setLearningFeedback(`Learning coaching was not accepted: ${result.error}`);
        }
      });
    } catch (error) {
      setLearningFeedbackTone('warn');
      setLearningFeedback(`Learning coaching did not run: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (connectionSwitchGuard.current === 'learning') connectionSwitchGuard.current = 'idle';
      setLearningBusy(false);
    }
  }

  async function completeLearningEpisode() {
    if (learningBusy) return;
    if (connectionSwitchGuard.current !== 'idle') {
      setLearningFeedbackTone('warn');
      setLearningFeedback('The episode cannot be saved while another persistent workflow or model switch is active.');
      return;
    }
    if (!client || !agent || connection !== 'connected') {
      setConnectionError('Connect the exact Personal Co Agent before saving a learning episode.');
      setSurface('Settings');
      return;
    }

    const expectedClient = client;
    const expectedAgentId = agent.id;
    const completedAt = new Date().toISOString();
    connectionSwitchGuard.current = 'learning';
    setLearningBusy(true);
    setLearningFeedback('');
    setLearningFeedbackTone('neutral');
    try {
      await expectedClient.runPersistentWorkflow('learning episode completion', async (workflow) => {
        const result = await executeLearningEpisodePersistence({
          workflow,
          expectedAgentId,
          currentAgentId: () => currentLearningAgentId(expectedClient),
          episodeInput: learningEpisodeDraft(completedAt),
          metadataForUpdate: ({ block }: { block: AgentBlock }) => buildPersonalCoMetadata(block.metadata, {
            source: 'learning_episode',
            epistemicState: 'observed',
            operation: 'learning_model_upsert',
            timestamp: completedAt,
          }),
        });

        if (result.outcome !== 'unverified') {
          setBlocks(result.memory.blocks);
          setArchive(result.memory.archive);
        }
        const auditRecords = result.mutations.map((mutation) => {
          const target = mutation.target === 'ARCHIVE' ? 'ARCHIVE' : 'LEARNING_MODEL';
          const status = mutation.status === 'failed' ? 'failed' : 'applied';
          return createMemoryChange({
            block: target,
            operation: target === 'ARCHIVE' ? 'learning_episode_archive' : 'learning_model_upsert',
            source: result.episode.source,
            epistemicState: 'observed',
            before: target === 'ARCHIVE' ? '' : result.learningBlock.value,
            after: target === 'ARCHIVE' ? result.archiveRecord.text : result.modelUpdate.nextValue,
            status,
            error: mutation.error,
            agentId: expectedAgentId,
            timestamp: completedAt,
          }) as MemoryChangeRecord;
        });
        if (auditRecords.length) appendChanges(...auditRecords);

        if (result.outcome === 'complete') {
          setLearningFeedbackTone('good');
          setLearningFeedback(`Learning episode archived and LEARNING_MODEL verified at “${result.episode.state}” for ${result.episode.topic}.`);
        } else if (result.outcome === 'archive_only') {
          setLearningFeedbackTone('warn');
          setLearningFeedback(`Partial persistence: evidence was archived, but LEARNING_MODEL was not updated. ${result.error}`);
        } else if (result.outcome === 'unverified') {
          setLearningFeedbackTone('warn');
          setLearningFeedback(`Persistence is unverified and is not reported as complete. ${result.error}`);
        } else {
          setLearningFeedbackTone('warn');
          setLearningFeedback(`No learning state was advanced because Archive failed. ${result.error}`);
        }
      });
    } catch (error) {
      setLearningFeedbackTone('warn');
      setLearningFeedback(`Learning episode was not saved: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (connectionSwitchGuard.current === 'learning') connectionSwitchGuard.current = 'idle';
      setLearningBusy(false);
    }
  }

  function reflectionReviewDraft(completedAt = new Date().toISOString()) {
    const hypothesisFields = [
      hypothesisStatement,
      hypothesisEvidence,
      hypothesisAlternative,
      hypothesisFalsifier,
    ];
    return {
      progress: splitLearningLines(reflectionProgress),
      learningStateChanges: splitLearningLines(reflectionLearningChanges),
      unfinishedThreads: splitLearningLines(reflectionUnfinished),
      possiblePatterns: splitLearningLines(reflectionPatterns),
      nextWeekFocus: reflectionFocus,
      connections: reflectionConnections
        .filter((item) => [item.from, item.to, item.sharedMechanism, item.importantDifference, item.futureLearningValue]
          .some((value) => value.trim()))
        .map(({ id: _id, ...item }) => item),
      hypotheses: hypothesisFields.some((value) => value.trim()) ? [{
        statement: hypothesisStatement,
        status: 'hypothesis',
        confidence: hypothesisConfidence,
        evidence: [{
          detail: hypothesisEvidence,
          source: hypothesisEvidenceSource,
          observedAt: completedAt.slice(0, 10),
        }],
        alternatives: splitLearningLines(hypothesisAlternative),
        falsifier: hypothesisFalsifier,
        userConfirmed: hypothesisConfirmed,
      }] : [],
      source: 'weekly reflection',
      provenance: 'user_confirmed_review',
      completedAt,
    };
  }

  function reflectionSuggestedChanges() {
    return ['PROFILE', 'GOALS_AND_DECISIONS', 'LEARNING_MODEL', 'CURRENT_CONTEXT']
      .map((block) => ({ block, after: reflectionProposalValues[block] ?? '' }))
      .filter((item) => item.after.trim());
  }

  function updateReflectionConnection(id: string, patch: Partial<ReflectionConnectionDraft>) {
    setReflectionConnections((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addReflectionConnection() {
    setReflectionConnections((current) => {
      if (current.length >= 3) return current;
      const nextNumber = current.reduce((highest, item) => {
        const parsed = Number(item.id.replace('connection-', ''));
        return Number.isFinite(parsed) ? Math.max(highest, parsed) : highest;
      }, 0) + 1;
      return [...current, emptyReflectionConnection(`connection-${nextNumber}`)];
    });
  }

  function removeReflectionConnection(id: string) {
    setReflectionConnections((current) => current.filter((item) => item.id !== id));
  }

  async function requestReflectionCoaching() {
    if (reflectionBusy) return;
    if (connectionSwitchGuard.current !== 'idle') {
      setReflectionFeedbackTone('warn');
      setReflectionFeedback('Weekly-review coaching is unavailable while another guarded workflow is active.');
      return;
    }
    if (!client || !agent || connection !== 'connected') {
      setConnectionError('Connect the exact Personal Co Agent before requesting weekly-review coaching.');
      setSurface('Settings');
      return;
    }
    const expectedClient = client;
    const expectedAgentId = agent.id;
    connectionSwitchGuard.current = 'reflection';
    setReflectionBusy(true);
    setReflectionCoachOutput('');
    setReflectionFeedback('');
    try {
      const prompt = buildWeeklyReviewCoachRequest(reflectionReviewDraft());
      await expectedClient.runPersistentWorkflow('weekly review coaching', async (workflow) => {
        const result = await executeWeeklyReviewCoaching({
          workflow,
          expectedAgentId,
          currentAgentId: () => currentLearningAgentId(expectedClient),
          prompt,
          language: privacy.language,
        });
        setBlocks(result.memory.blocks);
        setArchive(result.memory.archive);
        const reconciliation = result.reconciliation;
        appendChanges(createMemoryChange({
          block: 'SESSION',
          operation: 'weekly_review_coaching_reconcile',
          source: 'weekly_review',
          epistemicState: 'confirmed',
          before: reconciliation
            ? `${reconciliation.restoredBlocks.length} block and ${reconciliation.deletedArchiveIds.length} archive write(s) detected`
            : 'Memory state captured before coaching',
          after: result.outcome === 'reconciliation_failed'
            ? 'Memory reconciliation incomplete; coaching discarded'
            : 'Pre-coaching memory state restored and verified',
          status: result.outcome === 'reconciliation_failed' ? 'failed' : 'applied',
          error: result.outcome === 'reconciliation_failed' ? result.error : null,
          agentId: expectedAgentId,
        }) as MemoryChangeRecord);
        if (result.outcome === 'coached') {
          setReflectionCoachOutput(result.replies.map((reply: ChatMessage) => reply.content).join('\n\n'));
          setReflectionFeedbackTone('neutral');
          setReflectionFeedback('Assistant coaching is separate from the evidence you review and explicitly archive.');
        } else {
          setReflectionFeedbackTone('warn');
          setReflectionFeedback(`Weekly-review coaching was not accepted: ${result.error}`);
        }
      });
    } catch (error) {
      setReflectionFeedbackTone('warn');
      setReflectionFeedback(`Weekly-review coaching did not run: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (connectionSwitchGuard.current === 'reflection') connectionSwitchGuard.current = 'idle';
      setReflectionBusy(false);
    }
  }

  async function completeWeeklyReview() {
    if (reflectionBusy) return;
    if (connectionSwitchGuard.current !== 'idle') {
      setReflectionFeedbackTone('warn');
      setReflectionFeedback('The weekly review cannot be saved while another guarded workflow is active.');
      return;
    }
    if (!client || !agent || connection !== 'connected') {
      setConnectionError('Connect the exact Personal Co Agent before saving a weekly review.');
      setSurface('Settings');
      return;
    }
    const expectedClient = client;
    const expectedAgentId = agent.id;
    const completedAt = new Date().toISOString();
    connectionSwitchGuard.current = 'reflection';
    setReflectionBusy(true);
    setReflectionFeedback('');
    try {
      await expectedClient.runPersistentWorkflow('weekly review completion', async (workflow) => {
        const result = await executeWeeklyReviewPersistence({
          workflow,
          expectedAgentId,
          currentAgentId: () => currentLearningAgentId(expectedClient),
          reviewInput: reflectionReviewDraft(completedAt),
          suggestedChanges: reflectionSuggestedChanges(),
        });
        if (result.outcome !== 'unverified') {
          setBlocks(result.memory.blocks);
          setArchive(result.memory.archive);
        }
        appendChanges(...result.mutations.map((mutation) => createMemoryChange({
          block: 'ARCHIVE',
          operation: 'weekly_review_archive',
          source: 'weekly_review',
          epistemicState: 'observed',
          before: '',
          after: result.archiveRecord.text,
          status: mutation.status === 'failed' ? 'failed' : 'applied',
          error: mutation.error,
          agentId: expectedAgentId,
          timestamp: completedAt,
        }) as MemoryChangeRecord));
        if (result.outcome === 'complete') {
          if (result.proposals.length) appendChanges(...result.proposals as MemoryChangeRecord[]);
          setReflectionFeedbackTone('good');
          setReflectionFeedback(`Weekly review archived and verified. ${result.proposals.length} exact-base proposal(s) await your decision in Memory Changes.`);
        } else if (result.outcome === 'unverified') {
          setReflectionFeedbackTone('warn');
          setReflectionFeedback(`Archive persistence is unverified; no core proposal was accepted. ${result.error}`);
        } else {
          setReflectionFeedbackTone('warn');
          setReflectionFeedback(`Weekly review was not saved and no proposal was staged. ${result.error}`);
        }
      });
    } catch (error) {
      setReflectionFeedbackTone('warn');
      setReflectionFeedback(`Weekly review did not run: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (connectionSwitchGuard.current === 'reflection') connectionSwitchGuard.current = 'idle';
      setReflectionBusy(false);
    }
  }

  async function recordAgentMemoryWrites(
    before: { blocks: AgentBlock[]; archive: ArchiveItem[] },
    workflow: PersistentWorkflow,
  ) {
    if (!client || !agent) return false;
    const after = await workflow.captureAgentMemory(agent.id);
    const diff = diffAgentMemory(before, after);
    const logged: MemoryChangeRecord[] = [];
    const effectiveBlocks = [...after.blocks];

    for (const item of diff.changedBlocks) {
      const stable = item.before.label === 'PROFILE' || item.before.label === 'GOALS_AND_DECISIONS';
      const policy = POLICY_MEMORY_LABELS.includes(item.before.label);
      if (policy) {
        logged.push(createMemoryChange({
          block: item.before.label,
          operation: 'agent_write',
          source: 'agent',
          epistemicState: 'hypothesis',
          before: item.before.value,
          after: item.after.value,
          status: 'failed',
          error: 'A read-only policy block changed and requires operator review.',
        }) as MemoryChangeRecord);
        continue;
      }
      if (stable) {
        try {
          const restored = await workflow.updateBlock(item.before, item.before.value, item.before.metadata ?? null);
          const index = effectiveBlocks.findIndex((block) => block.label === restored.label);
          if (index >= 0) effectiveBlocks[index] = restored;
          logged.push(stageBlockChange({
            block: item.before.label,
            before: item.before.value,
            after: item.after.value,
            operation: 'agent_proposal',
            source: 'agent',
            epistemicState: 'inferred',
            agentId: agent.id,
            baseBlockId: item.before.id,
          }) as MemoryChangeRecord);
        } catch (error) {
          logged.push(createMemoryChange({
            block: item.before.label,
            operation: 'agent_proposal_reconcile',
            source: 'agent',
            epistemicState: 'inferred',
            before: item.before.value,
            after: item.after.value,
            status: 'failed',
            error: error instanceof Error ? error.message : 'Could not restore stable memory before review.',
          }) as MemoryChangeRecord);
        }
      } else {
        logged.push(createMemoryChange({
          block: item.before.label,
          operation: 'agent_write',
          source: 'agent',
          epistemicState: item.before.label === 'CURRENT_CONTEXT' ? 'observed' : 'inferred',
          before: item.before.value,
          after: item.after.value,
          status: 'applied',
        }) as MemoryChangeRecord);
      }
    }

    for (const item of diff.addedArchive) {
      logged.push(createMemoryChange({
        block: 'ARCHIVE',
        operation: 'add',
        source: item.source,
        epistemicState: item.epistemicState,
        before: '',
        after: item.text,
        status: 'applied',
      }) as MemoryChangeRecord);
    }
    for (const item of [...diff.removedArchive, ...diff.changedArchive.map((entry: { before: ArchiveItem }) => entry.before)]) {
      logged.push(createMemoryChange({
        block: 'ARCHIVE',
        operation: 'unexpected_mutation',
        source: 'agent',
        epistemicState: item.epistemicState,
        before: item.text,
        after: '',
        status: 'failed',
        error: 'An existing archive passage changed outside a confirmed user action.',
      }) as MemoryChangeRecord);
    }
    setBlocks(effectiveBlocks);
    setArchive(after.archive);
    if (logged.length) appendChanges(...logged);
    return logged.every((change) => change.status !== 'failed');
  }

  function startEditing(block: AgentBlock) {
    if (POLICY_MEMORY_LABELS.includes(block.label)) return;
    if (!client || !agent || !hasConnectedMemoryContext(connection, agent.id)) {
      setConnectionError('Connect your Letta server before changing persistent memory.');
      setSurface('Settings');
      return;
    }
    setClearConfirmationLabel(null);
    setEditingLabel(block.label);
    setEditValue(block.value);
  }

  async function saveBlock(block: AgentBlock) {
    if (!client || !agent || !hasConnectedMemoryContext(connection, agent.id)) {
      setEditingLabel(null);
      setConnectionError('The connection changed before this memory proposal could be staged. Reconnect and try again.');
      setSurface('Settings');
      return;
    }
    const stable = block.label === 'PROFILE' || block.label === 'GOALS_AND_DECISIONS';
    if (stable) {
      const pending = stageBlockChange({
        block: block.label,
        before: block.value,
        after: editValue.trim(),
        operation: 'correct',
        source: 'user',
        epistemicState: 'confirmed',
        agentId: agent.id,
        baseBlockId: block.id,
      }) as MemoryChangeRecord;
      appendChanges(pending);
      setEditingLabel(null);
      setSurface('Memory Changes');
    } else {
      await applyDirectBlockChange(block, editValue.trim(), 'correct');
    }
  }

  async function applyDirectBlockChange(block: AgentBlock, value: string, operation: string) {
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Persistent memory actions are paused while another guarded workflow is active.');
      return;
    }
    if (!client || !agent || !hasConnectedMemoryContext(connection, agent.id)) {
      setConnectionError('Connect your Letta server before changing persistent memory.');
      setSurface('Settings');
      return;
    }
    const authorization = authorizeMemoryUpdate(block.label, true);
    if (!authorization.allowed) return;
    const change = createMemoryChange({
      block: block.label,
      operation,
      source: 'user',
      epistemicState: 'confirmed',
      before: block.value,
      after: value,
      status: 'applied',
    }) as MemoryChangeRecord;
    try {
      const updated = await client.updateBlock(
        block,
        value,
        buildPersonalCoMetadata(block.metadata, change),
      );
      setBlocks((current) => current.map((item) => item.label === block.label ? updated : item));
      appendChanges(change);
      setEditingLabel(null);
    } catch (error) {
      const failed = { ...change, status: 'failed' as const, error: error instanceof Error ? error.message : 'Unknown error' };
      appendChanges(failed);
      setGovernanceNotice(`Memory update failed: ${failed.error ?? 'Unknown error'}`);
      setSurface('Memory Changes');
    }
  }

  async function applyPendingChange(change: MemoryChangeRecord) {
    if (change.status !== 'pending') return;
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Persistent memory actions are paused while another guarded workflow is active.');
      return;
    }
    const currentBlock = blocks.find((item) => item.label === change.block) ?? null;
    if (!client || !agent || !authorizePendingMemoryChange(change, connection, agent.id, currentBlock)) {
      setChanges((current) => current.map((item) => item.id === change.id && item.status === 'pending'
        ? transitionMemoryChange(item, 'cancelled', 'Cancelled because this proposal no longer matches the connected agent.') as MemoryChangeRecord
        : item));
      setGovernanceNotice('The pending proposal was cancelled because its connection or agent binding is no longer current.');
      return;
    }
    if (!currentBlock || !authorizeMemoryUpdate(change.block, true).allowed) return;
    const expectedClient = client;
    const expectedAgentId = agent.id;
    connectionSwitchGuard.current = 'memory_change';
    try {
      await expectedClient.runPersistentWorkflow('pending memory proposal apply', async (workflow) => {
        const result = await executePendingMemoryChange({
          workflow,
          change,
          expectedAgentId,
          currentAgentId: () => currentLearningAgentId(expectedClient),
          connection,
          metadataForUpdate: ({ block }: { block: AgentBlock }) => buildPersonalCoMetadata(block.metadata, change),
        });
        setBlocks(result.memory.blocks);
        setArchive(result.memory.archive);
        const applied = result.outcome === 'applied';
        setChanges((current) => current.map((item) => item.id === change.id
          ? transitionMemoryChange(item, result.outcome === 'cancelled' ? 'cancelled' : applied ? 'applied' : 'failed', result.error) as MemoryChangeRecord
          : item));
        setGovernanceNotice(result.outcome === 'cancelled'
          ? 'The proposal was cancelled without a write because its exact Agent or Block base is stale.'
          : applied
            ? `${change.block} proposal applied and verified against its exact base.`
            : `${change.block} proposal failed: ${result.error}`);
      });
    } catch (error) {
      setChanges((current) => current.map((item) => item.id === change.id
        ? transitionMemoryChange(item, 'failed', error instanceof Error ? error.message : 'Unknown error') as MemoryChangeRecord
        : item));
    } finally {
      if (connectionSwitchGuard.current === 'memory_change') connectionSwitchGuard.current = 'idle';
    }
  }

  function cancelPendingChange(change: MemoryChangeRecord) {
    setChanges((current) => current.map((item) => item.id === change.id
      ? transitionMemoryChange(item, 'cancelled') as MemoryChangeRecord
      : item));
  }

  function requestClearBlock(block: AgentBlock) {
    if (POLICY_MEMORY_LABELS.includes(block.label)) return;
    if (!client || !agent || !hasConnectedMemoryContext(connection, agent.id)) {
      setConnectionError('Connect your Letta server before clearing persistent memory.');
      setSurface('Settings');
      return;
    }
    setClearConfirmationLabel(block.label);
  }

  function cancelClearBlock() {
    setClearConfirmationLabel(null);
  }

  function clearBlock(block: AgentBlock) {
    if (clearConfirmationLabel !== block.label) return;
    if (!client || !agent || !hasConnectedMemoryContext(connection, agent.id)) {
      setClearConfirmationLabel(null);
      setConnectionError('The connection changed before this clear could be staged or applied. Reconnect and try again.');
      setSurface('Settings');
      return;
    }
    const stable = block.label === 'PROFILE' || block.label === 'GOALS_AND_DECISIONS';
    setClearConfirmationLabel(null);
    if (stable) {
      appendChanges(stageBlockChange({
        block: block.label,
        before: block.value,
        after: '',
        operation: 'clear',
        source: 'user',
        epistemicState: 'confirmed',
        agentId: agent.id,
        baseBlockId: block.id,
      }) as MemoryChangeRecord);
      setSurface('Memory Changes');
    } else {
      void applyDirectBlockChange(block, '', 'clear');
    }
  }

  async function refreshArchive() {
    if (!client || !agent) return;
    try {
      setArchive(await client.listArchive(agent.id, archiveSearch.trim()));
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Archive search failed.');
    }
  }

  async function previewForgetMatches() {
    setGovernanceNotice('');
    if (!client || !agent) {
      setConnectionError('Connect your Letta server before previewing a complete forget operation.');
      setSurface('Settings');
      return;
    }
    try {
      const memory = await client.captureAgentMemory(agent.id);
      setBlocks(memory.blocks);
      setArchive(memory.archive);
      setForgetPreview(createForgetPreview(forgetTerm, memory.blocks, memory.archive, agent.id));
      setForgetConfirmation('');
    } catch (error) {
      setForgetPreview(null);
      setGovernanceNotice(error instanceof Error ? error.message : 'Forget preview failed.');
    }
  }

  async function executeForget() {
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Forget is paused while another guarded workflow is active.');
      return;
    }
    if (!client || !agent) {
      setConnectionError('Connect your Letta server before forgetting persistent memory.');
      setSurface('Settings');
      return;
    }
    if (!forgetPreview || !authorizeForget(forgetPreview, forgetConfirmation, agent.id)) {
      setForgetPreview(null);
      setForgetConfirmation('');
      setGovernanceNotice('The forget preview is stale or the exact confirmation phrase does not match this agent. Preview again.');
      return;
    }
    const connectedAgentId = agent.id;
    const exactTerm = forgetPreview.exactTerm;
    const failures: string[] = [];
    const logged: MemoryChangeRecord[] = [];
    try {
      await client.runPersistentWorkflow('forget workflow', async (workflow) => {
    let freshPreview: ReturnType<typeof createForgetPreview>;
    try {
      const currentMemory = await workflow.captureAgentMemory(connectedAgentId);
      freshPreview = createForgetPreview(exactTerm, currentMemory.blocks, currentMemory.archive, connectedAgentId);
      if (!authorizeForget(freshPreview, forgetConfirmation, connectedAgentId)) {
        throw new Error('Forget confirmation is not valid for the current agent and exact term.');
      }
      setBlocks(currentMemory.blocks);
      setArchive(currentMemory.archive);
    } catch (error) {
      setForgetPreview(null);
      setForgetConfirmation('');
      setGovernanceNotice(`Forget aborted before any write: ${error instanceof Error ? error.message : 'Could not refresh current memory.'}`);
      return;
    }
    for (const block of freshPreview.blockMatches as AgentBlock[]) {
      const nextValue = removeExactTerm(block.value, exactTerm);
      const change = createMemoryChange({
        block: block.label,
        operation: 'forget',
        source: 'user',
        epistemicState: 'confirmed',
        before: block.value,
        after: nextValue,
        status: 'applied',
      }) as MemoryChangeRecord;
      try {
        await workflow.updateBlock(block, nextValue, buildPersonalCoMetadata(block.metadata, change));
        logged.push(change);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failures.push(`${block.label}: ${message}`);
        logged.push({ ...change, status: 'failed', error: message });
      }
    }
    for (const item of freshPreview.archiveMatches as ArchiveItem[]) {
      const change = createMemoryChange({
        block: 'ARCHIVE',
        operation: 'forget',
        source: 'user',
        epistemicState: item.epistemicState,
        before: item.text,
        after: '',
        status: 'applied',
      }) as MemoryChangeRecord;
      try {
        await workflow.deleteArchiveItem(connectedAgentId, item.id);
        logged.push(change);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        failures.push(`${item.id}: ${message}`);
        logged.push({ ...change, status: 'failed', error: message });
      }
    }
    appendChanges(...logged);
    let verificationPreview: ReturnType<typeof createForgetPreview> | null = null;
    try {
      const nextMemory = await workflow.captureAgentMemory(connectedAgentId);
      setBlocks(nextMemory.blocks);
      setArchive(nextMemory.archive);
      verificationPreview = createForgetPreview(exactTerm, nextMemory.blocks, nextMemory.archive, connectedAgentId);
      const remainingMatches = verificationPreview.blockMatches.length + verificationPreview.archiveMatches.length;
      if (remainingMatches) failures.push(`verification: ${remainingMatches} exact match(es) remain`);
    } catch (error) {
      failures.push(`verification could not prove absence: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setForgetConfirmation('');
    if (failures.length) {
      setForgetPreview(verificationPreview);
      setForgetTerm(exactTerm);
    } else {
      setForgetPreview(null);
      setForgetTerm('');
    }
    setGovernanceNotice(
      failures.length
        ? `Forget could not be proven complete: ${failures.join(' ')}`
        : `Forget completed for ${logged.length} exact match(es); no exact matches remain.`,
    );
      });
    } catch (error) {
      setGovernanceNotice(error instanceof Error ? error.message : 'Forget workflow could not start.');
    }
  }

  function requestArchiveDelete(item: ArchiveItem) {
    setArchiveDeleteTarget(item);
    setArchiveDeleteConfirmation('');
    setGovernanceNotice('');
  }

  async function deleteArchiveItem(item: ArchiveItem, confirmation: string) {
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Archive deletion is paused while another guarded workflow is active.');
      return;
    }
    if (!authorizeArchiveDelete(item.id, confirmation)) {
      setGovernanceNotice(`Enter the exact confirmation phrase: DELETE ${item.id}`);
      return;
    }
    if (!client || !agent) {
      setConnectionError('Connect your Letta server before deleting an archive passage.');
      setSurface('Settings');
      return;
    }
    const change = createMemoryChange({
      block: 'ARCHIVE',
      operation: 'delete',
      source: 'user',
      epistemicState: item.epistemicState,
      before: item.text,
      after: '',
      status: 'applied',
    }) as MemoryChangeRecord;
    try {
      await client.deleteArchiveItem(agent.id, item.id);
      setArchive((current) => current.filter((candidate) => candidate.id !== item.id));
      appendChanges(change);
      setArchiveDeleteTarget(null);
      setArchiveDeleteConfirmation('');
      setGovernanceNotice(`Deleted archive passage ${item.id}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      appendChanges({
        ...change,
        status: 'failed',
        error: message,
      });
      setGovernanceNotice(`Archive deletion failed for ${item.id}: ${message}`);
    }
  }

  async function archiveImports() {
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Archive import is paused while another guarded workflow is active.');
      return;
    }
    if (!client || !agent) {
      setConnectionError('Connect in Settings before committing archive candidates.');
      setSurface('Settings');
      return;
    }
    setImportBusy(true);
    const logged: MemoryChangeRecord[] = [];
    const failures: string[] = [];
    try {
      await client.runPersistentWorkflow('archive import workflow', async (workflow) => {
      const currentMemory = await workflow.captureAgentMemory(agent.id);
      setBlocks(currentMemory.blocks);
      setArchive(currentMemory.archive);
      for (const candidate of importCandidates) {
        const authorization = authorizeImportDestination(candidate, 'archive');
        if (authorization.allowed) {
          const change = createMemoryChange({
            block: 'ARCHIVE',
            operation: 'import',
            source: candidate.sourceName,
            epistemicState: candidate.epistemicState,
            before: '',
            after: candidate.content,
            status: 'applied',
          }) as MemoryChangeRecord;
          try {
            await workflow.archiveText(agent.id, candidate.content, candidate.normalizedTags);
            logged.push(change);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            failures.push(`${candidate.id}: ${message}`);
            logged.push({ ...change, status: 'failed', error: message });
          }
        }
      }
      appendChanges(...logged);
      if (!failures.length) setImportText('');
      setArchive(await workflow.listArchive(agent.id));
      setSurface('Archive');
      setGovernanceNotice(
        failures.length
          ? `Import completed with partial failures: ${failures.join(' ')}`
          : `Archived ${logged.length} reviewed candidate(s).`,
      );
      });
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImportBusy(false);
    }
  }

  async function exportSnapshot() {
    if (!client || !agent || !activeSettings) {
      setConnectionError('Connect your Letta server before exporting a snapshot.');
      setSurface('Settings');
      return;
    }
    setSnapshotBusy(true);
    setGovernanceNotice('');
    try {
      const memory = await client.captureAgentMemory(agent.id);
      const snapshot = createPortableSnapshot({
        agentId: agent.id,
        settings: { ...activeSettings, ...privacy },
        blocks: memory.blocks,
        archive: memory.archive,
      });
      setRestorePreview(null);
      setRestoreConfirmation('');
      setSnapshotText(JSON.stringify(snapshot, null, 2));
      setGovernanceNotice('Portable JSON snapshot generated. It contains no API key and does not represent a database backup.');
    } catch (error) {
      setGovernanceNotice(error instanceof Error ? error.message : 'Snapshot export failed.');
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function previewSnapshotRestore() {
    if (!client || !agent) {
      setConnectionError('Connect the target Letta agent before previewing restore.');
      setSurface('Settings');
      return;
    }
    setSnapshotBusy(true);
    try {
      const parsed = JSON.parse(snapshotText);
      const memory = await client.captureAgentMemory(agent.id);
      setRestorePreview(createRestorePreview(parsed, { agentId: agent.id, ...memory }));
      setRestoreConfirmation('');
      setGovernanceNotice('Restore preview validated against the connected agent ID.');
    } catch (error) {
      setRestorePreview(null);
      setGovernanceNotice(error instanceof Error ? error.message : 'Snapshot restore preview failed.');
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function applySnapshotRestore() {
    if (connectionSwitchGuard.current !== 'idle') {
      setGovernanceNotice('Snapshot restore is paused while another guarded workflow is active.');
      return;
    }
    if (!client || !agent || !restorePreview) return;
    if (!authorizeSnapshotRestore(restorePreview, restoreConfirmation, agent.id)) {
      setRestorePreview(null);
      setRestoreConfirmation('');
      setGovernanceNotice('The restore preview is stale or the exact confirmation phrase does not match this agent. Preview again.');
      return;
    }
    const connectedAgentId = agent.id;
    setSnapshotBusy(true);
    const failures: string[] = [];
    const logged: MemoryChangeRecord[] = [];
    let parsedSnapshot: unknown;
    try {
      await client.runPersistentWorkflow('snapshot restore workflow', async (workflow) => {
      let freshPreview: ReturnType<typeof createRestorePreview>;
      try {
        parsedSnapshot = JSON.parse(snapshotText);
        const currentMemory = await workflow.captureAgentMemory(connectedAgentId);
        freshPreview = createRestorePreview(parsedSnapshot, { agentId: connectedAgentId, ...currentMemory });
        if (!authorizeSnapshotRestore(freshPreview, restoreConfirmation, connectedAgentId)) {
          throw new Error('Restore confirmation is not valid for the current snapshot and agent.');
        }
        setBlocks(currentMemory.blocks);
        setArchive(currentMemory.archive);
      } catch (error) {
        setRestorePreview(null);
        setRestoreConfirmation('');
        setGovernanceNotice(`Restore aborted before any write: ${error instanceof Error ? error.message : 'Could not refresh and validate the snapshot.'}`);
        return;
      }

      for (const item of freshPreview.blockChanges as Array<{ before: AgentBlock; after: AgentBlock }>) {
        const change = createMemoryChange({
          block: item.after.label,
          operation: 'restore',
          source: 'snapshot_restore',
          epistemicState: 'confirmed',
          before: item.before?.value ?? '',
          after: item.after.value,
          status: 'applied',
        }) as MemoryChangeRecord;
        try {
          if (!item.before) throw new Error(`Connected agent is missing ${item.after.label}.`);
          await workflow.updateBlock(
            item.before,
            item.after.value,
            buildPersonalCoMetadata(item.after.metadata, change),
          );
          logged.push(change);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          failures.push(`${item.after.label}: ${message}`);
          logged.push({ ...change, status: 'failed', error: message });
        }
      }

      for (const item of freshPreview.archiveAdds as ArchiveItem[]) {
        const change = createMemoryChange({
          block: 'ARCHIVE',
          operation: 'restore_add',
          source: 'snapshot_restore',
          epistemicState: item.epistemicState ?? 'observed',
          before: '',
          after: item.text,
          status: 'applied',
        }) as MemoryChangeRecord;
        try {
          await workflow.archiveText(connectedAgentId, item.text, item.tags, item.createdAt);
          logged.push(change);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          failures.push(`archive ${item.id}: ${message}`);
          logged.push({ ...change, status: 'failed', error: message });
        }
      }
      appendChanges(...logged);

      let verificationPreview: ReturnType<typeof createRestorePreview> | null = null;
      try {
        const memory = await workflow.captureAgentMemory(connectedAgentId);
        setBlocks(memory.blocks);
        setArchive(memory.archive);
        verificationPreview = createRestorePreview(parsedSnapshot, { agentId: connectedAgentId, ...memory });
        const remainingChanges = verificationPreview.blockChanges.length + verificationPreview.archiveAdds.length;
        if (remainingChanges) failures.push(`verification: ${remainingChanges} restore change(s) remain`);
      } catch (error) {
        failures.push(`verification could not prove restore completion: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      setRestoreConfirmation('');
      setRestorePreview(failures.length ? verificationPreview : null);
      setGovernanceNotice(
        failures.length
          ? `Restore could not be proven complete: ${failures.join(' ')}`
          : 'Restore applied to this same agent and verified; no planned changes remain.',
      );
      });
    } catch (error) {
      setGovernanceNotice(error instanceof Error ? error.message : 'Restore workflow could not start.');
    } finally {
      setSnapshotBusy(false);
    }
  }

  const statusLabel = reflectionBusy
    ? '正在复盘'
    : learningBusy
    ? '正在学习'
    : modelSwitchState === 'switching'
    ? '正在切换模型'
    : modelSwitchState === 'rollback_locked'
      ? '写入已锁定'
      : connection === 'connected'
        ? '已连接'
        : connection === 'connecting'
          ? '连接中'
          : connection === 'error'
            ? '连接需检查'
            : '尚未连接';
  const persistentWritesPaused = sending || learningBusy
    || reflectionBusy
    || modelSwitchState !== 'idle'
    || connectionSwitchGuard.current !== 'idle';
  const memoryControlsDisabled = persistentWritesPaused
    || !client
    || !agent
    || !hasConnectedMemoryContext(connection, agent.id);
  const primarySurface = primaryForSurface(surface);
  const surfaceLabel = surface === 'Settings' ? '连接与设置' : surface === 'Today' ? '今天' : SECONDARY_SECTIONS.find((item) => item.surface === surface)?.label;
  const pendingChanges = changes.filter((change) => change.status === 'pending' && change.agentId === agent?.id);
  const failedDecision = changes.find((change) => change.status === 'failed' && change.agentId === agent?.id);

  function pendingDecisionCards() {
    return pendingChanges.map((change) => {
      const disabled = memoryControlsDisabled || !authorizePendingMemoryChange(change, connection, agent?.id ?? '', blocks.find((item) => item.label === change.block) ?? null);
      return (
        <View key={change.id} style={styles.changeItem}>
          <View style={styles.cardHeader}><Text style={styles.sectionTitle}>要记住这项变化吗？</Text><Pill tone="warn">待确认</Pill></View>
          <Text style={styles.changeMeta}>{change.block.replaceAll('_', ' ')} · {change.source} · {new Date(change.timestamp).toLocaleString()}</Text>
          <View style={styles.changeSummaryRow}>
            <View style={styles.changeSummary}><Text style={styles.changeSummaryLabel}>原来的内容</Text><Text style={styles.changeSummaryText}>{change.before || '（空）'}</Text></View>
            <View style={styles.changeSummary}><Text style={styles.changeSummaryLabel}>准备保存</Text><Text style={styles.changeSummaryText}>{change.after || '（清空）'}</Text></View>
          </View>
          <View style={styles.cardActions}>
            <Pressable accessibilityRole="button" onPress={() => cancelPendingChange(change)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>不保存</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={disabled} onPress={() => void applyPendingChange(change)} style={[styles.primaryButton, disabled && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>确认保存</Text></Pressable>
          </View>
          {disabled && <Text style={styles.fieldHelp}>当前暂不能保存，请等待操作完成；连接或原内容变化后需重新准备变更。</Text>}
        </View>
      );
    });
  }

  return (
    <View style={styles.app}>
      {!compact && (
        <View style={styles.sidebar}>
          <View>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>PC</Text></View>
            <Text style={styles.brand}>Personal Co</Text>
            <Text style={styles.brandTagline}>陪你理清思路，记住重要的事。</Text>
          </View>
          <View style={styles.nav}>
            {PRIMARY_SECTIONS.map((item) => (
              <Pressable accessibilityRole="button" accessibilityState={{ selected: primarySurface === item.surface }} key={item.surface} onPress={() => setSurface(item.surface as Surface)} style={[styles.navItem, primarySurface === item.surface && styles.navItemActive]}>
                <Text style={[styles.navSymbol, primarySurface === item.surface && styles.navTextActive]}>{item.symbol}</Text>
                <View style={styles.flexible}><Text style={[styles.navLabel, primarySurface === item.surface && styles.navTextActive]}>{item.label}</Text><Text style={styles.navHint}>{item.hint}</Text></View>
              </Pressable>
            ))}
          </View>
          <View style={styles.sidebarFooter}>
            <View style={[styles.statusDot, connection === 'connected' && modelSwitchState === 'idle' && !learningBusy && !reflectionBusy && styles.statusDotGood, (connection === 'error' || modelSwitchState === 'rollback_locked') && styles.statusDotError]} />
            <View><Text style={styles.statusLabel}>{statusLabel}</Text><Text style={styles.statusMeta}>personal-co-v1</Text></View>
          </View>
        </View>
      )}

      <View style={styles.main}>
          <View style={styles.mobileHeader}>
            <View style={styles.flexible}><Text style={styles.mobileBrand}>{compact ? 'Personal Co' : surfaceLabel}</Text><Text style={styles.mobileSurface}>{compact ? surfaceLabel : '你的随身思考伙伴'}</Text></View>
            <Pill tone={connection === 'connected' && modelSwitchState === 'idle' && !learningBusy && !reflectionBusy ? 'good' : connection === 'error' || modelSwitchState === 'rollback_locked' ? 'warn' : 'neutral'}>{statusLabel}</Pill>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: surface === 'Settings' }} onPress={() => setSurface('Settings')} style={[styles.presetButton, surface === 'Settings' && styles.presetButtonActive]}><Text style={styles.presetButtonText}>设置</Text></Pressable>
          </View>
        <ScrollView contentContainerStyle={[styles.content, compact && styles.compactContent]} keyboardShouldPersistTaps="handled">
          {primarySurface !== 'Today' && surface !== 'Settings' && (
            <View style={[styles.surface, styles.secondaryNav]}>
              {SECONDARY_SECTIONS.filter((item) => item.primary === primarySurface).map((item) => (
                <Pressable key={item.surface} accessibilityRole="button" accessibilityState={{ selected: surface === item.surface }} onPress={() => setSurface(item.surface as Surface)} style={[styles.presetButton, surface === item.surface && styles.presetButtonActive]}><Text style={styles.presetButtonText}>{item.label}</Text></Pressable>
              ))}
            </View>
          )}
          {surface === 'Chat' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="对话" title="今天，想从哪件事开始？" copy="把问题、想法或最近的进展告诉我。我们可以一起理清下一步。" />
              {connection !== 'connected' && <View style={styles.connectionCard}><Text style={styles.sectionTitle}>{connection === 'connecting' ? '正在接通你的助手…' : '先接通你的助手'}</Text><Text style={styles.subtitle}>连接后才会发送消息和读取真实记忆。现在也可以先写草稿。</Text><Pressable accessibilityRole="button" onPress={() => setSurface('Settings')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>打开连接设置</Text></Pressable></View>}
              <View style={styles.secondaryNav}>{PROMPT_STARTERS.map((prompt) => <Pressable key={prompt} accessibilityRole="button" disabled={sending || Boolean(draft.trim())} onPress={() => setDraft((current) => preparePromptDraft(current, prompt))} style={[styles.presetButton, (sending || Boolean(draft.trim())) && styles.buttonDisabled]}><Text style={styles.presetButtonText}>{prompt}</Text></Pressable>)}</View>
              {sendFeedback ? <View style={styles.errorBox}><Text style={styles.errorText}>{sendFeedback}</Text><Pressable accessibilityRole="button" onPress={() => setSurface('Settings')} style={styles.secondaryButton}><Text style={styles.textButtonText}>查看连接设置</Text></Pressable></View> : null}
              {connectionError ? <View style={styles.errorBox}><Text style={styles.errorText}>连接未完成：{connectionError}</Text><Pressable accessibilityRole="button" onPress={() => setSurface('Settings')} style={styles.secondaryButton}><Text style={styles.textButtonText}>检查配置并重试</Text></Pressable></View> : null}
              <View style={styles.chatPanel}>
                <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
                  {messages.length === 0 && <Text style={styles.emptyCopy}>{connection === 'connected' ? '这里还没有对话。说说你正在想的事吧。' : '接通后会在这里显示真实对话。'}</Text>}
                  {messages.map((message) => (
                    <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.messageRowUser]}>
                      <View style={[styles.avatar, message.role === 'user' && styles.avatarUser]}><Text style={styles.avatarText}>{message.role === 'user' ? 'YOU' : 'CO'}</Text></View>
                      <View style={[styles.messageBubble, message.role === 'user' && styles.messageBubbleUser]}>
                        <Text style={styles.messageRole}>{message.role === 'user' ? '你' : 'Personal Co'}</Text>
                        <Text style={styles.messageText}>{message.content}</Text>
                      </View>
                    </View>
                  ))}
                  {sending && <ActivityIndicator color="#684df4" style={{ alignSelf: 'flex-start' }} />}
                </ScrollView>
                <View style={styles.composer}>
                  <TextInput accessibilityLabel="对话草稿" editable={!sending} value={draft} onChangeText={setDraft} placeholder="说说你想做的事…" placeholderTextColor="#8d8a9b" multiline style={styles.composerInput} onSubmitEditing={() => void sendMessage()} />
                  <Pressable accessibilityRole="button" onPress={() => void sendMessage()} style={[styles.sendButton, (!draft.trim() || sending || persistentWritesPaused) && styles.buttonDisabled]} disabled={!draft.trim() || sending || persistentWritesPaused}><Text style={styles.sendButtonText}>{sending ? '处理中' : '发送 ↑'}</Text></Pressable>
                </View>
              </View>
              <View style={styles.policyStrip}><Text style={styles.policyStripTitle}>{privacy.temporarySession ? '临时对话已开启' : '重要变化由你确认'}</Text><Text style={styles.policyStripCopy}>你可以在设置中管理隐私；长期画像和目标的变化会先请你确认。</Text></View>
              {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
              {pendingChanges.length > 0 && <View style={styles.pendingList}><Text style={styles.sectionTitle}>需要你决定 · {pendingChanges.length}</Text>{pendingDecisionCards()}</View>}
              {failedDecision && <View style={styles.errorBox}><Text style={styles.errorText}>有一项记忆操作未完成：{failedDecision.error}</Text></View>}
              {changes.length > 0 && <Pressable accessibilityRole="button" onPress={() => setSurface('Memory Changes')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>查看全部变更与处理结果</Text></Pressable>}
            </View>
          )}

          {surface === 'Today' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="今天" title="把重要的事放在眼前。" copy="这里先汇集本次打开期间需要你确认的记忆变化。" />
              {connection !== 'connected' && <View style={styles.connectionCard}><Text style={styles.subtitle}>尚未连接，无法核对助手的最新内容。</Text><Pressable accessibilityRole="button" onPress={() => setSurface('Settings')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>打开连接设置</Text></Pressable></View>}
              {pendingChanges.length ? <View style={styles.changeList}><Text style={styles.sectionTitle}>需要你决定 · {pendingChanges.length}</Text>{pendingDecisionCards()}</View> : <EmptyState symbol="◎" title={connection === 'connected' ? '本次打开还没有待确认变化' : '连接后再查看待确认变化'} copy="待确认变化只保留在本次页面会话中；这里还不是持久待办清单，也不会发送后台提醒。" />}
              {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
              {failedDecision && <View style={styles.errorBox}><Text style={styles.errorText}>有一项记忆操作未完成：{failedDecision.error}</Text></View>}
              {changes.length > 0 && <Pressable accessibilityRole="button" onPress={() => setSurface('Memory Changes')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>查看全部变更与处理结果</Text></Pressable>}
              <View style={styles.policyStrip}><Text style={styles.policyStripCopy}>持久待办、改期和关闭应用后的提醒尚未接通。当前可查看已有目标、回顾进展或继续聊天。</Text></View>
              <View style={styles.secondaryNav}>
                <Pressable accessibilityRole="button" onPress={() => setSurface('Chat')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>继续对话</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setSurface('Core Memory')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>查看目标与近况</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={() => setSurface('Reflection')} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>回顾本周</Text></Pressable>
              </View>
            </View>
          )}

          {surface === 'Learning' && (
            <View style={styles.surface}>
              <SurfaceTitle
                eyebrow="GUIDED LEARNING"
                title="Learn with evidence, not exposure."
                copy="Personal Co diagnoses first, explains structure before detail, asks you to demonstrate understanding, then archives the episode before updating one concept in LEARNING_MODEL."
              />
              <View style={styles.learningStages}>
                {LEARNING_STAGES.map((stage: string, index: number) => (
                  <View key={stage} style={styles.learningStage}>
                    <Text style={styles.learningStageNumber}>{index + 1}</Text>
                    <Text style={styles.learningStageLabel}>{stage.replaceAll('_', ' ')}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.learningGrid}>
                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>1 · Input and goal</Text>
                  <Text style={styles.fieldHelp}>Name one concept and what you want to be able to do with it.</Text>
                  <Text style={styles.fieldLabel}>Topic</Text>
                  <TextInput editable={!learningBusy} value={learningTopic} onChangeText={setLearningTopic} placeholder="Bayesian updating" placeholderTextColor="#9693a3" style={[styles.fieldInput, learningBusy && styles.buttonDisabled]} />
                  <Text style={styles.fieldLabel}>Source</Text>
                  <TextInput editable={!learningBusy} value={learningSource} onChangeText={setLearningSource} placeholder="Book, course, conversation…" placeholderTextColor="#9693a3" style={[styles.fieldInput, learningBusy && styles.buttonDisabled]} />
                  <Text style={styles.fieldLabel}>Learning goal</Text>
                  <TextInput editable={!learningBusy} value={learningGoal} onChangeText={setLearningGoal} placeholder="What should you be able to explain or apply?" placeholderTextColor="#9693a3" style={[styles.fieldInput, learningBusy && styles.buttonDisabled]} />
                </View>

                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>2 · Diagnose before explaining</Text>
                  <Text style={styles.fieldHelp}>One question per line. Personal Co permits one to three unique diagnosis questions.</Text>
                  <TextInput editable={!learningBusy} value={learningDiagnosticQuestions} onChangeText={setLearningDiagnosticQuestions} multiline placeholder="What do you already understand?" placeholderTextColor="#9693a3" style={[styles.compactTextArea, learningBusy && styles.buttonDisabled]} />
                  <Pressable disabled={learningBusy || memoryControlsDisabled} onPress={() => void requestLearningCoaching('diagnosis')} style={[styles.secondaryOutlineButton, (learningBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.secondaryOutlineText}>Ask diagnostic coach</Text></Pressable>
                  <Text style={styles.fieldLabel}>Your diagnostic response</Text>
                  <TextInput editable={!learningBusy} value={learningDiagnosticResponse} onChangeText={setLearningDiagnosticResponse} multiline placeholder="Answer in your own words before requesting an explanation." placeholderTextColor="#9693a3" style={[styles.learningTextArea, learningBusy && styles.buttonDisabled]} />
                </View>

                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>3 · Structure, then detail</Text>
                  <Text style={styles.fieldHelp}>Record the explanation you actually used. Assistant coaching remains separate below.</Text>
                  <Pressable disabled={learningBusy || memoryControlsDisabled} onPress={() => void requestLearningCoaching('explanation')} style={[styles.secondaryOutlineButton, (learningBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.secondaryOutlineText}>Request structured explanation</Text></Pressable>
                  <TextInput editable={!learningBusy} value={learningExplanation} onChangeText={setLearningExplanation} multiline placeholder="First the map; then only the detail needed for your goal." placeholderTextColor="#9693a3" style={[styles.learningTextArea, learningBusy && styles.buttonDisabled]} />
                </View>

                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>4 · Verify understanding</Text>
                  <Text style={styles.fieldLabel}>Verification method</Text>
                  <View style={styles.presetRow}>
                    {VERIFICATION_MODES.map((mode: string) => (
                      <Pressable key={mode} disabled={learningBusy} onPress={() => setLearningVerificationMode(mode)} style={[styles.presetButton, learningVerificationMode === mode && styles.presetButtonActive, learningBusy && styles.buttonDisabled]}><Text style={styles.presetButtonText}>{mode}</Text></Pressable>
                    ))}
                  </View>
                  <Pressable disabled={learningBusy || memoryControlsDisabled} onPress={() => void requestLearningCoaching('verification')} style={[styles.secondaryOutlineButton, (learningBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.secondaryOutlineText}>Prepare verification prompt</Text></Pressable>
                  <Text style={styles.fieldLabel}>Evidence kind</Text>
                  <View style={styles.presetRow}>
                    {EVIDENCE_KINDS.map((kind: string) => (
                      <Pressable key={kind} disabled={learningBusy} onPress={() => setLearningEvidenceKind(kind)} style={[styles.presetButton, learningEvidenceKind === kind && styles.presetButtonActive, learningBusy && styles.buttonDisabled]}><Text style={styles.presetButtonText}>{kind.replaceAll('_', ' ')}</Text></Pressable>
                    ))}
                  </View>
                  <Text style={styles.fieldLabel}>Observed evidence detail</Text>
                  <TextInput editable={!learningBusy} value={learningEvidenceDetail} onChangeText={setLearningEvidenceDetail} multiline placeholder="What did you explain, compare, apply, transfer, or fail to retrieve?" placeholderTextColor="#9693a3" style={[styles.learningTextArea, learningBusy && styles.buttonDisabled]} />
                  <View style={styles.statePreview}>
                    <Text style={styles.statePreviewLabel}>Derived state</Text>
                    <Text style={styles.statePreviewValue}>{learningDerivedState ?? 'Needs valid evidence'}</Text>
                    <Text style={styles.fieldHelp}>Reading stops at exposed; practice at developing; only application or transfer reaches usable. Contradiction, failed retrieval, or time decay requires review.</Text>
                  </View>
                </View>

                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>5 · Evidence for memory</Text>
                  <Text style={styles.fieldLabel}>Misconceptions corrected <Text style={styles.optional}>(one per line)</Text></Text>
                  <TextInput editable={!learningBusy} value={learningMisconceptions} onChangeText={setLearningMisconceptions} multiline placeholder="What was initially wrong or incomplete?" placeholderTextColor="#9693a3" style={[styles.learningTextArea, learningBusy && styles.buttonDisabled]} />
                  <Text style={styles.fieldHelp}>The completed record is stored as quoted learning_episode evidence. User fields are never treated as executable instructions.</Text>
                </View>

                <View style={[styles.card, styles.learningCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>6 · Retrieval plan</Text>
                  <Text style={styles.fieldHelp}>At most three unique, high-value review questions; one per line.</Text>
                  <TextInput editable={!learningBusy} value={learningRetrievalQuestions} onChangeText={setLearningRetrievalQuestions} multiline placeholder={'What would falsify this idea?\nWhen should I use it?'} placeholderTextColor="#9693a3" style={[styles.learningTextArea, learningBusy && styles.buttonDisabled]} />
                  <Pressable disabled={learningBusy || memoryControlsDisabled} onPress={() => void completeLearningEpisode()} style={[styles.primaryButton, styles.learningCompleteButton, (learningBusy || memoryControlsDisabled) && styles.buttonDisabled]}>
                    {learningBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Archive evidence & update learning model</Text>}
                  </Pressable>
                  <Text style={styles.fieldHelp}>All fields and the exact server Block limit are checked before Archive. Archive is written before LEARNING_MODEL; partial persistence is reported explicitly.</Text>
                </View>
              </View>

              <View style={styles.learningCoachPanel}>
                <View style={styles.cardHeader}><Text style={styles.sectionTitle}>Assistant coaching</Text><Pill>not evidence</Pill></View>
                <Text style={styles.fieldHelp}>Coaching requests no memory writes and is shown only after memory reconciliation succeeds. It never auto-fills verification evidence.</Text>
                <Text style={styles.learningCoachText}>{learningCoachOutput || 'Request diagnosis, explanation, or verification coaching when connected.'}</Text>
              </View>
              {learningFeedback ? (
                <View style={learningFeedbackTone === 'warn' ? styles.errorBox : styles.noticeBox}>
                  <Text style={learningFeedbackTone === 'warn' ? styles.errorText : styles.noticeText}>{learningFeedback}</Text>
                </View>
              ) : null}
            </View>
          )}

          {surface === 'Reflection' && (
            <View style={styles.surface}>
              <SurfaceTitle
                eyebrow="WEEKLY REFLECTION"
                title="Turn evidence into a careful next step."
                copy="Create a review only when you choose. Connections stay explanatory, hypotheses stay falsifiable, and every core-memory suggestion waits for a separate Apply decision."
              />
              <View style={styles.learningStages}>
                {WEEKLY_REVIEW_SECTIONS.map((section: string, index: number) => (
                  <View key={section} style={styles.learningStage}>
                    <Text style={styles.learningStageNumber}>{index + 1}</Text>
                    <Text style={styles.learningStageLabel}>{section.replaceAll('_', ' ')}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.reflectionGrid}>
                <View style={[styles.card, styles.reflectionCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>The exact five-section review</Text>
                  <Text style={styles.fieldHelp}>Use one evidence item per line. The next-week focus is one nonblank focus, not an automatic task.</Text>
                  <Text style={styles.fieldLabel}>1 · Progress</Text>
                  <TextInput editable={!reflectionBusy} value={reflectionProgress} onChangeText={setReflectionProgress} multiline placeholder="What moved forward?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>2 · Learning-state changes</Text>
                  <TextInput editable={!reflectionBusy} value={reflectionLearningChanges} onChangeText={setReflectionLearningChanges} multiline placeholder="What became exposed, developing, usable, or needs review?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>3 · Unfinished threads</Text>
                  <TextInput editable={!reflectionBusy} value={reflectionUnfinished} onChangeText={setReflectionUnfinished} multiline placeholder="What remains open?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>4 · Possible patterns</Text>
                  <TextInput editable={!reflectionBusy} value={reflectionPatterns} onChangeText={setReflectionPatterns} multiline placeholder="Possible, not proven, patterns" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>5 · One next-week focus</Text>
                  <TextInput editable={!reflectionBusy} value={reflectionFocus} onChangeText={setReflectionFocus} placeholder="One concrete focus" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                </View>

                <View style={[styles.card, styles.reflectionCard, compact && styles.compactLearningCard]}>
                  <View style={styles.cardHeader}><Text style={styles.sectionTitle}>Cross-domain connections</Text><Pill>optional · max 3</Pill></View>
                  <Text style={styles.fieldHelp}>A connection must explain both a shared mechanism and an important boundary, plus why it helps future learning.</Text>
                  {reflectionConnections.map((connectionDraft, index) => (
                    <View key={connectionDraft.id} style={styles.previewBox}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardLabel}>Connection {index + 1}</Text>
                        <Pressable disabled={reflectionBusy} onPress={() => removeReflectionConnection(connectionDraft.id)} style={[styles.secondaryButton, reflectionBusy && styles.buttonDisabled]}><Text style={styles.dangerButtonText}>Remove</Text></Pressable>
                      </View>
                      <View style={styles.presetRow}>
                        {CONNECTION_TYPES.map((relationship: string) => (
                          <Pressable key={relationship} disabled={reflectionBusy} onPress={() => updateReflectionConnection(connectionDraft.id, { relationship })} style={[styles.presetButton, connectionDraft.relationship === relationship && styles.presetButtonActive]}><Text style={styles.presetButtonText}>{relationship}</Text></Pressable>
                        ))}
                      </View>
                      <Text style={styles.fieldLabel}>From concept or domain</Text>
                      <TextInput editable={!reflectionBusy} value={connectionDraft.from} onChangeText={(from) => updateReflectionConnection(connectionDraft.id, { from })} placeholder="Bayesian updating" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                      <Text style={styles.fieldLabel}>To a distinct concept or domain</Text>
                      <TextInput editable={!reflectionBusy} value={connectionDraft.to} onChangeText={(to) => updateReflectionConnection(connectionDraft.id, { to })} placeholder="Project risk" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                      <Text style={styles.fieldLabel}>Shared mechanism</Text>
                      <TextInput editable={!reflectionBusy} value={connectionDraft.sharedMechanism} onChangeText={(sharedMechanism) => updateReflectionConnection(connectionDraft.id, { sharedMechanism })} multiline placeholder="What mechanism genuinely connects them?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                      <Text style={styles.fieldLabel}>Important difference or boundary</Text>
                      <TextInput editable={!reflectionBusy} value={connectionDraft.importantDifference} onChangeText={(importantDifference) => updateReflectionConnection(connectionDraft.id, { importantDifference })} multiline placeholder="Where does the analogy stop working?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                      <Text style={styles.fieldLabel}>Future-learning value</Text>
                      <TextInput editable={!reflectionBusy} value={connectionDraft.futureLearningValue} onChangeText={(futureLearningValue) => updateReflectionConnection(connectionDraft.id, { futureLearningValue })} multiline placeholder="How will this connection improve a future learning task?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                    </View>
                  ))}
                  <Pressable disabled={reflectionBusy || reflectionConnections.length >= 3} onPress={addReflectionConnection} style={[styles.secondaryOutlineButton, (reflectionBusy || reflectionConnections.length >= 3) && styles.buttonDisabled]}><Text style={styles.secondaryOutlineText}>Add connection ({reflectionConnections.length}/3)</Text></Pressable>
                </View>

                <View style={[styles.card, styles.reflectionCard, compact && styles.compactLearningCard]}>
                  <View style={styles.cardHeader}><Text style={styles.sectionTitle}>Growth hypothesis</Text><Pill tone="warn">not a trait</Pill></View>
                  <Text style={styles.fieldHelp}>Confirmation records your judgment in Archive evidence. It never promotes a personality label automatically.</Text>
                  <Text style={styles.fieldLabel}>Falsifiable statement</Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisStatement} onChangeText={setHypothesisStatement} multiline placeholder="Written briefs may improve my decision quality." placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>Confidence from 0 to 1</Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisConfidence} onChangeText={setHypothesisConfidence} keyboardType="decimal-pad" placeholder="0.5" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                  <Text style={styles.fieldLabel}>Observed evidence</Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisEvidence} onChangeText={setHypothesisEvidence} multiline placeholder="What happened, without interpretation?" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>Evidence source</Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisEvidenceSource} onChangeText={setHypothesisEvidenceSource} placeholder="Weekly project log" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                  <Text style={styles.fieldLabel}>Alternative explanation <Text style={styles.optional}>(one per line)</Text></Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisAlternative} onChangeText={setHypothesisAlternative} multiline placeholder="The projects may simply have been smaller." placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Text style={styles.fieldLabel}>What would falsify it?</Text>
                  <TextInput editable={!reflectionBusy} value={hypothesisFalsifier} onChangeText={setHypothesisFalsifier} multiline placeholder="A concrete observation that would count against it" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <Pressable disabled={reflectionBusy} onPress={() => setHypothesisConfirmed((current) => !current)} style={[styles.presetButton, hypothesisConfirmed && styles.presetButtonActive]}><Text style={styles.presetButtonText}>{hypothesisConfirmed ? 'User confirmed: true' : 'User confirmed: false'}</Text></Pressable>
                </View>

                <View style={[styles.card, styles.reflectionCard, compact && styles.compactLearningCard]}>
                  <View style={styles.cardHeader}><Text style={styles.sectionTitle}>Optional core proposals</Text><Pill>confirmation only</Pill></View>
                  <Text style={styles.fieldHelp}>Nonblank values are prepared only after the Archive record is verified. Each proposal is bound to the exact current Agent, Block ID, and base value.</Text>
                  {['PROFILE', 'GOALS_AND_DECISIONS', 'LEARNING_MODEL', 'CURRENT_CONTEXT'].map((label) => (
                    <View key={label}>
                      <Text style={styles.fieldLabel}>{label.replaceAll('_', ' ')}</Text>
                      <TextInput
                        editable={!reflectionBusy}
                        value={reflectionProposalValues[label] ?? ''}
                        onChangeText={(value) => setReflectionProposalValues((current) => ({ ...current, [label]: value }))}
                        multiline
                        placeholder={label === 'LEARNING_MODEL' ? 'Leave blank when using the connection above.' : 'Leave blank for no proposal.'}
                        placeholderTextColor="#9693a3"
                        style={styles.compactTextArea}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.reflectionActions}>
                <Pressable disabled={reflectionBusy || memoryControlsDisabled} onPress={() => void requestReflectionCoaching()} style={[styles.secondaryOutlineButton, (reflectionBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.secondaryOutlineText}>Request read-only coaching</Text></Pressable>
                <Pressable disabled={reflectionBusy || memoryControlsDisabled} onPress={() => void completeWeeklyReview()} style={[styles.primaryButton, (reflectionBusy || memoryControlsDisabled) && styles.buttonDisabled]}>{reflectionBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Archive this weekly review</Text>}</Pressable>
              </View>
              <Text style={styles.fieldHelp}>Nothing runs on a timer. Only the explicit button above creates a weekly-review episode, and completion performs no Block write.</Text>
              <View style={styles.learningCoachPanel}>
                <View style={styles.cardHeader}><Text style={styles.sectionTitle}>Assistant coaching</Text><Pill>not evidence</Pill></View>
                <Text style={styles.learningCoachText}>{reflectionCoachOutput || 'Request coaching only after filling the review you want the assistant to discuss.'}</Text>
              </View>
              {reflectionFeedback ? (
                <View style={reflectionFeedbackTone === 'warn' ? styles.errorBox : styles.noticeBox}>
                  <Text style={reflectionFeedbackTone === 'warn' ? styles.errorText : styles.noticeText}>{reflectionFeedback}</Text>
                </View>
              ) : null}
            </View>
          )}

          {surface === 'Core Memory' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="记忆" title="记住重要的，也允许改变。" copy="查看关于你的资料、正在关注的事和学习进展。发现不准确的内容，可以纠正或提出忘记请求。" />
              <View style={styles.memoryGrid}>
                {ALL_MEMORY_LABELS.map((label) => {
                  const block = blocks.find((item) => item.label === label) ?? { label, value: 'Not returned by server.' };
                  const readOnly = POLICY_MEMORY_LABELS.includes(label);
                  const editing = editingLabel === label;
                  return (
                    <View key={label} style={[styles.card, readOnly && styles.policyCard]}>
                      <View style={styles.cardHeader}><Text style={styles.cardLabel}>{label.replaceAll('_', ' ')}</Text><Pill tone={readOnly ? 'neutral' : 'good'}>{readOnly ? 'Read only' : 'Writable'}</Pill></View>
                      {editing ? <TextInput value={editValue} onChangeText={setEditValue} multiline style={styles.memoryInput} /> : <Text style={styles.cardBody} numberOfLines={readOnly ? 8 : undefined}>{block.value}</Text>}
                      {block.metadata?.personal_co != null && typeof block.metadata.personal_co === 'object' && (
                        <Text style={styles.metadataLine}>
                          {String((block.metadata.personal_co as Record<string, unknown>).source ?? 'unknown')} • {String((block.metadata.personal_co as Record<string, unknown>).epistemic_state ?? 'unknown')} • {String((block.metadata.personal_co as Record<string, unknown>).updated_at ?? '')}
                        </Text>
                      )}
                      {!readOnly && (
                        <>
                          {clearConfirmationLabel === label && !editing && (
                            <View style={styles.confirmationBox}>
                              <Text style={styles.confirmationTitle}>Clear {label.replaceAll('_', ' ')}?</Text>
                              <Text style={styles.confirmationCopy}>
                                {label === 'PROFILE' || label === 'GOALS_AND_DECISIONS'
                                  ? 'This clear will remain pending until you explicitly apply it from Memory Changes.'
                                  : 'This will immediately replace the entire writable block with an empty value and record the confirmed change.'}
                              </Text>
                              <View style={styles.confirmationActions}>
                                <Pressable onPress={cancelClearBlock} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
                                <Pressable disabled={memoryControlsDisabled} onPress={() => clearBlock(block)} style={[styles.destructiveConfirmButton, memoryControlsDisabled && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{label === 'PROFILE' || label === 'GOALS_AND_DECISIONS' ? 'Stage clear' : 'Clear block'}</Text></Pressable>
                              </View>
                            </View>
                          )}
                          <View style={styles.cardActions}>
                            {editing && <Pressable onPress={() => setEditingLabel(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>}
                            {!editing && clearConfirmationLabel !== label && <Pressable disabled={memoryControlsDisabled} onPress={() => requestClearBlock(block)} style={[styles.secondaryButton, memoryControlsDisabled && styles.buttonDisabled]}><Text style={styles.dangerButtonText}>Clear</Text></Pressable>}
                            <Pressable disabled={memoryControlsDisabled} onPress={() => editing ? void saveBlock(block) : startEditing(block)} style={[styles.textButton, memoryControlsDisabled && styles.buttonDisabled]}><Text style={styles.textButtonText}>{editing ? 'Stage / apply' : 'Edit / correct'} →</Text></Pressable>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {surface === 'Memory Changes' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="MEMORY CHANGES" title="Review, apply, cancel, or forget." copy="Stable memory waits for your Apply action. Every session change records its source, epistemic state, timestamp, and before/after summary." />
              <View style={styles.governanceGrid}>
                <View style={[styles.card, styles.governanceCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>Forget an exact term</Text>
                  <Text style={styles.fieldHelp}>Literal matching only. Policy blocks are never searched or edited.</Text>
                  <TextInput value={forgetTerm} onChangeText={(value) => { setForgetTerm(value); setForgetPreview(null); setForgetConfirmation(''); }} placeholder="Exact term" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                  <Pressable onPress={() => void previewForgetMatches()} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>Preview exact matches</Text></Pressable>
                  {forgetPreview && (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>{forgetPreview.blockMatches.length} core + {forgetPreview.archiveMatches.length} archive match(es)</Text>
                      <Text style={styles.fieldHelp}>Type exactly: {forgetPreview.confirmationPhrase}</Text>
                      <TextInput value={forgetConfirmation} onChangeText={setForgetConfirmation} autoCapitalize="none" style={styles.fieldInput} />
                      <Pressable disabled={memoryControlsDisabled} onPress={() => void executeForget()} style={[styles.dangerButton, memoryControlsDisabled && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Forget every exact match</Text></Pressable>
                    </View>
                  )}
                </View>
                <View style={[styles.card, styles.governanceCard, compact && styles.compactLearningCard]}>
                  <Text style={styles.sectionTitle}>Session audit</Text>
                  <Text style={styles.fieldHelp}>{changes.length} change record{changes.length === 1 ? '' : 's'} in this browser session.</Text>
                  {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
                </View>
              </View>
              {changes.length === 0 ? <EmptyState symbol="↺" title="No changes this session." copy="Corrections, archive actions, privacy reconciliation, forget, and restore activity will appear here." /> : (
                <View style={styles.changeList}>
                  {changes.map((change) => (
                    <View key={change.id} style={styles.changeItem}>
                      <View style={styles.cardHeader}>
                        <View><Text style={styles.cardLabel}>{change.block.replaceAll('_', ' ')} · {change.operation}</Text><Text style={styles.changeMeta}>{change.source} · {change.epistemicState} · {new Date(change.timestamp).toLocaleString()}</Text></View>
                        <Pill tone={change.status === 'applied' ? 'good' : change.status === 'pending' || change.status === 'failed' ? 'warn' : 'neutral'}>{change.status}</Pill>
                      </View>
                      <View style={styles.changeSummaryRow}>
                        <View style={styles.changeSummary}><Text style={styles.changeSummaryLabel}>Before</Text><Text style={styles.changeSummaryText}>{change.beforeSummary || '—'}</Text></View>
                        <View style={styles.changeSummary}><Text style={styles.changeSummaryLabel}>After</Text><Text style={styles.changeSummaryText}>{change.afterSummary || '—'}</Text></View>
                      </View>
                      {change.error ? <Text style={styles.changeError}>{change.error}</Text> : null}
                      {change.status === 'pending' && (
                        <View style={styles.cardActions}>
                          <Pressable onPress={() => cancelPendingChange(change)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel proposal</Text></Pressable>
                          <Pressable disabled={memoryControlsDisabled || !authorizePendingMemoryChange(change, connection, agent?.id ?? '', blocks.find((item) => item.label === change.block) ?? null)} onPress={() => void applyPendingChange(change)} style={[styles.primaryButton, (memoryControlsDisabled || !authorizePendingMemoryChange(change, connection, agent?.id ?? '', blocks.find((item) => item.label === change.block) ?? null)) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Apply to Letta</Text></Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {surface === 'Archive' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="ARCHIVE" title="Evidence without premature certainty." copy="Search observations, imports, hypotheses, and superseded notes without promoting them into core memory." />
              {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
              <View style={styles.searchRow}><TextInput value={archiveSearch} onChangeText={setArchiveSearch} placeholder="Search archive…" placeholderTextColor="#8d8a9b" style={styles.searchInput} onSubmitEditing={() => void refreshArchive()} /><Pressable style={styles.primaryButton} onPress={() => void refreshArchive()}><Text style={styles.primaryButtonText}>Search</Text></Pressable></View>
              {archive.length === 0 ? <EmptyState symbol="⌁" title="The archive is quiet." copy={connection === 'connected' ? 'Import notes or let conversations create evidence.' : 'Connect Letta to load durable archive passages.'} /> : (
                <View style={styles.archiveList}>{archive.map((item) => <View key={item.id} style={styles.archiveItem}><View style={styles.archiveMeta}><View style={styles.archivePills}><Pill>{item.category}</Pill><Pill>{item.epistemicState}</Pill></View><Text style={styles.archiveDate}>{item.date}</Text></View><Text style={styles.archiveText}>{item.text}</Text><View style={styles.archiveFooter}><Text style={styles.archiveSource}>Source: {item.source} · {item.provenance}</Text><Pressable disabled={memoryControlsDisabled} onPress={() => requestArchiveDelete(item)} style={[styles.secondaryButton, memoryControlsDisabled && styles.buttonDisabled]}><Text style={styles.dangerButtonText}>Delete exact passage</Text></Pressable></View>{archiveDeleteTarget?.id === item.id && <View style={styles.confirmationBox}><Text style={styles.confirmationTitle}>Delete archive passage {item.id}?</Text><Text style={styles.confirmationCopy}>This removes only the passage shown above. Type exactly: DELETE {item.id}</Text><TextInput value={archiveDeleteConfirmation} onChangeText={setArchiveDeleteConfirmation} autoCapitalize="none" autoCorrect={false} style={styles.fieldInput} /><View style={styles.confirmationActions}><Pressable onPress={() => { setArchiveDeleteTarget(null); setArchiveDeleteConfirmation(''); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable disabled={memoryControlsDisabled || !authorizeArchiveDelete(item.id, archiveDeleteConfirmation)} onPress={() => void deleteArchiveItem(item, archiveDeleteConfirmation)} style={[styles.destructiveConfirmButton, (memoryControlsDisabled || !authorizeArchiveDelete(item.id, archiveDeleteConfirmation)) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Delete passage</Text></Pressable></View></View>}</View>)}</View>
              )}
            </View>
          )}

          {surface === 'Import' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="SAFE IMPORT" title="Bring context in. Keep control." copy="Each non-empty line becomes an external_import archive candidate. Nothing here can silently update your profile or goals." />
              <View style={styles.importLayout}>
                <View style={styles.importEditor}><Text style={styles.fieldLabel}>Selected source</Text><TextInput value={importSource} onChangeText={setImportSource} placeholder="pasted text" placeholderTextColor="#918fa0" style={styles.fieldInput} /><Text style={styles.fieldLabel}>Paste notes or exported text</Text><TextInput value={importText} onChangeText={setImportText} multiline placeholder={'One observation per line\nProjects feel clearer after a written brief\nConsidering a move next spring'} placeholderTextColor="#918fa0" style={styles.importInput} /><Text style={styles.fieldHelp}>Local preview only until you choose “Archive candidates.”</Text></View>
                <View style={styles.importPreview}><View style={styles.cardHeader}><Text style={styles.previewTitle}>Review queue</Text><Pill tone="warn">{importCandidates.length} candidate{importCandidates.length === 1 ? '' : 's'}</Pill></View>{importCandidates.length === 0 ? <EmptyState symbol="↗" title="Nothing staged." copy="Paste text to see exactly what would be archived." /> : importCandidates.slice(0, 8).map((candidate: { id: string; content: string; sourceName: string }) => <View key={candidate.id} style={styles.candidate}><Text style={styles.candidateText}>{candidate.content}</Text><View style={styles.candidateMeta}><Text style={styles.candidateTag}>external_import · {candidate.sourceName}</Text><Text style={styles.candidateDestination}>→ archive · observed</Text></View></View>)}{importCandidates.length > 0 && <Pressable disabled={importBusy || memoryControlsDisabled} onPress={() => void archiveImports()} style={[styles.primaryButton, styles.importButton, (importBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{importBusy ? 'Archiving…' : 'Archive candidates'}</Text></Pressable>}</View>
              </View>
              <View style={styles.guardrail}><Text style={styles.guardrailIcon}>◇</Text><View style={styles.flexible}><Text style={styles.guardrailTitle}>Stable memory safeguard</Text><Text style={styles.guardrailCopy}>PROFILE and GOALS AND DECISIONS require a separate, explicit confirmation step after import.</Text></View></View>
            </View>
          )}

          {surface === 'Settings' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="设置" title="接通你的助手。" copy="首次使用请填写服务地址和已开通的模型。连接成功后回到对话；输入的草稿会保留。下方提供详细连接与隐私设置。" />
              <View style={styles.settingsGrid}>
                <View style={[styles.card, styles.settingsCard, compact && styles.compactSettingsCard]}>
                  <Text style={styles.sectionTitle}>Letta server</Text>
                  <Text style={styles.fieldLabel}>Draft Base URL</Text><TextInput editable={!persistentWritesPaused} autoCapitalize="none" value={draftSettings.baseUrl} onChangeText={(baseUrl) => setDraftSettings((current) => ({ ...current, baseUrl }))} style={[styles.fieldInput, persistentWritesPaused && styles.buttonDisabled]} />
                  <Text style={styles.fieldLabel}>API key <Text style={styles.optional}>(optional, session only)</Text></Text><TextInput editable={!persistentWritesPaused} autoCapitalize="none" secureTextEntry value={apiKey} onChangeText={setApiKey} placeholder="Not stored" placeholderTextColor="#9693a3" style={[styles.fieldInput, persistentWritesPaused && styles.buttonDisabled]} />
                  <Text style={styles.fieldHelp}>The key stays only in this browser session and is never written to app storage.</Text>
                  <Text style={styles.activeSetting}>Active: {activeSettings?.baseUrl ?? 'Not connected'}</Text>
                </View>
                <View style={[styles.card, styles.settingsCard, compact && styles.compactSettingsCard]}>
                  <Text style={styles.sectionTitle}>Agent configuration</Text>
                  <Text style={styles.fieldLabel}>Draft model handle</Text><TextInput editable={!persistentWritesPaused} autoCapitalize="none" value={draftSettings.modelHandle} onChangeText={(modelHandle) => setDraftSettings((current) => ({ ...current, modelHandle }))} style={[styles.fieldInput, persistentWritesPaused && styles.buttonDisabled]} />
                  <View style={styles.presetRow}>
                    <Pressable disabled={persistentWritesPaused} onPress={() => setDraftSettings((current) => ({ ...current, modelHandle: RECOMMENDED_MODEL_HANDLES.default }))} style={[styles.presetButton, draftSettings.modelHandle === RECOMMENDED_MODEL_HANDLES.default && styles.presetButtonActive, persistentWritesPaused && styles.buttonDisabled]}><Text style={styles.presetButtonText}>DeepSeek V4 Pro · default</Text></Pressable>
                    <Pressable disabled={persistentWritesPaused} onPress={() => setDraftSettings((current) => ({ ...current, modelHandle: RECOMMENDED_MODEL_HANDLES.quality }))} style={[styles.presetButton, draftSettings.modelHandle === RECOMMENDED_MODEL_HANDLES.quality && styles.presetButtonActive, persistentWritesPaused && styles.buttonDisabled]}><Text style={styles.presetButtonText}>GPT-5.6 Terra · quality</Text></Pressable>
                  </View>
                  <Text style={styles.activeSetting}>Active model: {activeSettings?.modelHandle ?? 'Not connected'}</Text>
                  <Text style={styles.fieldHelp}>Changing the draft does not mutate the Agent. Use the guarded action below to switch only this same Agent ID; Personal Co never falls back automatically.</Text>
                  <Text style={styles.fieldLabel}>Draft embedding handle</Text><TextInput editable={!persistentWritesPaused} autoCapitalize="none" value={draftSettings.embeddingHandle} onChangeText={(embeddingHandle) => setDraftSettings((current) => ({ ...current, embeddingHandle }))} style={[styles.fieldInput, persistentWritesPaused && styles.buttonDisabled]} />
                  <Text style={styles.activeSetting}>Active embedding (locked during model switch): {activeSettings?.embeddingHandle ?? 'Not connected'}</Text>
                  <View style={styles.fixedRow}><View><Text style={styles.fixedTitle}>Sleeptime</Text><Text style={styles.fieldHelp}>Disabled for the single-agent foundation</Text></View><Pill>Off</Pill></View>
                  <Pressable
                    disabled={!client || !agent || !activeSettings || connection !== 'connected' || persistentWritesPaused}
                    onPress={() => void switchGenerationModel()}
                    style={[styles.primaryButton, (!client || !agent || !activeSettings || connection !== 'connected' || persistentWritesPaused) && styles.buttonDisabled]}
                  >
                    {modelSwitchState === 'switching' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Switch this Agent to draft model</Text>}
                  </Pressable>
                  {modelSwitchOutcome ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{modelSwitchOutcome}</Text></View> : null}
                </View>
                <View style={[styles.card, styles.settingsCard, compact && styles.compactSettingsCard]}>
                  <Text style={styles.sectionTitle}>Privacy and language</Text>
                  <Text style={styles.fieldLabel}>Response language</Text>
                  <View style={styles.presetRow}>
                    {['English', '简体中文'].map((language) => <Pressable key={language} onPress={() => setPrivacy((current: ReturnType<typeof createPrivacySettings>) => ({ ...current, language }))} style={[styles.presetButton, privacy.language === language && styles.presetButtonActive]}><Text style={styles.presetButtonText}>{language}</Text></Pressable>)}
                  </View>
                  <Text style={styles.fieldLabel}>Do-not-remember terms</Text>
                  <TextInput value={doNotRememberText} onChangeText={(value) => { setDoNotRememberText(value); setPrivacy((current: ReturnType<typeof createPrivacySettings>) => ({ ...current, doNotRememberTerms: parseDoNotRememberTerms(value) })); }} multiline placeholder="Separate literal terms with commas or new lines" placeholderTextColor="#9693a3" style={styles.compactTextArea} />
                  <View style={styles.fixedRow}><View style={styles.toggleCopy}><Text style={styles.fixedTitle}>Temporary session</Text><Text style={styles.fieldHelp}>Requests no writes and reconciles detected writes after every message.</Text></View><Pressable onPress={() => setPrivacy((current: ReturnType<typeof createPrivacySettings>) => ({ ...current, temporarySession: !current.temporarySession }))} style={[styles.presetButton, privacy.temporarySession && styles.presetButtonActive]}><Text style={styles.presetButtonText}>{privacy.temporarySession ? 'On' : 'Off'}</Text></Pressable></View>
                </View>
              </View>
              <View style={styles.portabilityCard}>
                <Text style={styles.sectionTitle}>Portable snapshot</Text>
                <Text style={styles.fieldHelp}>Versioned JSON for this exact Agent ID. This is not a PostgreSQL or server database backup.</Text>
                <View style={styles.snapshotActions}><Pressable disabled={snapshotBusy} onPress={() => void exportSnapshot()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{snapshotBusy ? 'Working…' : 'Generate export'}</Text></Pressable><Pressable disabled={snapshotBusy || !snapshotText.trim()} onPress={() => void previewSnapshotRestore()} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>Preview restore</Text></Pressable></View>
                <TextInput value={snapshotText} onChangeText={(value) => { setSnapshotText(value); setRestorePreview(null); setRestoreConfirmation(''); }} multiline placeholder="Generated export or pasted Personal Co snapshot JSON" placeholderTextColor="#9693a3" style={styles.snapshotInput} />
                {restorePreview && (
                  <View style={styles.previewBox}>
                    <Text style={styles.previewTitle}>{restorePreview.blockChanges.length} writable block change(s) · {restorePreview.archiveAdds.length} missing archive record(s)</Text>
                    <Text style={styles.fieldHelp}>Policy blocks will not be written. Type exactly: {restorePreview.confirmationPhrase}</Text>
                    <TextInput value={restoreConfirmation} onChangeText={setRestoreConfirmation} autoCapitalize="none" style={styles.fieldInput} />
                    <Pressable disabled={snapshotBusy || memoryControlsDisabled} onPress={() => void applySnapshotRestore()} style={[styles.dangerButton, (snapshotBusy || memoryControlsDisabled) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Apply to this same agent</Text></Pressable>
                  </View>
                )}
              </View>
              {connectionError ? <View style={styles.errorBox}><Text style={styles.errorText}>{connectionError}</Text></View> : null}
              {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
              <View style={styles.connectRow}><Pressable onPress={() => void connect()} disabled={connection === 'connecting' || persistentWritesPaused} style={[styles.primaryButton, styles.connectButton, (connection === 'connecting' || persistentWritesPaused) && styles.buttonDisabled]}>{connection === 'connecting' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{connection === 'connected' ? 'Apply draft & reconnect' : 'Connect & initialize'}</Text>}</Pressable><Text style={[styles.connectHint, compact && styles.compactConnectHint]}>Finds or creates the one agent tagged personal-co-v1. Existing Agents are never reconfigured by reconnect.</Text></View>
            </View>
          )}
        </ScrollView>

        {compact && (
          <View style={styles.bottomNav}>
            {PRIMARY_SECTIONS.map((item) => <Pressable accessibilityRole="button" accessibilityState={{ selected: primarySurface === item.surface }} key={item.surface} onPress={() => setSurface(item.surface as Surface)} style={styles.bottomNavItem}><Text style={[styles.bottomNavSymbol, primarySurface === item.surface && styles.bottomNavActive]}>{item.symbol}</Text><Text style={[styles.bottomNavLabel, primarySurface === item.surface && styles.bottomNavActive]}>{item.label}</Text></Pressable>)}
          </View>
        )}
      </View>
    </View>
  );
}

const ink = '#24212e';
const muted = '#747180';
const violet = '#684df4';
const line = '#e6e1dc';

const styles = StyleSheet.create({
  app: { flex: 1, minHeight: '100%', flexDirection: 'row', backgroundColor: '#f7f5f1' },
  sidebar: { width: 250, paddingHorizontal: 22, paddingTop: 30, paddingBottom: 24, backgroundColor: '#201d28', justifyContent: 'space-between' },
  brandMark: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#735af5', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  brand: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  brandTagline: { color: '#9b96a8', fontSize: 12, marginTop: 5 },
  nav: { gap: 7 },
  navItem: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingHorizontal: 13, paddingVertical: 11, borderRadius: 12 },
  navItemActive: { backgroundColor: '#35303f' },
  navSymbol: { color: '#898391', fontSize: 19, width: 23, textAlign: 'center' },
  navLabel: { color: '#d3ced9', fontSize: 14, fontWeight: '700' },
  navHint: { color: '#7f7989', fontSize: 10, marginTop: 2 },
  navTextActive: { color: '#fff' },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: '#36313f', paddingTop: 18 },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#8c8794' },
  statusDotGood: { backgroundColor: '#68d2a3' },
  statusDotError: { backgroundColor: '#ff917f' },
  statusLabel: { color: '#e8e4eb', fontSize: 12, fontWeight: '700' },
  statusMeta: { color: '#817b89', fontSize: 10, marginTop: 2 },
  main: { flex: 1, minWidth: 0 },
  flexible: { flex: 1, minWidth: 0 },
  content: { flexGrow: 1, paddingHorizontal: 34, paddingVertical: 34, alignItems: 'center' },
  compactContent: { paddingHorizontal: 16, paddingVertical: 20 },
  secondaryNav: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18, marginTop: 8 },
  connectionCard: { backgroundColor: '#ece8ff', padding: 18, borderRadius: 14, marginBottom: 14 },
  pendingList: { marginTop: 22, gap: 10 },
  surface: { width: '100%', maxWidth: 1120 },
  surfaceTitle: { marginBottom: 25, maxWidth: 760 },
  eyebrow: { color: violet, fontSize: 11, fontWeight: '900', letterSpacing: 1.6, marginBottom: 9 },
  title: { color: ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.3, lineHeight: 40 },
  subtitle: { color: muted, fontSize: 15, lineHeight: 23, marginTop: 9, maxWidth: 680 },
  mobileHeader: { paddingTop: 18, paddingHorizontal: 18, paddingBottom: 12, backgroundColor: '#f7f5f1', borderBottomWidth: 1, borderBottomColor: line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mobileBrand: { color: ink, fontSize: 16, fontWeight: '800' },
  mobileSurface: { color: muted, fontSize: 11, marginTop: 2 },
  chatPanel: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: line, overflow: 'hidden', minHeight: 460 },
  messageList: { maxHeight: 490 },
  messageListContent: { padding: 24, gap: 22, minHeight: 330 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, maxWidth: '86%' },
  messageRowUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  avatar: { width: 34, height: 34, borderRadius: 11, backgroundColor: violet, alignItems: 'center', justifyContent: 'center' },
  avatarUser: { backgroundColor: '#dcd7d0' },
  avatarText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  messageBubble: { flexShrink: 1, backgroundColor: '#f3f0ff', borderRadius: 15, borderTopLeftRadius: 4, paddingHorizontal: 16, paddingVertical: 13 },
  messageBubbleUser: { backgroundColor: '#f0ede8', borderTopLeftRadius: 15, borderTopRightRadius: 4 },
  messageRole: { color: violet, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 5 },
  messageText: { color: ink, fontSize: 15, lineHeight: 22 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, padding: 15, borderTopWidth: 1, borderTopColor: line, backgroundColor: '#fcfbf9' },
  composerInput: { flex: 1, minHeight: 48, maxHeight: 140, borderWidth: 1, borderColor: '#ddd8d2', borderRadius: 13, backgroundColor: '#fff', paddingHorizontal: 15, paddingTop: 13, paddingBottom: 12, color: ink, fontSize: 15 },
  sendButton: { height: 48, backgroundColor: violet, paddingHorizontal: 21, borderRadius: 13, justifyContent: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  buttonDisabled: { opacity: 0.5 },
  policyStrip: { marginTop: 16, backgroundColor: '#ece8df', borderRadius: 14, paddingHorizontal: 17, paddingVertical: 13, flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  policyStripTitle: { color: ink, fontSize: 12, fontWeight: '800' },
  policyStripCopy: { color: muted, fontSize: 12 },
  learningStages: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  learningStage: { flexGrow: 1, flexBasis: 120, minWidth: 105, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ece8ff', borderWidth: 1, borderColor: '#d8d0ff', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9 },
  learningStageNumber: { width: 21, height: 21, borderRadius: 11, backgroundColor: violet, color: '#fff', fontSize: 10, fontWeight: '900', textAlign: 'center', lineHeight: 21 },
  learningStageLabel: { color: '#514489', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', flexShrink: 1 },
  learningGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  learningCard: { gap: 8, alignSelf: 'flex-start' },
  compactLearningCard: { width: '100%', minWidth: 0, flexBasis: 'auto', flexGrow: 0, padding: 16 },
  learningTextArea: { minHeight: 110, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', padding: 13, color: ink, fontSize: 13, lineHeight: 19, textAlignVertical: 'top' },
  statePreview: { marginTop: 8, padding: 12, borderRadius: 10, backgroundColor: '#f0edff', borderWidth: 1, borderColor: '#d8d0ff', gap: 4 },
  statePreviewLabel: { color: '#777185', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  statePreviewValue: { color: '#514489', fontSize: 18, fontWeight: '900' },
  learningCompleteButton: { marginTop: 8 },
  learningCoachPanel: { marginTop: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 17, padding: 20 },
  learningCoachText: { color: ink, fontSize: 13, lineHeight: 20, marginTop: 12, padding: 13, backgroundColor: '#faf8f5', borderRadius: 10, borderWidth: 1, borderColor: '#e4dfd9' },
  reflectionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  reflectionCard: { gap: 8, alignSelf: 'flex-start' },
  reflectionActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  memoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { flexGrow: 1, flexBasis: 430, minWidth: 280, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 17, padding: 20 },
  policyCard: { backgroundColor: '#f0ede7' },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  cardLabel: { color: ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  cardBody: { color: '#55515f', fontSize: 14, lineHeight: 21, minHeight: 54 },
  metadataLine: { color: '#918c98', fontSize: 9, lineHeight: 14, marginTop: 10 },
  cardActions: { marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  memoryInput: { color: ink, fontSize: 14, lineHeight: 21, minHeight: 105, padding: 12, backgroundColor: '#faf8f5', borderWidth: 1, borderColor: '#d8d2cb', borderRadius: 10, textAlignVertical: 'top' },
  textButton: { paddingVertical: 7 },
  textButtonText: { color: violet, fontSize: 12, fontWeight: '800' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, backgroundColor: '#e5e1dc' },
  pillGood: { backgroundColor: '#dff6ea' },
  pillWarn: { backgroundColor: '#fff0d1' },
  pillText: { color: '#6e6975', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  pillTextGood: { color: '#237952' },
  pillTextWarn: { color: '#9a6811' },
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  searchInput: { flex: 1, height: 48, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: line, paddingHorizontal: 15, color: ink },
  primaryButton: { minHeight: 46, backgroundColor: violet, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  secondaryButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 9 },
  secondaryButtonText: { color: muted, fontSize: 12, fontWeight: '700' },
  dangerButtonText: { color: '#ad4038', fontSize: 12, fontWeight: '800' },
  dangerButton: { minHeight: 42, marginTop: 10, backgroundColor: '#bb493f', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryOutlineButton: { minHeight: 42, borderWidth: 1, borderColor: '#d4cdc6', borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, marginTop: 8 },
  secondaryOutlineText: { color: ink, fontSize: 11, fontWeight: '800' },
  emptyState: { minHeight: 220, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d7d1ca', borderRadius: 17, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#faf8f5' },
  emptySymbol: { fontSize: 27, color: violet, marginBottom: 10 },
  emptyTitle: { color: ink, fontSize: 17, fontWeight: '800' },
  emptyCopy: { color: muted, fontSize: 13, textAlign: 'center', marginTop: 7, maxWidth: 360, lineHeight: 20 },
  archiveList: { gap: 10 },
  archiveItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 17 },
  archiveMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  archivePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  archiveDate: { color: '#96919c', fontSize: 10 },
  archiveText: { color: ink, fontSize: 14, lineHeight: 21 },
  archiveFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 10 },
  archiveSource: { color: '#8a8591', fontSize: 10, flexShrink: 1 },
  importLayout: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  importEditor: { flexGrow: 1, flexBasis: 290, minWidth: 0 },
  importPreview: { flexGrow: 1, flexBasis: 290, minWidth: 0, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: line, padding: 18 },
  importInput: { minHeight: 320, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 15, padding: 16, color: ink, fontSize: 14, lineHeight: 22, textAlignVertical: 'top' },
  previewTitle: { color: ink, fontSize: 16, fontWeight: '800' },
  candidate: { borderTopWidth: 1, borderTopColor: '#eeeae5', paddingVertical: 12 },
  candidateText: { color: ink, fontSize: 13, lineHeight: 19 },
  candidateMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  candidateTag: { color: '#9a6811', fontSize: 9, fontWeight: '800' },
  candidateDestination: { color: muted, fontSize: 10 },
  importButton: { marginTop: 15 },
  guardrail: { flexDirection: 'row', gap: 12, marginTop: 17, padding: 16, backgroundColor: '#ece8df', borderRadius: 14 },
  guardrailIcon: { color: violet, fontSize: 20 },
  guardrailTitle: { color: ink, fontWeight: '800', fontSize: 12 },
  guardrailCopy: { color: muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  settingsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 15 },
  settingsCard: { gap: 8 },
  compactSettingsCard: { width: '100%', minWidth: 0, flexBasis: 'auto', flexGrow: 0, padding: 16 },
  sectionTitle: { color: ink, fontSize: 17, fontWeight: '800', marginBottom: 5 },
  fieldLabel: { color: '#4d4956', fontSize: 11, fontWeight: '800', marginTop: 7 },
  fieldInput: { height: 45, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', paddingHorizontal: 13, color: ink, fontSize: 13 },
  compactTextArea: { minHeight: 78, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', padding: 13, color: ink, fontSize: 13, textAlignVertical: 'top' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  presetButton: { borderWidth: 1, borderColor: '#d8d2cb', backgroundColor: '#faf8f5', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  presetButtonActive: { borderColor: violet, backgroundColor: '#f0edff' },
  presetButtonText: { color: '#575260', fontSize: 10, fontWeight: '800' },
  fieldHelp: { color: '#898591', fontSize: 10, lineHeight: 15 },
  activeSetting: { color: '#514489', fontSize: 10, lineHeight: 15, fontWeight: '700' },
  optional: { fontWeight: '500', color: '#938e9a' },
  fixedRow: { borderTopWidth: 1, borderTopColor: line, marginTop: 10, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fixedTitle: { color: ink, fontSize: 12, fontWeight: '800' },
  toggleCopy: { flex: 1, paddingRight: 12 },
  governanceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
  governanceCard: { gap: 8 },
  previewBox: { marginTop: 10, padding: 13, backgroundColor: '#f7f3eb', borderRadius: 10, borderWidth: 1, borderColor: '#e2d8c8', gap: 6 },
  confirmationBox: { marginTop: 14, padding: 13, backgroundColor: '#fff5f2', borderRadius: 10, borderWidth: 1, borderColor: '#efc3ba', gap: 8 },
  confirmationTitle: { color: '#8f362f', fontSize: 12, fontWeight: '900' },
  confirmationCopy: { color: '#6f5552', fontSize: 11, lineHeight: 17 },
  confirmationActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  destructiveConfirmButton: { minHeight: 38, backgroundColor: '#bb493f', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  noticeBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#ece8ff', borderWidth: 1, borderColor: '#d6ceff' },
  noticeText: { color: '#514489', fontSize: 11, lineHeight: 17 },
  changeList: { gap: 10 },
  changeItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 17 },
  changeMeta: { color: '#8b8692', fontSize: 9, marginTop: 4 },
  changeSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  changeSummary: { flexGrow: 1, flexBasis: 230, minWidth: 0, backgroundColor: '#f8f6f3', borderRadius: 9, padding: 11 },
  changeSummaryLabel: { color: '#88838e', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', marginBottom: 5 },
  changeSummaryText: { color: ink, fontSize: 12, lineHeight: 18 },
  changeError: { color: '#9e3f34', fontSize: 11, lineHeight: 17, marginTop: 9 },
  portabilityCard: { marginTop: 15, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 17, padding: 20 },
  snapshotActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12, marginBottom: 10 },
  snapshotInput: { minHeight: 180, maxHeight: 360, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', padding: 13, color: ink, fontSize: 11, lineHeight: 17, textAlignVertical: 'top' },
  errorBox: { marginTop: 15, padding: 13, borderRadius: 10, backgroundColor: '#fee9e5', borderWidth: 1, borderColor: '#fac9c0' },
  errorText: { color: '#9e3f34', fontSize: 12, lineHeight: 18 },
  connectRow: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 13 },
  connectButton: { minWidth: 175 },
  connectHint: { color: muted, fontSize: 11 },
  compactConnectHint: { width: '100%', minWidth: 0, flexShrink: 1 },
  bottomNav: { height: 67, flexDirection: 'row', borderTopWidth: 1, borderTopColor: line, backgroundColor: '#fff', paddingHorizontal: 4, paddingBottom: 4 },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomNavSymbol: { color: '#96919d', fontSize: 17 },
  bottomNavLabel: { color: '#8b8792', fontSize: 9, fontWeight: '700' },
  bottomNavActive: { color: violet },
});
