import { useMemo, useState, type ReactNode } from 'react';
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
  ALL_MEMORY_LABELS,
  authorizeMemoryUpdate,
  createMemoryBlocks,
  POLICY_MEMORY_LABELS,
} from './src/domain/memory.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT } from './src/domain/policy.mjs';
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
  PersonalCoLettaClient,
  type AgentBlock,
  type AgentSummary,
  type ArchiveItem,
  type ChatMessage,
} from './src/services/letta';

type Surface = 'Chat' | 'Core Memory' | 'Memory Changes' | 'Archive' | 'Import' | 'Settings';
type ConnectionState = 'offline' | 'connecting' | 'connected' | 'error';

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
};

const NAV_ITEMS: { label: Surface; symbol: string; hint: string }[] = [
  { label: 'Chat', symbol: '✦', hint: 'Think together' },
  { label: 'Core Memory', symbol: '◫', hint: 'Six fixed blocks' },
  { label: 'Memory Changes', symbol: '↺', hint: 'Review every change' },
  { label: 'Archive', symbol: '⌁', hint: 'Evidence first' },
  { label: 'Import', symbol: '↗', hint: 'Review before writing' },
  { label: 'Settings', symbol: '⚙', hint: 'Local connection' },
];

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'I’m ready when you are. Connect a Letta server in Settings, or explore how memory and evidence are handled first.',
  },
];

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
  const [settings, setSettings] = useState<ConnectionSettings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('offline');
  const [connectionError, setConnectionError] = useState('');
  const [client, setClient] = useState<PersonalCoLettaClient | null>(null);
  const [agent, setAgent] = useState<AgentSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
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

  const importCandidates = useMemo(
    () => createImportCandidates(importText, importSource),
    [importSource, importText],
  );

  function appendChanges(...nextChanges: MemoryChangeRecord[]) {
    setChanges((current) => [...nextChanges, ...current]);
  }

  async function connect() {
    setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
    setConnection('connecting');
    setConnectionError('');
    setClient(null);
    setAgent(null);
    setEditingLabel(null);
    setClearConfirmationLabel(null);
    setForgetPreview(null);
    setForgetConfirmation('');
    setArchiveDeleteTarget(null);
    setArchiveDeleteConfirmation('');
    setRestorePreview(null);
    setRestoreConfirmation('');
    try {
      const normalized = normalizeSettings(settings);
      const nextClient = new PersonalCoLettaClient(normalized, apiKey);
      await nextClient.testConnection();
      const nextAgent = await nextClient.ensureAgent(normalized);
      const [nextBlocks, nextMessages, nextArchive] = await Promise.all([
        nextClient.listBlocks(nextAgent.id),
        nextClient.listMessages(nextAgent.id),
        nextClient.listArchive(nextAgent.id),
      ]);
      setSettings(normalized);
      setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
      setClient(nextClient);
      setAgent(nextAgent);
      if (nextBlocks.length) setBlocks(nextBlocks);
      if (nextMessages.length) setMessages(nextMessages);
      setArchive(nextArchive);
      setConnection('connected');
      setSurface('Chat');
    } catch (error) {
      setChanges((current) => cancelPendingChangesForConnectionChange(current) as MemoryChangeRecord[]);
      setConnection('error');
      setConnectionError(error instanceof Error ? error.message : 'Could not connect to Letta.');
    }
  }

  async function sendMessage() {
    const content = draft.trim();
    if (!content || sending) return;
    if (!client || !agent) {
      setConnectionError('Connect your Letta server in Settings before sending a message.');
      setSurface('Settings');
      return;
    }
    const userMessage: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content };
    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setSending(true);
    try {
      const decision = privacyDecisionForMessage(content, privacy);
      const before = await client.captureAgentMemory(agent.id);
      let sendError: unknown = null;
      try {
        const replies = await client.sendMessage(agent.id, content, {
          requestNoMemoryWrites: decision.requestNoMemoryWrites,
          language: privacy.language,
        });
        setMessages((current) => [
          ...current,
          ...(replies.length
            ? replies
            : [{ id: `empty-${Date.now()}`, role: 'assistant' as const, content: 'The run completed without an assistant message.' }]),
        ]);
      } catch (error) {
        sendError = error;
      }
      if (decision.requestNoMemoryWrites) {
        const reconciled = await client.reconcileTemporaryMemory(agent.id, before);
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
        await recordAgentMemoryWrites(before);
      }
      if (sendError) throw sendError;
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: `error-${Date.now()}`, role: 'assistant', content: `I couldn’t complete that request: ${error instanceof Error ? error.message : 'unknown error'}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function recordAgentMemoryWrites(before: { blocks: AgentBlock[]; archive: ArchiveItem[] }) {
    if (!client || !agent) return;
    const after = await client.captureAgentMemory(agent.id);
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
          const restored = await client.updateBlock(item.before, item.before.value, item.before.metadata ?? null);
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
      }) as MemoryChangeRecord;
      appendChanges(pending);
      setEditingLabel(null);
      setSurface('Memory Changes');
    } else {
      await applyDirectBlockChange(block, editValue.trim(), 'correct');
    }
  }

  async function applyDirectBlockChange(block: AgentBlock, value: string, operation: string) {
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
    if (!client || !agent || !authorizePendingMemoryChange(change, connection, agent.id)) {
      setChanges((current) => current.map((item) => item.id === change.id && item.status === 'pending'
        ? transitionMemoryChange(item, 'cancelled', 'Cancelled because this proposal no longer matches the connected agent.') as MemoryChangeRecord
        : item));
      setGovernanceNotice('The pending proposal was cancelled because its connection or agent binding is no longer current.');
      return;
    }
    const block = blocks.find((item) => item.label === change.block);
    if (!block || !authorizeMemoryUpdate(change.block, true).allowed) return;
    try {
      const updated = await client.updateBlock(
        block,
        change.after,
        buildPersonalCoMetadata(block.metadata, change),
      );
      setBlocks((current) => current.map((item) => item.label === change.block ? updated : item));
      setChanges((current) => current.map((item) => item.id === change.id
        ? transitionMemoryChange(item, 'applied') as MemoryChangeRecord
        : item));
    } catch (error) {
      setChanges((current) => current.map((item) => item.id === change.id
        ? transitionMemoryChange(item, 'failed', error instanceof Error ? error.message : 'Unknown error') as MemoryChangeRecord
        : item));
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
    let freshPreview: ReturnType<typeof createForgetPreview>;
    try {
      const currentMemory = await client.captureAgentMemory(connectedAgentId);
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
        await client.updateBlock(block, nextValue, buildPersonalCoMetadata(block.metadata, change));
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
        await client.deleteArchiveItem(connectedAgentId, item.id);
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
      const nextMemory = await client.captureAgentMemory(connectedAgentId);
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
  }

  function requestArchiveDelete(item: ArchiveItem) {
    setArchiveDeleteTarget(item);
    setArchiveDeleteConfirmation('');
    setGovernanceNotice('');
  }

  async function deleteArchiveItem(item: ArchiveItem, confirmation: string) {
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
    if (!client || !agent) {
      setConnectionError('Connect in Settings before committing archive candidates.');
      setSurface('Settings');
      return;
    }
    setImportBusy(true);
    const logged: MemoryChangeRecord[] = [];
    const failures: string[] = [];
    try {
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
            await client.archiveText(agent.id, candidate.content, candidate.normalizedTags);
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
      setArchive(await client.listArchive(agent.id));
      setSurface('Archive');
      setGovernanceNotice(
        failures.length
          ? `Import completed with partial failures: ${failures.join(' ')}`
          : `Archived ${logged.length} reviewed candidate(s).`,
      );
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImportBusy(false);
    }
  }

  async function exportSnapshot() {
    if (!client || !agent) {
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
        settings: { ...settings, ...privacy },
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
    let freshPreview: ReturnType<typeof createRestorePreview>;
    try {
      try {
        parsedSnapshot = JSON.parse(snapshotText);
        const currentMemory = await client.captureAgentMemory(connectedAgentId);
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
          await client.updateBlock(
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
          await client.archiveText(connectedAgentId, item.text, item.tags, item.createdAt);
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
        const memory = await client.captureAgentMemory(connectedAgentId);
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
    } finally {
      setSnapshotBusy(false);
    }
  }

  const statusLabel = connection === 'connected' ? 'Connected' : connection === 'connecting' ? 'Connecting' : connection === 'error' ? 'Needs attention' : 'Local setup';
  const memoryControlsDisabled = !client || !agent || !hasConnectedMemoryContext(connection, agent.id);

  return (
    <View style={styles.app}>
      {!compact && (
        <View style={styles.sidebar}>
          <View>
            <View style={styles.brandMark}><Text style={styles.brandMarkText}>PC</Text></View>
            <Text style={styles.brand}>Personal Co</Text>
            <Text style={styles.brandTagline}>One memory. One agent. Yours.</Text>
          </View>
          <View style={styles.nav}>
            {NAV_ITEMS.map((item) => (
              <Pressable key={item.label} onPress={() => setSurface(item.label)} style={[styles.navItem, surface === item.label && styles.navItemActive]}>
                <Text style={[styles.navSymbol, surface === item.label && styles.navTextActive]}>{item.symbol}</Text>
                <View><Text style={[styles.navLabel, surface === item.label && styles.navTextActive]}>{item.label}</Text><Text style={styles.navHint}>{item.hint}</Text></View>
              </Pressable>
            ))}
          </View>
          <View style={styles.sidebarFooter}>
            <View style={[styles.statusDot, connection === 'connected' && styles.statusDotGood, connection === 'error' && styles.statusDotError]} />
            <View><Text style={styles.statusLabel}>{statusLabel}</Text><Text style={styles.statusMeta}>personal-co-v1</Text></View>
          </View>
        </View>
      )}

      <View style={styles.main}>
        {compact && (
          <View style={styles.mobileHeader}>
            <View><Text style={styles.mobileBrand}>Personal Co</Text><Text style={styles.mobileSurface}>{surface}</Text></View>
            <Pill tone={connection === 'connected' ? 'good' : connection === 'error' ? 'warn' : 'neutral'}>{statusLabel}</Pill>
          </View>
        )}
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {surface === 'Chat' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="THINKING SPACE" title="What are we working through?" copy="Personal Co keeps evidence and confidence visible, so useful context can grow without turning guesses into facts." />
              <View style={styles.chatPanel}>
                <ScrollView style={styles.messageList} contentContainerStyle={styles.messageListContent}>
                  {messages.map((message) => (
                    <View key={message.id} style={[styles.messageRow, message.role === 'user' && styles.messageRowUser]}>
                      <View style={[styles.avatar, message.role === 'user' && styles.avatarUser]}><Text style={styles.avatarText}>{message.role === 'user' ? 'YOU' : 'CO'}</Text></View>
                      <View style={[styles.messageBubble, message.role === 'user' && styles.messageBubbleUser]}>
                        <Text style={styles.messageRole}>{message.role === 'user' ? 'You' : 'Personal Co'}</Text>
                        <Text style={styles.messageText}>{message.content}</Text>
                      </View>
                    </View>
                  ))}
                  {sending && <ActivityIndicator color="#684df4" style={{ alignSelf: 'flex-start' }} />}
                </ScrollView>
                <View style={styles.composer}>
                  <TextInput value={draft} onChangeText={setDraft} placeholder="Ask, reflect, or make a decision…" placeholderTextColor="#8d8a9b" multiline style={styles.composerInput} onSubmitEditing={() => void sendMessage()} />
                  <Pressable onPress={() => void sendMessage()} style={[styles.sendButton, (!draft.trim() || sending) && styles.buttonDisabled]} disabled={!draft.trim() || sending}><Text style={styles.sendButtonText}>Send ↑</Text></Pressable>
                </View>
              </View>
              <View style={styles.policyStrip}><Text style={styles.policyStripTitle}>Archive-first by design</Text><Text style={styles.policyStripCopy}>Uncertain ideas stay outside stable memory until evidence or your confirmation supports them.</Text></View>
            </View>
          )}

          {surface === 'Core Memory' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="CORE MEMORY" title="A small, deliberate memory." copy="Four user-owned blocks can change. Two policy blocks stay read-only so the rules remain stable." />
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
                <View style={[styles.card, styles.governanceCard]}>
                  <Text style={styles.sectionTitle}>Forget an exact term</Text>
                  <Text style={styles.fieldHelp}>Literal matching only. Policy blocks are never searched or edited.</Text>
                  <TextInput value={forgetTerm} onChangeText={(value) => { setForgetTerm(value); setForgetPreview(null); setForgetConfirmation(''); }} placeholder="Exact term" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                  <Pressable onPress={() => void previewForgetMatches()} style={styles.secondaryOutlineButton}><Text style={styles.secondaryOutlineText}>Preview exact matches</Text></Pressable>
                  {forgetPreview && (
                    <View style={styles.previewBox}>
                      <Text style={styles.previewTitle}>{forgetPreview.blockMatches.length} core + {forgetPreview.archiveMatches.length} archive match(es)</Text>
                      <Text style={styles.fieldHelp}>Type exactly: {forgetPreview.confirmationPhrase}</Text>
                      <TextInput value={forgetConfirmation} onChangeText={setForgetConfirmation} autoCapitalize="none" style={styles.fieldInput} />
                      <Pressable onPress={() => void executeForget()} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Forget every exact match</Text></Pressable>
                    </View>
                  )}
                </View>
                <View style={[styles.card, styles.governanceCard]}>
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
                          <Pressable disabled={!client || !agent || !authorizePendingMemoryChange(change, connection, agent.id)} onPress={() => void applyPendingChange(change)} style={[styles.primaryButton, (!client || !agent || !authorizePendingMemoryChange(change, connection, agent.id)) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Apply to Letta</Text></Pressable>
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
                <View style={styles.archiveList}>{archive.map((item) => <View key={item.id} style={styles.archiveItem}><View style={styles.archiveMeta}><View style={styles.archivePills}><Pill>{item.category}</Pill><Pill>{item.epistemicState}</Pill></View><Text style={styles.archiveDate}>{item.date}</Text></View><Text style={styles.archiveText}>{item.text}</Text><View style={styles.archiveFooter}><Text style={styles.archiveSource}>Source: {item.source} · {item.provenance}</Text><Pressable onPress={() => requestArchiveDelete(item)} style={styles.secondaryButton}><Text style={styles.dangerButtonText}>Delete exact passage</Text></Pressable></View>{archiveDeleteTarget?.id === item.id && <View style={styles.confirmationBox}><Text style={styles.confirmationTitle}>Delete archive passage {item.id}?</Text><Text style={styles.confirmationCopy}>This removes only the passage shown above. Type exactly: DELETE {item.id}</Text><TextInput value={archiveDeleteConfirmation} onChangeText={setArchiveDeleteConfirmation} autoCapitalize="none" autoCorrect={false} style={styles.fieldInput} /><View style={styles.confirmationActions}><Pressable onPress={() => { setArchiveDeleteTarget(null); setArchiveDeleteConfirmation(''); }} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable><Pressable disabled={!authorizeArchiveDelete(item.id, archiveDeleteConfirmation)} onPress={() => void deleteArchiveItem(item, archiveDeleteConfirmation)} style={[styles.destructiveConfirmButton, !authorizeArchiveDelete(item.id, archiveDeleteConfirmation) && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>Delete passage</Text></Pressable></View></View>}</View>)}</View>
              )}
            </View>
          )}

          {surface === 'Import' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="SAFE IMPORT" title="Bring context in. Keep control." copy="Each non-empty line becomes an external_import archive candidate. Nothing here can silently update your profile or goals." />
              <View style={styles.importLayout}>
                <View style={styles.importEditor}><Text style={styles.fieldLabel}>Selected source</Text><TextInput value={importSource} onChangeText={setImportSource} placeholder="pasted text" placeholderTextColor="#918fa0" style={styles.fieldInput} /><Text style={styles.fieldLabel}>Paste notes or exported text</Text><TextInput value={importText} onChangeText={setImportText} multiline placeholder={'One observation per line\nProjects feel clearer after a written brief\nConsidering a move next spring'} placeholderTextColor="#918fa0" style={styles.importInput} /><Text style={styles.fieldHelp}>Local preview only until you choose “Archive candidates.”</Text></View>
                <View style={styles.importPreview}><View style={styles.cardHeader}><Text style={styles.previewTitle}>Review queue</Text><Pill tone="warn">{importCandidates.length} candidate{importCandidates.length === 1 ? '' : 's'}</Pill></View>{importCandidates.length === 0 ? <EmptyState symbol="↗" title="Nothing staged." copy="Paste text to see exactly what would be archived." /> : importCandidates.slice(0, 8).map((candidate: { id: string; content: string; sourceName: string }) => <View key={candidate.id} style={styles.candidate}><Text style={styles.candidateText}>{candidate.content}</Text><View style={styles.candidateMeta}><Text style={styles.candidateTag}>external_import · {candidate.sourceName}</Text><Text style={styles.candidateDestination}>→ archive · observed</Text></View></View>)}{importCandidates.length > 0 && <Pressable disabled={importBusy} onPress={() => void archiveImports()} style={[styles.primaryButton, styles.importButton, importBusy && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{importBusy ? 'Archiving…' : 'Archive candidates'}</Text></Pressable>}</View>
              </View>
              <View style={styles.guardrail}><Text style={styles.guardrailIcon}>◇</Text><View><Text style={styles.guardrailTitle}>Stable memory safeguard</Text><Text style={styles.guardrailCopy}>PROFILE and GOALS AND DECISIONS require a separate, explicit confirmation step after import.</Text></View></View>
            </View>
          )}

          {surface === 'Settings' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="CONNECTION" title="Your Letta, your model choices." copy="Personal Co uses only the handles you provide. It never switches providers automatically." />
              <View style={styles.settingsGrid}>
                <View style={[styles.card, styles.settingsCard]}>
                  <Text style={styles.sectionTitle}>Letta server</Text>
                  <Text style={styles.fieldLabel}>Base URL</Text><TextInput autoCapitalize="none" value={settings.baseUrl} onChangeText={(baseUrl) => setSettings((current) => ({ ...current, baseUrl }))} style={styles.fieldInput} />
                  <Text style={styles.fieldLabel}>API key <Text style={styles.optional}>(optional, session only)</Text></Text><TextInput autoCapitalize="none" secureTextEntry value={apiKey} onChangeText={setApiKey} placeholder="Not stored" placeholderTextColor="#9693a3" style={styles.fieldInput} />
                  <Text style={styles.fieldHelp}>The key stays only in this browser session and is never written to app storage.</Text>
                </View>
                <View style={[styles.card, styles.settingsCard]}>
                  <Text style={styles.sectionTitle}>Agent configuration</Text>
                  <Text style={styles.fieldLabel}>Model handle</Text><TextInput autoCapitalize="none" value={settings.modelHandle} onChangeText={(modelHandle) => setSettings((current) => ({ ...current, modelHandle }))} style={styles.fieldInput} />
                  <View style={styles.presetRow}>
                    <Pressable onPress={() => setSettings((current) => ({ ...current, modelHandle: RECOMMENDED_MODEL_HANDLES.default }))} style={[styles.presetButton, settings.modelHandle === RECOMMENDED_MODEL_HANDLES.default && styles.presetButtonActive]}><Text style={styles.presetButtonText}>DeepSeek V4 Pro · default</Text></Pressable>
                    <Pressable onPress={() => setSettings((current) => ({ ...current, modelHandle: RECOMMENDED_MODEL_HANDLES.quality }))} style={[styles.presetButton, settings.modelHandle === RECOMMENDED_MODEL_HANDLES.quality && styles.presetButtonActive]}><Text style={styles.presetButtonText}>GPT-5.6 Terra · quality</Text></Pressable>
                  </View>
                  <Text style={styles.fieldHelp}>Switches are manual and update this same agent ID; Personal Co never falls back automatically.</Text>
                  <Text style={styles.fieldLabel}>Embedding handle</Text><TextInput autoCapitalize="none" value={settings.embeddingHandle} onChangeText={(embeddingHandle) => setSettings((current) => ({ ...current, embeddingHandle }))} style={styles.fieldInput} />
                  <View style={styles.fixedRow}><View><Text style={styles.fixedTitle}>Sleeptime</Text><Text style={styles.fieldHelp}>Disabled for the single-agent foundation</Text></View><Pill>Off</Pill></View>
                </View>
                <View style={[styles.card, styles.settingsCard]}>
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
                    <Pressable disabled={snapshotBusy} onPress={() => void applySnapshotRestore()} style={styles.dangerButton}><Text style={styles.primaryButtonText}>Apply to this same agent</Text></Pressable>
                  </View>
                )}
              </View>
              {connectionError ? <View style={styles.errorBox}><Text style={styles.errorText}>{connectionError}</Text></View> : null}
              {governanceNotice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{governanceNotice}</Text></View> : null}
              <View style={styles.connectRow}><Pressable onPress={() => void connect()} disabled={connection === 'connecting'} style={[styles.primaryButton, styles.connectButton, connection === 'connecting' && styles.buttonDisabled]}>{connection === 'connecting' ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>{connection === 'connected' ? 'Reconnect agent' : 'Connect & initialize'}</Text>}</Pressable><Text style={styles.connectHint}>Finds or creates the one agent tagged personal-co-v1.</Text></View>
            </View>
          )}
        </ScrollView>

        {compact && (
          <View style={styles.bottomNav}>
            {NAV_ITEMS.map((item) => <Pressable key={item.label} onPress={() => setSurface(item.label)} style={styles.bottomNavItem}><Text style={[styles.bottomNavSymbol, surface === item.label && styles.bottomNavActive]}>{item.symbol}</Text><Text numberOfLines={1} style={[styles.bottomNavLabel, surface === item.label && styles.bottomNavActive]}>{item.label === 'Core Memory' ? 'Memory' : item.label}</Text></Pressable>)}
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
  main: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 34, paddingVertical: 34, alignItems: 'center' },
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
  memoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { flexGrow: 1, flexBasis: 430, minWidth: 280, backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 17, padding: 20 },
  policyCard: { backgroundColor: '#f0ede7' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 },
  cardLabel: { color: ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  cardBody: { color: '#55515f', fontSize: 14, lineHeight: 21, minHeight: 54 },
  metadataLine: { color: '#918c98', fontSize: 9, lineHeight: 14, marginTop: 10 },
  cardActions: { marginTop: 16, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
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
  importEditor: { flex: 1, minWidth: 290 },
  importPreview: { flex: 1, minWidth: 290, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: line, padding: 18 },
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
  sectionTitle: { color: ink, fontSize: 17, fontWeight: '800', marginBottom: 5 },
  fieldLabel: { color: '#4d4956', fontSize: 11, fontWeight: '800', marginTop: 7 },
  fieldInput: { height: 45, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', paddingHorizontal: 13, color: ink, fontSize: 13 },
  compactTextArea: { minHeight: 78, borderRadius: 10, borderWidth: 1, borderColor: '#dcd6cf', backgroundColor: '#faf9f7', padding: 13, color: ink, fontSize: 13, textAlignVertical: 'top' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  presetButton: { borderWidth: 1, borderColor: '#d8d2cb', backgroundColor: '#faf8f5', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  presetButtonActive: { borderColor: violet, backgroundColor: '#f0edff' },
  presetButtonText: { color: '#575260', fontSize: 10, fontWeight: '800' },
  fieldHelp: { color: '#898591', fontSize: 10, lineHeight: 15 },
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
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10 },
  destructiveConfirmButton: { minHeight: 38, backgroundColor: '#bb493f', borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  noticeBox: { marginTop: 12, padding: 12, borderRadius: 10, backgroundColor: '#ece8ff', borderWidth: 1, borderColor: '#d6ceff' },
  noticeText: { color: '#514489', fontSize: 11, lineHeight: 17 },
  changeList: { gap: 10 },
  changeItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 17 },
  changeMeta: { color: '#8b8692', fontSize: 9, marginTop: 4 },
  changeSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  changeSummary: { flex: 1, minWidth: 230, backgroundColor: '#f8f6f3', borderRadius: 9, padding: 11 },
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
  bottomNav: { height: 67, flexDirection: 'row', borderTopWidth: 1, borderTopColor: line, backgroundColor: '#fff', paddingHorizontal: 4, paddingBottom: 4 },
  bottomNavItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomNavSymbol: { color: '#96919d', fontSize: 17 },
  bottomNavLabel: { color: '#8b8792', fontSize: 9, fontWeight: '700' },
  bottomNavActive: { color: violet },
});
