import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { createLocalReadController } from '../services/local-read-client.mjs';

type Conversation = { id: string; summary: string | null; lastMessageAt: string | null };
type Message = { id: string; role: string; content: string; date: string | null };
type Receipt = { operationId: string; kind: string; status: string; conversationId: string | null; failure: string | null; text?: string; title?: string };
type Preview = { items: { id: string; source: string; text: string; epistemicState: string }[]; more: boolean; omitted: number };
type LocalState = { phase: string; agentId: string; search: string; conversations: Conversation[];
  listCursor: string | null; selected: string | null; messages: Message[]; historyCursor: string | null;
  omitted: boolean; listBusy: boolean; historyBusy: boolean; listError: string; historyError: string;
  chatEnabled: boolean; activeOperationId: string | null; drafts: Record<string, string>; title: string; operation: Receipt | null;
  chatBusy: boolean; chatError: string; preview: Preview | null; contextIds: string[]; contextBusy: boolean; contextOpen: boolean };
const initial: LocalState = { phase: 'connecting', agentId: '', search: '', conversations: [], listCursor: null,
  selected: null, messages: [], historyCursor: null, omitted: false, listBusy: false, historyBusy: false, listError: '', historyError: '',
  chatEnabled: false, activeOperationId: null, drafts: {}, title: '', operation: null, chatBusy: false, chatError: '',
  preview: null, contextIds: [], contextBusy: false, contextOpen: false };
