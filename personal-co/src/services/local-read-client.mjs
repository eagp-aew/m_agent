const fail = code => { throw Object.assign(new Error('本地读取失败，请检查连接后重新加载。'), { code }); };
const check = (value, code = 'INVALID_RESPONSE') => { if (!value) fail(code); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value;
const cursor = value => value === null || (typeof value === 'string' && /^[a-f0-9-]{36}$/.exec(value)?.[0] === value);
const text = (value, max, nullable = false) => (nullable && value === null) || (typeof value === 'string' && value.length <= max);
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.exec(value)?.[0] === value;
const hex = value => typeof value === 'string' && /^[a-f0-9]{64}$/.exec(value)?.[0] === value;
const byteLength = value => new TextEncoder().encode(value).length;
function receipt(data) {
  if (data === null) return null;
  check(plain(data) && uuid(data.operationId) && ['create', 'send'].includes(data.kind)
    && ['unknown', 'completed', 'failed'].includes(data.status) && (data.conversationId === null || id(data.conversationId))
    && (data.failure === null || ['predispatch_rejected', 'terminal_failed'].includes(data.failure))
    && (data.status !== 'completed' || data.conversationId !== null));
  const original = data.kind === 'create' ? data.title : data.text;
  check(typeof original === 'string' && byteLength(original) <= (data.kind === 'create' ? 256 : 16384));
  return { operationId: data.operationId, kind: data.kind, status: data.status, conversationId: data.conversationId, failure: data.failure,
    ...(data.kind === 'create' ? { title: original } : { text: original }) };
}
function bindReceipt(record, expected) {
  if (record && expected) {
    check(record.operationId === expected.operationId, 'RECEIPT_MISMATCH');
    if (expected.kind) check(record.kind === expected.kind && (expected.kind === 'create'
      ? record.title === expected.title : record.conversationId === expected.conversationId && record.text === expected.text), 'RECEIPT_MISMATCH');
  }
  return record;
}

// Called synchronously during App module initialization, before any request.
// No browser storage. Reload preserves ?local=1 but needs the operator link again.
export function consumeLocalLaunch(location, history) {
  if (!location || new URLSearchParams(location.search).get('local') !== '1') return Object.freeze({ local: false });
  const fragment = location.hash;
  try { history.replaceState(null, '', `${location.pathname}?local=1`); }
  catch { return Object.freeze({ local: true }); }
  const origin = location.origin;
  const match = /^#capability=([a-f0-9]{64})$/.exec(fragment);
  if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) || !match || match[0] !== fragment) return Object.freeze({ local: true });
  return Object.freeze({ local: true, origin, capability: match[1] });
}

function validate(kind, data) {
  if (['submit', 'operation', 'recover-create'].includes(kind)) return receipt(data);
  check(plain(data));
  if (kind === 'status') {
    check(data.phase === 'ready' && id(data.agentId) && typeof data.chatEnabled === 'boolean'
      && (data.activeOperationId === null || uuid(data.activeOperationId)));
    return { phase: 'ready', agentId: data.agentId, chatEnabled: data.chatEnabled, activeOperationId: data.activeOperationId };
  }
  if (kind === 'pending') { check(Array.isArray(data.items) && data.items.length <= 1); return { items: data.items.map(receipt) }; }
  if (kind === 'context-preview') {
    check(id(data.agentId) && Number.isSafeInteger(data.revision) && data.revision >= 0 && hex(data.digest)
      && Array.isArray(data.items) && data.items.length <= 20 && typeof data.more === 'boolean'
      && Number.isSafeInteger(data.omitted) && data.omitted >= 0);
    const items = data.items.map(row => {
      check(plain(row) && hex(row.id) && text(row.source, 128) && text(row.epistemicState, 128)
        && text(row.text, 4096) && byteLength(row.text) <= 4096);
      return { id: row.id, source: row.source, epistemicState: row.epistemicState, text: row.text };
    });
    check(new Set(items.map(row => row.id)).size === items.length);
    return { agentId: data.agentId, revision: data.revision, digest: data.digest, items, more: data.more, omitted: data.omitted };
  }
  check(Array.isArray(data.items) && data.items.length <= 20 && cursor(data.cursor));
  const seen = new Set();
  const items = data.items.map(row => {
    check(plain(row) && text(row.id, kind === 'messages' ? 320 : 128) && row.id.length > 0 && !seen.has(row.id)); seen.add(row.id);
    if (kind === 'conversations') {
      check(id(row.id) && text(row.summary, 8192, true) && text(row.createdAt, 64, true) && text(row.lastMessageAt, 64, true));
      return { id: row.id, summary: row.summary, createdAt: row.createdAt, lastMessageAt: row.lastMessageAt };
    }
    check(['user', 'assistant'].includes(row.role) && text(row.content, 65536) && text(row.date, 64, true));
    return { id: row.id, role: row.role, content: row.content, date: row.date };
  });
  if (kind === 'messages') check(typeof data.omittedAttachments === 'boolean');
  return { items, cursor: data.cursor, ...(kind === 'messages' ? { omittedAttachments: data.omittedAttachments } : {}) };
}

