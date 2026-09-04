import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { authorizeImportDestination, createImportCandidates } from './src/domain/imports.mjs';
import {
  ALL_MEMORY_LABELS,
  authorizeMemoryUpdate,
  createMemoryBlocks,
  POLICY_MEMORY_LABELS,
} from './src/domain/memory.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT } from './src/domain/policy.mjs';
import {
  PersonalCoLettaClient,
  type AgentBlock,
  type AgentSummary,
  type ArchiveItem,
  type ChatMessage,
} from './src/services/letta';

type Surface = 'Chat' | 'Core Memory' | 'Archive' | 'Import' | 'Settings';
type ConnectionState = 'offline' | 'connecting' | 'connected' | 'error';

const NAV_ITEMS: { label: Surface; symbol: string; hint: string }[] = [
  { label: 'Chat', symbol: '✦', hint: 'Think together' },
  { label: 'Core Memory', symbol: '◫', hint: 'Six fixed blocks' },
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
  const [archive, setArchive] = useState<ArchiveItem[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [importText, setImportText] = useState('');
  const [importBusy, setImportBusy] = useState(false);

  const importCandidates = useMemo(() => createImportCandidates(importText), [importText]);

  async function connect() {
    setConnection('connecting');
    setConnectionError('');
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
      setClient(nextClient);
      setAgent(nextAgent);
      if (nextBlocks.length) setBlocks(nextBlocks);
      if (nextMessages.length) setMessages(nextMessages);
      setArchive(nextArchive);
      setConnection('connected');
      setSurface('Chat');
    } catch (error) {
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
      const replies = await client.sendMessage(agent.id, content);
      setMessages((current) => [
        ...current,
        ...(replies.length
          ? replies
          : [{ id: `empty-${Date.now()}`, role: 'assistant' as const, content: 'The run completed without an assistant message.' }]),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: `error-${Date.now()}`, role: 'assistant', content: `I couldn’t complete that request: ${error instanceof Error ? error.message : 'unknown error'}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function startEditing(block: AgentBlock) {
    if (POLICY_MEMORY_LABELS.includes(block.label)) return;
    setEditingLabel(block.label);
    setEditValue(block.value);
  }

  async function saveBlock(block: AgentBlock) {
    const stable = block.label === 'PROFILE' || block.label === 'GOALS_AND_DECISIONS';
    const performSave = async (confirmed: boolean) => {
      const authorization = authorizeMemoryUpdate(block.label, confirmed);
      if (!authorization.allowed) return;
      try {
        const updated = client && agent ? await client.updateBlock(block, editValue.trim()) : { ...block, value: editValue.trim() };
        setBlocks((current) => current.map((item) => item.label === block.label ? { ...item, ...updated, value: editValue.trim() } : item));
        setEditingLabel(null);
      } catch (error) {
        Alert.alert('Memory update failed', error instanceof Error ? error.message : 'Unknown error');
      }
    };

    if (stable) {
      Alert.alert(
        'Confirm stable memory change',
        `This will update ${block.label}. Confirm that this information is accurate and should persist.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm update', onPress: () => void performSave(true) }],
      );
    } else {
      await performSave(true);
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

  async function archiveImports() {
    if (!client || !agent) {
      setConnectionError('Connect in Settings before committing archive candidates.');
      setSurface('Settings');
      return;
    }
    setImportBusy(true);
    try {
      for (const candidate of importCandidates) {
        const authorization = authorizeImportDestination(candidate, 'archive');
        if (authorization.allowed) {
          await client.archiveText(agent.id, candidate.content, candidate.tags);
        }
      }
      setImportText('');
      setArchive(await client.listArchive(agent.id));
      setSurface('Archive');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : 'Import failed.');
    } finally {
      setImportBusy(false);
    }
  }

  const statusLabel = connection === 'connected' ? 'Connected' : connection === 'connecting' ? 'Connecting' : connection === 'error' ? 'Needs attention' : 'Local setup';

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
                      {!readOnly && (
                        <View style={styles.cardActions}>
                          {editing && <Pressable onPress={() => setEditingLabel(null)} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>}
                          <Pressable onPress={() => editing ? void saveBlock(block) : startEditing(block)} style={styles.textButton}><Text style={styles.textButtonText}>{editing ? 'Save change' : 'Edit block'} →</Text></Pressable>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {surface === 'Archive' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="ARCHIVE" title="Evidence without premature certainty." copy="Search observations, imports, hypotheses, and superseded notes without promoting them into core memory." />
              <View style={styles.searchRow}><TextInput value={archiveSearch} onChangeText={setArchiveSearch} placeholder="Search archive…" placeholderTextColor="#8d8a9b" style={styles.searchInput} onSubmitEditing={() => void refreshArchive()} /><Pressable style={styles.primaryButton} onPress={() => void refreshArchive()}><Text style={styles.primaryButtonText}>Search</Text></Pressable></View>
              {archive.length === 0 ? <EmptyState symbol="⌁" title="The archive is quiet." copy={connection === 'connected' ? 'Import notes or let conversations create evidence.' : 'Connect Letta to load durable archive passages.'} /> : (
                <View style={styles.archiveList}>{archive.map((item) => <View key={item.id} style={styles.archiveItem}><View style={styles.archiveMeta}><Pill>{item.tags[0] ?? 'archive'}</Pill>{item.createdAt && <Text style={styles.archiveDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>}</View><Text style={styles.archiveText}>{item.text}</Text></View>)}</View>
              )}
            </View>
          )}

          {surface === 'Import' && (
            <View style={styles.surface}>
              <SurfaceTitle eyebrow="SAFE IMPORT" title="Bring context in. Keep control." copy="Each non-empty line becomes an external_import archive candidate. Nothing here can silently update your profile or goals." />
              <View style={styles.importLayout}>
                <View style={styles.importEditor}><Text style={styles.fieldLabel}>Paste notes or exported text</Text><TextInput value={importText} onChangeText={setImportText} multiline placeholder={'One observation per line\nProjects feel clearer after a written brief\nConsidering a move next spring'} placeholderTextColor="#918fa0" style={styles.importInput} /><Text style={styles.fieldHelp}>Local preview only until you choose “Archive candidates.”</Text></View>
                <View style={styles.importPreview}><View style={styles.cardHeader}><Text style={styles.previewTitle}>Review queue</Text><Pill tone="warn">{importCandidates.length} candidate{importCandidates.length === 1 ? '' : 's'}</Pill></View>{importCandidates.length === 0 ? <EmptyState symbol="↗" title="Nothing staged." copy="Paste text to see exactly what would be archived." /> : importCandidates.slice(0, 8).map((candidate: { id: string; content: string }) => <View key={candidate.id} style={styles.candidate}><Text style={styles.candidateText}>{candidate.content}</Text><View style={styles.candidateMeta}><Text style={styles.candidateTag}>external_import</Text><Text style={styles.candidateDestination}>→ archive</Text></View></View>)}{importCandidates.length > 0 && <Pressable disabled={importBusy} onPress={() => void archiveImports()} style={[styles.primaryButton, styles.importButton, importBusy && styles.buttonDisabled]}><Text style={styles.primaryButtonText}>{importBusy ? 'Archiving…' : 'Archive candidates'}</Text></Pressable>}</View>
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
              </View>
              {connectionError ? <View style={styles.errorBox}><Text style={styles.errorText}>{connectionError}</Text></View> : null}
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
  emptyState: { minHeight: 220, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d7d1ca', borderRadius: 17, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#faf8f5' },
  emptySymbol: { fontSize: 27, color: violet, marginBottom: 10 },
  emptyTitle: { color: ink, fontSize: 17, fontWeight: '800' },
  emptyCopy: { color: muted, fontSize: 13, textAlign: 'center', marginTop: 7, maxWidth: 360, lineHeight: 20 },
  archiveList: { gap: 10 },
  archiveItem: { backgroundColor: '#fff', borderWidth: 1, borderColor: line, borderRadius: 14, padding: 17 },
  archiveMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 9 },
  archiveDate: { color: '#96919c', fontSize: 10 },
  archiveText: { color: ink, fontSize: 14, lineHeight: 21 },
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
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 2 },
  presetButton: { borderWidth: 1, borderColor: '#d8d2cb', backgroundColor: '#faf8f5', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  presetButtonActive: { borderColor: violet, backgroundColor: '#f0edff' },
  presetButtonText: { color: '#575260', fontSize: 10, fontWeight: '800' },
  fieldHelp: { color: '#898591', fontSize: 10, lineHeight: 15 },
  optional: { fontWeight: '500', color: '#938e9a' },
  fixedRow: { borderTopWidth: 1, borderTopColor: line, marginTop: 10, paddingTop: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fixedTitle: { color: ink, fontSize: 12, fontWeight: '800' },
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
