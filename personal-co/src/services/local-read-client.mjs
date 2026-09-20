const fail = code => { throw Object.assign(new Error('本地读取失败，请检查连接后重新加载。'), { code }); };
const check = (value, code = 'INVALID_RESPONSE') => { if (!value) fail(code); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const id = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value;
const cursor = value => value === null || (typeof value === 'string' && /^[a-f0-9-]{36}$/.exec(value)?.[0] === value);
const text = (value, max, nullable = false) => (nullable && value === null) || (typeof value === 'string' && value.length <= max);

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
  check(plain(data));
  if (kind === 'status') { check(data.phase === 'ready' && id(data.agentId)); return { phase: 'ready', agentId: data.agentId }; }
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
      const body = JSON.stringify(input); check(new TextEncoder().encode(body).length <= 4096, 'INVALID_INPUT');
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
      check(result?.ok === true); return validate(kind, result.data);
    } catch (failure) {
      fail(closed ? 'DISCONNECTED' : controller.signal.aborted ? 'ABORTED' : failure?.code === 'DENIED' ? 'DENIED' : 'READ_FAILED');
    } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); pending.delete(controller); }
  }
  return Object.freeze({ status: options => request('status', {}, options),
    listConversations: (input = {}, options) => request('conversations', input, options),
    listMessages: (conversationId, input = {}, options) => request('messages', { conversationId, ...input }, options),
    disconnect() { closed = true; capability = undefined; for (const controller of pending) controller.abort(); },
  });
}

// Page-local state only. Each continuation is removed BEFORE dispatch: failures
// may have consumed it remotely and must offer a deliberate fresh reload.
export function createLocalReadController(client, publish) {
  let state = { phase: 'connecting', agentId: '', search: '', conversations: [], listCursor: null,
    selected: null, messages: [], historyCursor: null, omitted: false, listBusy: false, historyBusy: false,
    listError: '', historyError: '' };
  let listSequence = 0; let historySequence = 0; let listAbort; let historyAbort; let closed = false; let started = false;
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
  return Object.freeze({
    async start() {
      if (started || closed) return; started = true;
      emit({});
      try { const result = await client.status(); if (closed) return; emit({ phase: 'ready', agentId: result.agentId }); await loadList(); }
      catch { emit({ phase: 'error', listError: '无法连接本地助手。请确认主机仍在运行，并重新打开启动链接。' }); }
    },
    changeSearch(search) {
      listSequence++; listAbort?.abort(); cancelHistory();
      emit({ search, conversations: [], listCursor: null, listBusy: false, listError: '', selected: null,
        messages: [], historyCursor: null, historyBusy: false, historyError: '', omitted: false });
    },
    loadList, select: id => loadHistory(id), moreHistory: () => state.selected && loadHistory(state.selected, true),
    disconnect() {
      if (closed) return; listSequence++; cancelHistory(); listAbort?.abort(); client.disconnect();
      emit({ phase: 'disconnected', agentId: '', search: '', conversations: [], messages: [], selected: null,
        listCursor: null, historyCursor: null, listError: '', historyError: '', listBusy: false, historyBusy: false, omitted: false }); closed = true;
    },
  });
}