export function createLocalReadClient(launch, { fetchImpl = globalThis.fetch, timeoutMs = 12000 } = {}) {
  let capability = launch.capability;
  const origin = launch.origin;
  check(typeof capability === 'string' && /^[a-f0-9]{64}$/.exec(capability)?.[0] === capability
    && typeof origin === 'string' && /^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.exec(origin)?.[0] === origin, 'MISSING_LINK');
  const pending = new Set(); let closed = false;
  async function request(kind, input, options = {}) {
    check(!closed, 'DISCONNECTED'); check(pending.size < 4, 'BUSY');
    const controller = new AbortController(); pending.add(controller);
    const signal = options.signal;
    const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    try {
      const body = JSON.stringify(input); check(byteLength(body) <= (kind === 'submit' ? 131072 : 4096), 'INVALID_INPUT');
      const response = await fetchImpl(`${origin}/api/local/${kind}`, { method: 'POST', mode: 'same-origin',
        credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${capability}` }, body, signal: controller.signal });
      check(!closed && !controller.signal.aborted, 'ABORTED');
      check(response.ok && response.headers.get('content-type')?.startsWith('application/json'), response.status === 403 ? 'DENIED' : 'READ_FAILED');
      const reader = response.body.getReader(); const chunks = []; let count = 0;
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          count += value.byteLength; check(count <= 2097152); chunks.push(value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      check(!closed && !controller.signal.aborted, 'ABORTED');
      const bytes = new Uint8Array(count); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      check(result?.ok === true);
      const value = validate(kind, result.data);
      return ['submit', 'operation', 'recover-create'].includes(kind) ? bindReceipt(value, JSON.parse(body)) : value;
    } catch (failure) {
      fail(closed ? 'DISCONNECTED' : controller.signal.aborted ? 'ABORTED'
        : ['DENIED', 'RECEIPT_MISMATCH'].includes(failure?.code) ? failure.code : 'READ_FAILED');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(controller); }
  }
  return Object.freeze({ status: options => request('status', {}, options),
    listConversations: (input = {}, options) => request('conversations', input, options),
    listMessages: (conversationId, input = {}, options) => request('messages', { conversationId, ...input }, options),
    submit: input => request('submit', input),
    operation: operationId => request('operation', { operationId }),
    pending: () => request('pending', {}),
    recoverCreate: operationId => request('recover-create', { operationId }),
    previewContext: (query = '') => request('context-preview', { query }),
    disconnect() { closed = true; capability = undefined; for (const controller of pending) controller.abort(); },
  });
}

// Page-local state only. Each continuation is removed BEFORE dispatch: failures
// may have consumed it remotely and must offer a deliberate fresh reload.
export function createLocalReadController(client, publish, { makeId = () => globalThis.crypto.randomUUID(), pollMs = 1000 } = {}) {
  let state = { phase: 'connecting', agentId: '', search: '', conversations: [], listCursor: null,
    selected: null, messages: [], historyCursor: null, omitted: false, listBusy: false, historyBusy: false,
    listError: '', historyError: '', chatEnabled: false, activeOperationId: null, drafts: {}, title: '',
    operation: null, chatBusy: false, chatError: '', preview: null, contextIds: [], contextBusy: false, contextOpen: false };
  let listSequence = 0; let historySequence = 0; let listAbort; let historyAbort; let closed = false; let started = false;
  let captured = null; let capturedVersion = 0; const versions = new Map(); let titleVersion = 0;
  let pollTimer; let pollCount = 0; let checking = false; let refreshAgain = false; let operationGeneration = 0;
  let mutationBusy = false; let contextSequence = 0;
  const emit = patch => { if (!closed) { state = { ...state, ...patch }; publish(state); } };
  const cancelHistory = () => { historySequence++; historyAbort?.abort(); };
  async function loadList(more = false) {
    if (closed) return;
    const next = more ? state.listCursor : null; if (more && !next) return;
    const search = state.search; const sequence = ++listSequence; listAbort?.abort(); listAbort = new AbortController();
    emit({ listBusy: true, listError: '', listCursor: null, ...!more ? { conversations: [] } : {} });
    try {
      const page = await client.listConversations({ search, ...(next ? { cursor: next } : {}) }, { signal: listAbort.signal });
      if (closed || sequence !== listSequence) return;
      const combined = more ? [...state.conversations, ...page.items] : page.items;
      check(combined.length <= 1000 && new Set(combined.map(item => item.id)).size === combined.length);
      emit({ conversations: combined, listCursor: page.cursor });
    } catch { if (sequence === listSequence) emit({ listError: '会话读取失败。请重新加载列表；不会自动重试上一页。' }); }
    finally { if (sequence === listSequence) emit({ listBusy: false }); }
  }
  async function loadHistory(conversationId, more = false) {
    if (closed) return;
    const next = more ? state.historyCursor : null; if (more && !next) return;
    const sequence = ++historySequence; historyAbort?.abort(); historyAbort = new AbortController();
    emit({ selected: conversationId, historyBusy: true, historyError: '', historyCursor: null,
      ...!more ? { messages: [], omitted: false } : {} });
    try {
      const page = await client.listMessages(conversationId, next ? { cursor: next } : {}, { signal: historyAbort.signal });
      if (closed || sequence !== historySequence) return;
      const rows = [...page.items].reverse(); const combined = more ? [...rows, ...state.messages] : rows;
      check(combined.length <= 1000 && new Set(combined.map(item => item.id)).size === combined.length);
      emit({ messages: combined, historyCursor: page.cursor, omitted: state.omitted || page.omittedAttachments });
    } catch { if (sequence === historySequence) emit({ historyError: '历史读取失败或隐私状态已改变。请重新加载此会话。' }); }
    finally { if (sequence === historySequence) emit({ historyBusy: false }); }
  }
  function schedule() {
    clearTimeout(pollTimer);
    if (!closed && state.activeOperationId && pollCount < 180) {
      pollTimer = setTimeout(() => { pollCount++; void refreshOperation(); }, pollMs);
    }
  }
  async function accept(record) {
    if (closed || !record) return;
    bindReceipt(record, captured ?? state.operation);
    emit({ operation: record });
    if (record.status !== 'completed') return;
    if (captured?.kind === 'send' && record.kind === 'send' && record.conversationId === captured.conversationId
      && versions.get(captured.conversationId) === capturedVersion && state.drafts[captured.conversationId] === captured.text) {
      emit({ drafts: { ...state.drafts, [captured.conversationId]: '' } });
    }
    if (captured?.kind === 'create' && titleVersion === capturedVersion && state.title === captured.title) emit({ title: '' });
    // Never change the selected conversation from a late completion.
    if (record.kind === 'send' && state.selected === record.conversationId) await loadHistory(record.conversationId);
    if (record.kind === 'create') await loadList();
  }
  async function refreshOperation() {
    if (closed) return;
    if (checking) { refreshAgain = true; return; } checking = true;
    const generation = operationGeneration;
    const operationId = captured?.operationId ?? state.operation?.operationId;
    try {
      const current = await client.status(); if (closed || generation !== operationGeneration) return;
      check(current.agentId === state.agentId);
      emit({ activeOperationId: current.activeOperationId, chatEnabled: current.chatEnabled, chatError: '' });
      if (operationId) {
        const record = await client.operation(operationId);
        if (closed || generation !== operationGeneration) return;
        if (!record) emit({ chatError: '未找到回执。保留草稿与操作编号；不会重新发送。' });
        else await accept(record);
      } else {
        const pending = await client.pending(); if (closed || generation !== operationGeneration) return;
        if (pending.items[0]) await accept(pending.items[0]);
      }
      schedule();
    } catch {
      if (generation === operationGeneration) {
        clearTimeout(pollTimer);
        emit({ activeOperationId: null, chatError: '连接或状态读取中断。草稿和操作编号仍留在本页；请检查主机或重新打开私有启动链接，不会自动重发。' });
      }
    } finally { checking = false; if (refreshAgain && !closed) { refreshAgain = false; void refreshOperation(); } }
  }
  async function submit(kind) {
    if (closed || !state.chatEnabled || mutationBusy || state.activeOperationId || state.operation?.status === 'unknown') return;
    const conversationId = state.selected;
    const value = kind === 'create' ? (state.title || '新对话') : (state.drafts[conversationId] ?? '');
    if ((kind === 'send' && !conversationId) || !value.trim() || value.includes('\0')
      || !value.isWellFormed() || byteLength(value) > (kind === 'create' ? 256 : 16384)) {
      emit({ chatError: kind === 'create' ? '标题须为 1–256 UTF-8 字节。' : '消息须为 1–16384 UTF-8 字节，不会截断。' }); return;
    }
    let context;
    if (kind === 'send' && state.contextIds.length) {
      const preview = state.preview;
      const selected = preview?.items.filter(row => state.contextIds.includes(row.id));
      if (!preview || selected.length !== state.contextIds.length || selected.length > 4
        || selected.reduce((size, row) => size + byteLength(row.text), 0) > 8192) { emit({ chatError: '请选择最多 4 项、合计不超过 8192 字节的记忆。' }); return; }
      context = Object.freeze({ revision: preview.revision, digest: preview.digest, items: Object.freeze([...state.contextIds]) });
    }
    const operationId = makeId(); check(uuid(operationId));
    captured = Object.freeze({ operationId, kind, ...(kind === 'create' ? { title: value } : { conversationId, text: value,
      ...(context ? { context } : {}) }) });
    capturedVersion = kind === 'create' ? titleVersion : versions.get(conversationId);
    mutationBusy = true; pollCount = 0; operationGeneration++; clearTimeout(pollTimer);
    emit({ chatBusy: true, chatError: '', operation: { operationId, kind, status: 'unknown', conversationId: kind === 'send' ? conversationId : null, failure: null,
      ...(kind === 'create' ? { title: value } : { text: value }) },
      ...(kind === 'send' ? { contextIds: [], preview: null } : {}) });
    try { await accept(await client.submit(captured)); }
    catch (failure) {
      emit({ chatError: '提交结果未知。已保留原草稿与操作编号；只能查询状态，不能重发。' });
      if (failure?.code === 'RECEIPT_MISMATCH') return;
    }
    finally { mutationBusy = false; emit({ chatBusy: false }); }
    await refreshOperation();
  }
  return Object.freeze({
    async start() {
      if (started || closed) return; started = true;
      emit({});
      try { const result = await client.status(); if (closed) return; emit({ phase: 'ready', agentId: result.agentId,
        chatEnabled: result.chatEnabled === true, activeOperationId: result.activeOperationId ?? null });
        await loadList(); if (result.chatEnabled) await refreshOperation(); }
      catch { emit({ phase: 'error', listError: '无法连接本地助手。请确认主机仍在运行，并重新打开启动链接。' }); }
    },
    changeSearch(search) {
      listSequence++; listAbort?.abort(); cancelHistory();
      emit({ search, conversations: [], listCursor: null, listBusy: false, listError: '', selected: null,
        messages: [], historyCursor: null, historyBusy: false, historyError: '', omitted: false });
    },
    loadList, select: id => { contextSequence++; emit({ preview: null, contextIds: [], contextBusy: false }); return loadHistory(id); },
    moreHistory: () => state.selected && loadHistory(state.selected, true),
    editDraft(value) { if (!state.selected) return; versions.set(state.selected, (versions.get(state.selected) ?? 0) + 1); emit({ drafts: { ...state.drafts, [state.selected]: value } }); },
    editTitle(value) { titleVersion++; emit({ title: value }); },
    create: () => submit('create'), send: () => submit('send'), refreshOperation,
    async recoverCreate() {
      const record = state.operation;
      if (closed || mutationBusy || state.activeOperationId || record?.kind !== 'create' || record.status !== 'unknown') return;
      mutationBusy = true; operationGeneration++; clearTimeout(pollTimer); emit({ chatBusy: true, chatError: '' }); pollCount = 0;
      try { await accept(await client.recoverCreate(record.operationId)); }
      catch (failure) {
        emit({ chatError: '创建恢复查询未确认。不会新建或重发，请保留操作编号。' });
        if (failure?.code === 'RECEIPT_MISMATCH') return;
      }
      finally { mutationBusy = false; emit({ chatBusy: false }); }
      await refreshOperation();
    },
    toggleContext() { emit({ contextOpen: !state.contextOpen }); },
    async previewContext(query = '') {
      if (closed || !state.chatEnabled || state.contextBusy) return;
      const sequence = ++contextSequence; emit({ contextBusy: true, preview: null, contextIds: [], chatError: '' });
      try { const preview = await client.previewContext(query); if (!closed && sequence === contextSequence) { check(preview.agentId === state.agentId); emit({ preview }); } }
      catch { if (sequence === contextSequence) emit({ chatError: '记忆预览失败，未选入任何上下文。' }); }
      finally { if (sequence === contextSequence) emit({ contextBusy: false }); }
    },
    toggleContextItem(id) {
      if (!state.preview?.items.some(row => row.id === id)) return;
      const contextIds = state.contextIds.includes(id) ? state.contextIds.filter(value => value !== id) : [...state.contextIds, id];
      if (contextIds.length > 4 || state.preview.items.filter(row => contextIds.includes(row.id)).reduce((sum, row) => sum + byteLength(row.text), 0) > 8192) {
        emit({ chatError: '最多选择 4 项，合计最多 8192 UTF-8 字节。' }); return;
      }
      emit({ contextIds, chatError: '' });
    },
    needsDisconnectConfirmation: () => Boolean(state.title || Object.values(state.drafts).some(Boolean) || state.operation?.status === 'unknown'),
    disconnect() {
      if (closed) return; clearTimeout(pollTimer); operationGeneration++; contextSequence++; captured = null; listSequence++; cancelHistory(); listAbort?.abort(); client.disconnect();
      emit({ phase: 'disconnected', agentId: '', search: '', conversations: [], messages: [], selected: null,
        listCursor: null, historyCursor: null, listError: '', historyError: '', listBusy: false, historyBusy: false, omitted: false,
        drafts: {}, title: '', operation: null, preview: null, contextIds: [], chatEnabled: false, activeOperationId: null, chatError: '', chatBusy: false }); closed = true;
    },
  });
}