type Client = Parameters<typeof createLocalReadController>[0];
function Button({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}>
    <Text style={styles.buttonText}>{title}</Text>
  </Pressable>;
}
export default function LocalAssistant({ client }: { client?: Client }) {
  const compact = useWindowDimensions().width < 760;
  const [state, setState] = useState<LocalState>(initial);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [contextQuery, setContextQuery] = useState('');
  const controller = useRef<ReturnType<typeof createLocalReadController> | null>(null);
  const effectGeneration = useRef(0);
  useEffect(() => {
    if (!client) return;
    const generation = ++effectGeneration.current;
    const value = controller.current ?? createLocalReadController(client, (next: LocalState) => setState(next)); controller.current = value;
    void value.start(); return () => { queueMicrotask(() => {
      if (effectGeneration.current === generation) { value.disconnect(); controller.current = null; }
    }); };
  }, [client]);
  const missing = !client || state.phase === 'disconnected';
  const ready = state.phase === 'ready';
  const blocked = state.chatBusy || Boolean(state.activeOperationId) || state.operation?.status === 'unknown';
  return <View style={styles.app}>
    <View style={styles.header}>
      <View style={{ flex: 1 }}><Text accessibilityRole="header" style={styles.brand}>Personal Co</Text>
        <Text style={styles.subtitle}>本地助手 · 已保留会话</Text></View>
      {!missing && <Button title="断开连接" onPress={() => {
        if (controller.current?.needsDisconnectConfirmation()) setConfirmDisconnect(true);
        else controller.current?.disconnect();
      }} />}
    </View>
    <Text style={styles.notice}>{state.chatEnabled ? '只支持已保留会话，不是临时或无痕聊天。未发送草稿仅保留本页，刷新会丢失；已提交但未确认的操作可重新连接后查询回执。凭证不写入浏览器存储。' : '当前仅供阅读。不发送消息、不调用模型。'} 只展示明确保留的会话；标签筛选不代表完整隐私或删除保障。</Text>
    {confirmDisconnect && <View style={styles.help} accessibilityRole="alert">
      <Text style={styles.copy}>断开将丢弃本页草稿和恢复编号，但不会取消已经提交的操作。确定断开？</Text>
      <View style={styles.actions}><Button title="保留草稿，继续连接" onPress={() => setConfirmDisconnect(false)} />
        <Button title="确认断开并清除本页" onPress={() => { controller.current?.disconnect(); setConfirmDisconnect(false); }} /></View>
    </View>}
    {missing ? <View style={styles.help}>
      <Text accessibilityRole="header" style={styles.title}>{state.phase === 'disconnected' ? '已断开，页面内容已清除' : '需要本地启动链接'}</Text>
      <Text style={styles.copy}>请从运行本地主机的终端重新打开完整链接。刷新后访问凭证不会保留；无需输入服务密钥。</Text>
      <Text style={styles.copy}>断开只清除本页数据。要停止本地主机及其运行进程，请在终端按 Ctrl+C。</Text>
    </View> : <>
      <View style={styles.status} accessibilityLiveRegion="polite">
        {state.phase === 'connecting' && <ActivityIndicator color="#735af5" />}
        <Text style={styles.copy}>{state.phase === 'connecting' ? '正在验证本地连接…' : ready ? `已连接 · ${state.chatEnabled ? '已保留会话' : '只读'}` : '连接不可用'}</Text>
        {ready && <Text numberOfLines={1} style={styles.identity}>{state.agentId}</Text>}
      </View>
      {state.phase === 'error' && <Text accessibilityRole="alert" style={styles.error}>{state.listError}</Text>}
      {ready && state.chatEnabled && <View style={styles.operation} accessibilityLiveRegion="polite">
        {state.operation && <><Text selectable style={styles.copy}>操作编号：{state.operation.operationId}</Text>
          <Text selectable numberOfLines={4} style={styles.copy}>原始提交：{state.operation.text ?? state.operation.title}</Text>
          <Text style={styles.copy}>{state.operation.status === 'completed' ? '已完成并验证保存' : state.operation.status === 'failed' ? '操作失败；草稿已保留' : state.activeOperationId === state.operation.operationId ? '主机正在处理；不会重复提交' : '结果未知；不要重发，先检查状态与历史'}</Text></>}
        {state.chatError !== '' && <Text accessibilityRole="alert" style={styles.error}>{state.chatError}</Text>}
        <View style={styles.actions}><Button title="查询操作状态" onPress={() => { void controller.current?.refreshOperation(); }} disabled={state.chatBusy} />
          {state.operation?.kind === 'create' && state.operation.status === 'unknown' && <Button title="查找已有创建结果（不新建）" disabled={state.chatBusy || Boolean(state.activeOperationId)} onPress={() => { void controller.current?.recoverCreate(); }} />}
          {state.operation?.status === 'completed' && state.operation.conversationId && <Button title="打开已完成会话" onPress={() => { void controller.current?.select(state.operation!.conversationId!); }} />}</View>
      </View>}
      {ready && <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.columns, compact && styles.stacked]}>
        <View style={[styles.listPanel, compact && styles.compactList]}>
          <Text accessibilityRole="header" style={styles.title}>会话</Text>
          {state.chatEnabled && <><TextInput accessibilityLabel="新会话标题（可选）" placeholder="新对话" value={state.title}
            onChangeText={value => controller.current?.editTitle(value)} style={styles.input} />
            <Button title="创建已保留会话" disabled={blocked} onPress={() => { void controller.current?.create(); }} /></>}
          <TextInput accessibilityLabel="搜索已保留会话" placeholder="搜索会话摘要" value={state.search} maxLength={256}
            onChangeText={value => controller.current?.changeSearch(value)} style={styles.input}
            onSubmitEditing={() => { void controller.current?.loadList(); }} />
          <View style={styles.actions}><Button title="搜索" onPress={() => { void controller.current?.loadList(); }} disabled={state.listBusy} />
            <Button title="重新加载列表" onPress={() => { void controller.current?.loadList(); }} disabled={state.listBusy} /></View>
          {state.listError !== '' && <Text accessibilityRole="alert" style={styles.error}>{state.listError}</Text>}
          {state.listBusy && <Text accessibilityLiveRegion="polite" style={styles.copy}>正在读取会话…</Text>}
          <ScrollView style={styles.listScroll} contentContainerStyle={{ gap: 8 }}>
            {state.conversations.map(row => <Pressable key={row.id} accessibilityRole="button"
              accessibilityLabel={row.summary || '未命名会话'} accessibilityState={{ selected: state.selected === row.id }}
              aria-pressed={state.selected === row.id}
              onPress={() => { void controller.current?.select(row.id); }} style={[styles.conversation, state.selected === row.id && styles.selected]}>
              <Text style={styles.rowTitle}>{row.summary || '未命名会话'}</Text>
              {row.lastMessageAt && <Text style={styles.date}>{row.lastMessageAt}</Text>}
            </Pressable>)}
            {!state.listBusy && !state.listError && state.conversations.length === 0 && <Text style={styles.copy}>
              {state.listCursor ? '此页没有已保留会话，可以继续加载。' : '暂无匹配的已保留会话。未标记或临时会话不会出现在这里。'}</Text>}
            {state.listCursor && <Button title="加载更多会话" onPress={() => { void controller.current?.loadList(true); }} disabled={state.listBusy} />}
          </ScrollView>
        </View>
        <View style={styles.historyPanel}>
          <View style={styles.actions}><Text accessibilityRole="header" style={styles.title}>会话历史</Text>
            {state.selected && <Button title="重新加载此会话" onPress={() => { if (state.selected) void controller.current?.select(state.selected); }} disabled={state.historyBusy} />}</View>
          {!state.selected ? <Text style={styles.copy}>选择一个已保留会话查看历史。</Text> : <>
            {state.historyError !== '' && <Text accessibilityRole="alert" style={styles.error}>{state.historyError}</Text>}
            {state.historyBusy && <Text accessibilityLiveRegion="polite" style={styles.copy}>正在读取历史…</Text>}
            {state.omitted && <Text style={styles.notice}>部分附件或未经回执验证的用户原文未展示；不会显示推测的原文。</Text>}
            <ScrollView style={styles.historyScroll} contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              {state.historyCursor && <Button title="加载更早消息" onPress={() => { void controller.current?.moreHistory(); }} disabled={state.historyBusy} />}
              {state.messages.map(row => <View key={row.id} style={[styles.message, row.role === 'user' && styles.userMessage]}>
                <Text style={styles.role}>{row.role === 'user' ? '你' : '助手'}</Text><Text selectable style={styles.messageText}>{row.content}</Text>
                {row.date && <Text style={styles.date}>{row.date}</Text>}
              </View>)}
              {!state.historyBusy && !state.historyError && state.messages.length === 0 && <Text style={styles.copy}>
                {state.historyCursor ? '此页没有可展示文本，可以继续读取更早消息。' : '这个会话暂无可展示文本。'}</Text>}
            </ScrollView>
            {state.chatEnabled && <View style={styles.composer}>
              <TextInput accessibilityLabel="消息草稿" multiline placeholder="输入要保存到此会话的消息" value={state.drafts[state.selected] ?? ''}
                onChangeText={value => controller.current?.editDraft(value)} style={[styles.input, styles.draft]} />
              <Button title={state.contextOpen ? '收起本条记忆选择' : '选择本条消息的记忆（可选）'} onPress={() => controller.current?.toggleContext()} />
              {state.contextOpen && <View style={{ gap: 8 }}>
                <Text style={styles.copy}>最多 4 项、合计 8192 UTF-8 字节。你仅确认本条适用性；未知证据不会变成事实，不会自动附带全部记忆。</Text>
                <TextInput accessibilityLabel="搜索记忆片段" value={contextQuery} maxLength={256} onChangeText={setContextQuery} style={styles.input} />
                <Button title="预览可选记忆" disabled={state.contextBusy} onPress={() => { void controller.current?.previewContext(contextQuery); }} />
                <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 8 }}>
                  {state.preview?.items.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={`${row.source} · ${row.epistemicState} · ${row.text}`}
                    aria-pressed={state.contextIds.includes(row.id)}
                    accessibilityState={{ selected: state.contextIds.includes(row.id) }} onPress={() => controller.current?.toggleContextItem(row.id)}
                    style={[styles.conversation, state.contextIds.includes(row.id) && styles.selected]}>
                    <Text style={styles.role}>{state.contextIds.includes(row.id) ? '已选择 · ' : ''}{row.source} · {row.epistemicState}</Text><Text style={styles.copy}>{row.text}</Text>
                  </Pressable>)}
                </ScrollView>
                {state.preview && <Text style={styles.copy}>{state.preview.items.length} 项候选，{state.contextIds.length} 项选中。{state.preview.more ? '还有更多，请缩小搜索。' : ''} {state.preview.omitted} 项不可选或已省略。</Text>}
              </View>}
              <Button title="发送并保留" disabled={blocked || !(state.drafts[state.selected] ?? '').trim()} onPress={() => { void controller.current?.send(); }} />
            </View>}
          </>}
        </View>
      </ScrollView>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#f7f5f1' }, header: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 20, backgroundColor: '#201d28' },
  brand: { color: '#fff', fontSize: 24, fontWeight: '800' }, subtitle: { color: '#d3ced9', marginTop: 4 },
  notice: { padding: 12, color: '#625b6b', fontSize: 13, lineHeight: 20 }, status: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  identity: { color: '#706979', fontSize: 12 }, columns: { flexGrow: 1, flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 16 },
  stacked: { flexDirection: 'column', gap: 12 }, listPanel: { width: 320, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10 },
  compactList: { width: '100%', maxHeight: 440 }, listScroll: { flexGrow: 1, flexShrink: 1 }, historyPanel: { flex: 1, minHeight: 340, backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  operation: { paddingHorizontal: 16, paddingBottom: 12, gap: 6 }, composer: { gap: 8 }, draft: { minHeight: 90, maxHeight: 180, textAlignVertical: 'top' },
  historyScroll: { flex: 1 }, title: { color: '#282230', fontSize: 18, fontWeight: '700' }, input: { borderWidth: 1, borderColor: '#c9c3d1', borderRadius: 10, padding: 12, color: '#282230', minHeight: 44 },
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#eee9ff', borderRadius: 10 }, buttonText: { color: '#5035b0', fontWeight: '600' },
  disabled: { opacity: 0.45 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  conversation: { padding: 12, minHeight: 44, borderRadius: 10, backgroundColor: '#f7f5f9', borderWidth: 1, borderColor: '#eeeaf2' }, selected: { borderColor: '#735af5', backgroundColor: '#f0ebff' },
  rowTitle: { color: '#302938', fontSize: 15, lineHeight: 22 }, date: { color: '#6d6675', fontSize: 11, marginTop: 8 },
  message: { padding: 14, borderRadius: 12, backgroundColor: '#f4f1f7' }, userMessage: { backgroundColor: '#ece7ff' }, role: { color: '#625276', fontSize: 12, marginBottom: 8 },
  messageText: { color: '#282230', fontSize: 15, lineHeight: 24 }, error: { color: '#9d2039', padding: 12, lineHeight: 22 },
  copy: { color: '#625b6b', lineHeight: 22 }, help: { padding: 24, gap: 16, maxWidth: 640 },
});
