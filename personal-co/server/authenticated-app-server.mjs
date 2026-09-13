import { createHash, randomBytes, randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { createRuntimeSandbox, RUNTIME_PIN } from './runtime-sandbox.mjs';

const LIMITS = Object.freeze({ sockets: 2, pending: 8, requestBytes: 8192,
  messageBytes: 1048576, fragments: 64, bufferedChunks: 64, unsolicited: 32,
  handshakeMs: 5000, requestMs: 5000, closeMs: 1000 });
const error = code => Object.assign(new Error('App Server connection failed.'), { code });
const check = (value, code = 'INVALID_REQUEST') => { if (!value) throw error(code); };
const id = value => {
  const match = typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value);
  return Boolean(match && match[0] === value && value !== 'default');
};
const text = value => typeof value === 'string' && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Descriptor checks avoid invoking caller getters/toJSON, and exclude inherited
// options, symbols and hidden fields. Public inputs cannot customize ws options.
function fields(value, allowed, required = []) {
  check(record(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  const descriptors = Object.getOwnPropertyDescriptors(value);
  check(Reflect.ownKeys(descriptors).every(key => typeof key === 'string' && allowed.includes(key)
    && descriptors[key].enumerable && Object.hasOwn(descriptors[key], 'value'))
    && required.every(key => Object.hasOwn(descriptors, key)));
  return value;
}
function signalOption(options) {
  fields(options, ['signal']);
  check(options.signal === undefined || options.signal instanceof AbortSignal);
  return options.signal;
}
function endpoint(value) {
  const match = typeof value === 'string' && /^ws:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/ws$/.exec(value);
  check(match && match[0] === value && Number(match[1]) <= 65535, 'INVALID_ENDPOINT');
  return value;
}

function query(input = {}, kind) {
  const common = ['limit', 'before', 'after', 'order'];
  const keys = kind === 'agent_list' ? ['limit', 'after', 'query_text', 'tags']
    : kind === 'conversation_list' ? ['limit', 'after', 'agent_id', 'summary_search']
      : [...common, 'agent_id'];
  fields(input, keys);
  const result = { limit: 20 };
  for (const [key, value] of Object.entries(input)) {
    if (key === 'limit') check(Number.isInteger(value) && value >= 1 && value <= 100);
    else if (['before', 'after', 'agent_id'].includes(key)) check(id(value));
    else if (key === 'order') check(['asc', 'desc'].includes(value));
    else if (key === 'tags') {
      check(Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype && value.length <= 10
        && Object.keys(value).length === value.length
        && Reflect.ownKeys(value).length === value.length + 1);
      for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        check(descriptor && Object.hasOwn(descriptor, 'value') && text(descriptor.value));
      }
    } else check(text(value));
    result[key] = key === 'tags' ? [...value] : value;
  }
  return result;
}

function requestShape(type, input) {
  if (type === 'app_server_info') { fields(input, []); return {}; }
  if (type === 'agent_list' || type === 'conversation_list') {
    fields(input, ['query']); return { query: query(input.query, type) };
  }
  if (type === 'agent_retrieve') { fields(input, ['agent_id'], ['agent_id']); check(id(input.agent_id)); return { agent_id: input.agent_id }; }
  if (type === 'conversation_retrieve' || type === 'conversation_messages_list') {
    fields(input, type === 'conversation_retrieve' ? ['conversation_id'] : ['conversation_id', 'query'], ['conversation_id']);
    check(id(input.conversation_id));
    return { conversation_id: input.conversation_id,
      ...(type === 'conversation_messages_list' ? { query: query(input.query, type) } : {}) };
  }
  throw error('FORBIDDEN_COMMAND');
}

function validateResponse(message, pending) {
  check(record(message) && message.type === `${pending.type}_response`
    && typeof message.success === 'boolean', 'INVALID_RESPONSE');
  if (!message.success) throw error('SERVER_REJECTED');
  if (pending.type === 'app_server_info') {
    check(message.letta_code_version === RUNTIME_PIN.version && message.backend === 'local'
      && message.protocol_version === 1 && record(message.capabilities)
      && ['agent_management', 'conversation_management', 'memory_management', 'runtime_start', 'split_channels']
        .every(key => typeof message.capabilities[key] === 'boolean')
      && message.capabilities.agent_management && message.capabilities.conversation_management, 'RUNTIME_MISMATCH');
  } else if (pending.type === 'agent_retrieve' || pending.type === 'conversation_retrieve') {
    const key = pending.type === 'agent_retrieve' ? 'agent' : 'conversation';
    check(record(message[key]) && message[key].id === pending.fields[`${key}_id`], 'INVALID_RESPONSE');
  } else {
    const key = pending.type === 'agent_list' ? 'agents' : pending.type === 'conversation_list' ? 'conversations' : 'messages';
    check(Array.isArray(message[key]) && message[key].length <= pending.fields.query.limit
      && message[key].every(item => record(item) && id(item.id)), 'INVALID_RESPONSE');
    if (key === 'messages') check(typeof message.has_more === 'boolean'
      && (message.next_before === null || id(message.next_before)), 'INVALID_RESPONSE');
  }
}

function createConnection(url, token, onClosed, { WebSocketImpl, handshakeMs, requestMs }, lifetimeSignal) {
  let socket;
  try {
    socket = new WebSocketImpl(url, {
      headers: { Authorization: `Bearer ${token}` },
      agent: false, followRedirects: false, maxRedirects: 0,
      handshakeTimeout: handshakeMs, closeTimeout: LIMITS.closeMs,
      maxPayload: LIMITS.messageBytes, maxFragments: LIMITS.fragments, maxBufferedChunks: LIMITS.bufferedChunks,
      perMessageDeflate: false, skipUTF8Validation: false, autoPong: true,
    });
  } catch { throw error('CONNECT_FAILED'); }
  let terminal = false;
  let opening = true;
  let unsolicited = 0;
  let resolveOpen;
  let rejectOpen;
  let resolveClosed;
  let closeTimer;
  let closed = false;
  const pending = new Map();
  const didClose = new Promise(resolve => { resolveClosed = resolve; });
  const opened = new Promise((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject; });
  const connectTimer = setTimeout(() => fail('CONNECT_TIMEOUT'), handshakeMs);
  const abort = () => fail('ABORTED');
  function settle(entry, problem, result) {
    clearTimeout(entry.timer); entry.signal?.removeEventListener('abort', entry.abort);
    pending.delete(entry.id); problem ? entry.reject(error(problem)) : entry.resolve(result);
  }
  function fail(code) {
    if (terminal) return;
    terminal = true; clearTimeout(connectTimer);
    lifetimeSignal?.removeEventListener('abort', abort);
    if (opening) { opening = false; rejectOpen(error(code)); }
    for (const entry of [...pending.values()]) settle(entry, code);
    // Terminate avoids unbounded close handshakes and unsolicited close reasons.
    if (!closed) {
      closeTimer = setTimeout(() => resolveClosed(false), LIMITS.closeMs);
      try { socket.terminate(); } catch { resolveClosed(false); }
    }
  }
  socket.on('open', () => {
    if (!terminal) { opening = false; clearTimeout(connectTimer); resolveOpen(); }
  });
  socket.on('error', () => fail('SOCKET_ERROR'));
  socket.on('close', () => {
    closed = true; clearTimeout(closeTimer); resolveClosed(true); fail('DISCONNECTED'); onClosed();
  });
  socket.on('unexpected-response', (request, response) => {
    const code = response.statusCode === 401 || response.statusCode === 403 ? 'AUTH_REJECTED' : 'HANDSHAKE_REJECTED';
    // Never consume/return response bodies or headers. Destroy both owned sides.
    fail(code); response.destroy(); request.destroy();
  });
  socket.on('message', (data, isBinary) => {
    if (terminal) return;
    if (isBinary || (!Buffer.isBuffer(data) && typeof data !== 'string')
      || Buffer.byteLength(data) > LIMITS.messageBytes) return fail('INVALID_MESSAGE');
    let message;
    try {
      message = JSON.parse(data.toString());
      if (JSON.stringify(message).includes(token)) return fail('INVALID_RESPONSE');
    } catch { return fail('INVALID_MESSAGE'); }
    // The peer knows its bearer; prevent even an escaped echo from crossing the
    // private credential boundary in otherwise untrusted response data.
    if (!record(message) || typeof message.type !== 'string') return fail('INVALID_MESSAGE');
    const entry = typeof message.request_id === 'string' ? pending.get(message.request_id) : undefined;
    if (!entry) { if (++unsolicited > LIMITS.unsolicited) fail('UNSOLICITED_LIMIT'); return; }
    try { validateResponse(message, entry); }
    catch (failure) { fail(failure.code === 'SERVER_REJECTED' ? 'SERVER_REJECTED' : failure.code === 'RUNTIME_MISMATCH' ? 'RUNTIME_MISMATCH' : 'INVALID_RESPONSE'); return; }
    settle(entry, null, message);
  });
  lifetimeSignal?.addEventListener('abort', abort, { once: true });
  if (lifetimeSignal?.aborted) abort();

  const client = Object.freeze({
    request(type, input = {}, options = {}) {
      try {
        const signal = signalOption(options);
        check(!terminal, 'CLOSED'); check(!signal?.aborted, 'ABORTED');
        check(pending.size < LIMITS.pending, 'PENDING_LIMIT');
        const shape = requestShape(type, input);
        const requestId = randomUUID();
        const payload = JSON.stringify({ type, request_id: requestId, ...shape });
        check(Buffer.byteLength(payload) <= LIMITS.requestBytes, 'REQUEST_LIMIT');
        return new Promise((resolve, reject) => {
          const entry = { id: requestId, type, fields: shape, resolve, reject, signal,
            abort: () => fail('ABORTED'), timer: setTimeout(() => fail('REQUEST_TIMEOUT'), requestMs) };
          pending.set(requestId, entry); signal?.addEventListener('abort', entry.abort, { once: true });
          try { socket.send(payload, failure => { if (failure) fail('SEND_FAILED'); }); }
          catch { fail('SEND_FAILED'); }
        });
      } catch (failure) {
        return Promise.reject(error(['CLOSED', 'ABORTED', 'PENDING_LIMIT', 'REQUEST_LIMIT', 'FORBIDDEN_COMMAND'].includes(failure.code)
          ? failure.code : 'INVALID_REQUEST'));
      }
    },
    async close() { fail('CLOSED'); check(await didClose, 'CLEANUP_FAILED'); },
  });
  return { opened, client };
}

/**
 * Host-only native connection prerequisite, not browser/user authentication.
 * Does not spawn the runtime or write files. Caller keeps launchSpec host-side.
 * Its SHA256 verifier is intentionally public; the 256-bit random capability
 * stays in closures and only enters the native Authorization header.
 * Read RPC results are untrusted upstream data, never authorization decisions.
 * Query support is deliberately a bounded subset of the pinned read protocol;
 * includes/secrets, arbitrary relationships and mutations are not supported.
 * Local Agent tags match ALL tags; Agent/conversation ordering is upstream's
 * fixed ordering. SDK filters ignored by the local backend are rejected here.
 * Only named conversations are supported; ambiguous "default" is excluded.
 * ws answers native transport heartbeat pings; no application instructions are
 * answered, and the unsolicited budget applies only to application messages.
 * dispose closes owned sockets, prevents reconnect and drops this reference to
 * the capability; JavaScript/OS memory is not guaranteed securely erased.
 * Second argument is a trusted test seam only, never client/model input.
 */
export async function createAuthenticatedAppServer(roots, {
  makeSandbox = createRuntimeSandbox, WebSocketImpl = WebSocket,
  handshakeMs = LIMITS.handshakeMs, requestMs = LIMITS.requestMs,
} = {}) {
  let base;
  try { base = await makeSandbox(roots); } catch { throw error('LAUNCH_VALIDATION_FAILED'); }
  check(Number.isInteger(handshakeMs) && handshakeMs > 0 && handshakeMs <= LIMITS.handshakeMs
    && Number.isInteger(requestMs) && requestMs > 0 && requestMs <= LIMITS.requestMs, 'INVALID_TEST_SEAM');
  let token = randomBytes(32).toString('hex');
  const digest = createHash('sha256').update(token).digest('hex');
  const launchSpec = Object.freeze({ ...base, args: Object.freeze([...base.args,
    '--ws-auth', 'capability-token', '--ws-token-sha256', digest]) });
  const owned = new Set();
  let disposed = false;
  let disposing;
  return Object.freeze({
    launchSpec,
    async connect(url, options = {}) {
      check(!disposed, 'DISPOSED');
      endpoint(url);
      const signal = signalOption(options);
      check(!signal?.aborted, 'ABORTED'); check(owned.size < LIMITS.sockets, 'CONNECTION_LIMIT');
      let connection;
      connection = createConnection(url, token, () => owned.delete(connection), { WebSocketImpl, handshakeMs, requestMs }, signal);
      owned.add(connection);
      try {
        await connection.opened;
        const info = await connection.client.request('app_server_info');
        check(!disposed, 'DISPOSED'); check(!signal?.aborted, 'ABORTED');
        return Object.freeze({ info, request: connection.client.request, close: connection.client.close });
      } catch (failure) {
        try { await connection.client.close(); } catch { throw error('CLEANUP_FAILED'); }
        throw failure;
      }
    },
    dispose() {
      if (!disposing) {
        disposed = true; token = undefined;
        disposing = Promise.allSettled([...owned].map(connection => connection.client.close()))
          .then(results => { check(results.every(result => result.status === 'fulfilled'), 'CLEANUP_FAILED'); });
      }
      return disposing;
    },
  });
}
