import { createServer } from 'node:http';
import * as fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeManagedReadSession } from './managed-read-session.mjs';
import { captureLocalChatConfig } from './runtime-sandbox.mjs';
import { captureChatContext, captureContextQuery } from './local-chat-context.mjs';

const BODY = 4096;
const SUBMIT_BODY = 131072;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.exec(value)?.[0] === value;
const RESPONSE = 2097152;
const ASSET = 8388608;
const error = code => Object.assign(new Error('Local assistant unavailable.'), { code });
const check = (value, code = 'INVALID_REQUEST') => { if (!value) throw error(code); };
const entity = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.exec(value)?.[0] === value && value !== 'default';
function fields(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    check(keys.includes(key) && descriptor.enumerable && Object.hasOwn(descriptor, 'value'));
  }
}
const overlap = (a, b) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
const same = (a, b) => a.dev === b.dev && a.ino === b.ino;
const bounded = async (promise, ms) => {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(error('TIMEOUT')), ms); })]); }
  finally { clearTimeout(timer); }
};
const MIME = Object.freeze({ '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' });
const HEADERS = Object.freeze({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" });

function readInput(route, value) {
  if (route === 'context-preview') return captureContextQuery(value);
  if (['operation', 'recover-create'].includes(route)) {
    fields(value, ['operationId']); check(uuid(value.operationId)); return { operationId: value.operationId };
  }
  if (route === 'pending') { fields(value, []); return {}; }
  if (route === 'submit') {
    fields(value, ['operationId', 'kind', 'title', 'conversationId', 'text', 'context']);
    check(uuid(value.operationId) && ['create', 'send'].includes(value.kind));
    fields(value, value.kind === 'create' ? ['operationId', 'kind', 'title'] : ['operationId', 'kind', 'conversationId', 'text', 'context']);
    const text = value.kind === 'create' ? value.title : value.text;
    check(typeof text === 'string' && text.trim().length > 0 && text.isWellFormed() && !text.includes('\0')
      && Buffer.byteLength(text) <= (value.kind === 'create' ? 256 : 16384));
    if (value.kind === 'create') return { operationId: value.operationId, kind: value.kind, title: text };
    check(entity(value.conversationId));
    return { operationId: value.operationId, kind: value.kind, conversationId: value.conversationId, text,
      ...(Object.hasOwn(value, 'context') ? { context: captureChatContext(value.context) } : {}) };
  }
  fields(value, route === 'status' ? [] : route === 'conversations' ? ['search', 'cursor'] : ['conversationId', 'cursor']);
  if (route === 'messages') check(entity(value.conversationId));
  if (value.search !== undefined) check(typeof value.search === 'string' && value.search.length <= 256 && !/[\x00-\x1f\x7f]/.test(value.search));
  if (value.cursor !== undefined) check(typeof value.cursor === 'string' && /^[a-f0-9-]{36}$/.exec(value.cursor)?.[0] === value.cursor);
  return value;
}
function receipt(record) {
  if (record === null) return null;
  const request = record?.request;
  check(uuid(request?.operationId) && ['create', 'send'].includes(request.kind)
    && ['unknown', 'completed', 'failed'].includes(record.status), 'INVALID_DATA');
  const conversationId = record.completion?.conversationId ?? (request.kind === 'send' ? request.conversationId : null);
  check(conversationId === null || entity(conversationId), 'INVALID_DATA');
  check(record.status !== 'completed' || conversationId !== null, 'INVALID_DATA');
  check(record.failure === null || ['predispatch_rejected', 'terminal_failed'].includes(record.failure), 'INVALID_DATA');
  const original = request.kind === 'create' ? request.title : request.text;
  check(typeof original === 'string' && Buffer.byteLength(original) <= (request.kind === 'create' ? 256 : 16384), 'INVALID_DATA');
  return { operationId: request.operationId, kind: request.kind, status: record.status, conversationId, failure: record.failure,
    ...(request.kind === 'create' ? { title: original } : { text: original }) };
}
function preview(value) {
  check(entity(value?.agentId) && Number.isSafeInteger(value.revision) && value.revision >= 0
    && /^[a-f0-9]{64}$/.test(value.digest) && Array.isArray(value.items) && value.items.length <= 20
    && typeof value.more === 'boolean' && Number.isSafeInteger(value.omitted) && value.omitted >= 0, 'INVALID_DATA');
  const items = value.items.map(row => {
    check(/^[a-f0-9]{64}$/.test(row.id) && typeof row.source === 'string' && row.source.length <= 128
      && typeof row.text === 'string' && Buffer.byteLength(row.text) <= 4096
      && typeof row.epistemicState === 'string' && row.epistemicState.length <= 128, 'INVALID_DATA');
    return { id: row.id, source: row.source, text: row.text, epistemicState: row.epistemicState };
  });
  return { agentId: value.agentId, revision: value.revision, digest: value.digest, items, more: value.more, omitted: value.omitted };
}
function displayPage(route, page) {
  check(page && Array.isArray(page.items) && page.items.length <= 20 && (page.cursor === null
    || (typeof page.cursor === 'string' && /^[a-f0-9-]{36}$/.exec(page.cursor)?.[0] === page.cursor)), 'INVALID_DATA');
  const text = (value, max, nullable = false) => {
    check((nullable && value === null) || (typeof value === 'string' && value.length <= max), 'INVALID_DATA'); return value;
  };
  const items = page.items.map(row => {
    if (route === 'conversations') {
      check(entity(row.id), 'INVALID_DATA');
      return { id: row.id, summary: text(row.summary, 8192, true),
        createdAt: text(row.createdAt, 64, true), lastMessageAt: text(row.lastMessageAt, 64, true) };
    }
    check(typeof row.id === 'string' && row.id.length <= 320 && ['user', 'assistant'].includes(row.role), 'INVALID_DATA');
    return { id: row.id, role: row.role, content: text(row.content, 65536), date: text(row.date, 64, true) };
  });
  if (route === 'messages') check(typeof page.omittedAttachments === 'boolean', 'INVALID_DATA');
  return { items, cursor: page.cursor, ...(route === 'messages' ? { omittedAttachments: page.omittedAttachments } : {}) };
}

/**
 * Experimental loopback read host, one owned managed session, no arbitrary RPC.
 * Await before publishing launchUrl. URL fragment is a separate browser bearer;
 * only the deliberate operator link may disclose it. Never log this handle.
 * webRoot is a trusted exported Expo directory, not user-uploaded content.
 * Third argument is trusted test seams: makeSession, public synthetic capability,
 * observe (only public managed lifecycle evidence), requestMs and listen (tests
 * of late binding, must resolve only once actually listening). No browser config.
 * 4 concurrent requests, one active read with at most 3 waiting deliveries,
 * 32 sockets, 4KiB bodies, 2MiB responses, 8MiB assets;
 * 10s request and 10s cleanup reporting deadlines. No retry or data deletion.
 */
export async function startLocalReadHost(...args) {
  try { return await openHost(...args); }
  catch (failure) { throw error(failure?.code === 'CLEANUP_FAILED' ? 'CLEANUP_FAILED' : 'START_FAILED'); }
}
async function openHost(config, options = {}, {
  makeSession = initializeManagedReadSession, capability = randomBytes(32).toString('hex'),
  observe = () => {}, requestMs = 10000,
  listen = server => new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }),
} = {}) {
  fields(config, ['dependencyRoot', 'stateRoot', 'protectedRoot', 'webRoot', 'chat']); fields(options, ['signal']);
  const chat = config.chat === undefined ? undefined : captureLocalChatConfig(config.chat);
  const captured = Object.freeze({ dependencyRoot: config.dependencyRoot, stateRoot: config.stateRoot,
    protectedRoot: config.protectedRoot, webRoot: config.webRoot });
  const signal = options.signal;
  check(signal === undefined || signal instanceof AbortSignal);
  check(typeof capability === 'string' && /^[a-f0-9]{64}$/.exec(capability)?.[0] === capability);
  check(Number.isInteger(requestMs) && requestMs > 0 && requestMs <= 10000);
  const uid = process.getuid?.(); check(Number.isInteger(uid) && constants.O_NOFOLLOW, 'UNSUPPORTED');
  for (const root of Object.values(captured)) check(typeof root === 'string' && path.isAbsolute(root)
    && path.normalize(root) === root && !root.endsWith('/'), 'INVALID_CONFIG');
  check(['dependencyRoot', 'stateRoot', 'protectedRoot'].every(key => !overlap(captured.webRoot, captured[key])), 'INVALID_CONFIG');
  const webStat = await fs.lstat(captured.webRoot);
  check(webStat.isDirectory() && webStat.uid === uid && (webStat.mode & 0o7022) === 0
    && await fs.realpath(captured.webRoot) === captured.webRoot, 'INVALID_WEB_ROOT');
  async function asset(url) {
    let relative;
    if (url === '/' || url === '/?local=1' || url === '/index.html') relative = 'index.html';
    else {
      check(typeof url === 'string' && url.length <= 1024 && /^\/(?:_expo\/static\/|assets\/|favicon\.ico$)/.test(url), 'NOT_FOUND');
      relative = url.slice(1);
      check(relative.split('/').length <= 12 && relative.split('/').every(part => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(part)
        && part !== '.' && part !== '..' && !part.includes('..')) && MIME[path.extname(relative)], 'NOT_FOUND');
    }
    const root = await fs.lstat(captured.webRoot);
    check(same(root, webStat) && root.isDirectory() && root.uid === uid && (root.mode & 0o7022) === 0, 'NOT_FOUND');
    let file = captured.webRoot;
    const parts = relative.split('/');
    for (const [index, part] of parts.entries()) {
      file = path.join(file, part); const stat = await fs.lstat(file);
      check(stat.uid === uid && (stat.mode & 0o7022) === 0 && (index === parts.length - 1
        ? stat.isFile() && stat.nlink === 1 && stat.size <= ASSET : stat.isDirectory()), 'NOT_FOUND');
    }
    const before = await fs.lstat(file);
    const handle = await fs.open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const opened = await handle.stat(); check(same(before, opened) && opened.size <= ASSET, 'NOT_FOUND');
      const bytes = Buffer.alloc(opened.size + 1); const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
      const after = await fs.lstat(file);
      check(bytesRead === opened.size && same(opened, after) && after.size === opened.size && after.mtimeMs === opened.mtimeMs, 'NOT_FOUND');
      return { bytes: bytes.subarray(0, bytesRead), type: relative === 'index.html' ? 'text/html; charset=utf-8' : MIME[path.extname(relative)] };
    } finally { await handle.close(); }
  }
  await asset('/'); check(!signal?.aborted, 'ABORTED');
  const lifetime = new AbortController(); const sockets = new Set(); const pending = new Set();
  const waitingReads = []; let activeRead = false;
  function pumpReads() {
    if (activeRead || waitingReads.length === 0) return;
    const entry = waitingReads.shift();
    entry.signal.removeEventListener('abort', entry.cancel);
    if (entry.signal.aborted) { entry.reject(error('ABORTED')); pumpReads(); return; }
    activeRead = true;
    // Keep this slot until the borrowed reader actually settles, even when the
    // HTTP delivery times out. Never replay a read or a potentially used cursor.
    Promise.resolve().then(entry.work).then(entry.resolve, entry.reject).finally(() => {
      activeRead = false; pumpReads();
    });
  }
  function serializedRead(work, signal) {
    check(!signal.aborted, 'ABORTED');
    check(waitingReads.length < 3, 'BUSY');
    return new Promise((resolve, reject) => {
      const entry = { work, signal, resolve, reject, cancel: undefined };
      entry.cancel = () => {
        const index = waitingReads.indexOf(entry);
        if (index !== -1) waitingReads.splice(index, 1);
        signal.removeEventListener('abort', entry.cancel); reject(error('ABORTED'));
      };
      signal.addEventListener('abort', entry.cancel, { once: true });
      waitingReads.push(entry); pumpReads();
    });
  }
  let token = capability; capability = undefined;
  let session; let origin; let agentId; let closing; let closed = false; let resolveTerminal; let binding;
  const terminal = new Promise(resolve => { resolveTerminal = resolve; });
  const server = createServer({ maxHeaderSize: 8192, requestTimeout: requestMs, headersTimeout: Math.min(requestMs, 5000),
    keepAliveTimeout: 2000 }, (req, res) => { void handle(req, res); });
  server.maxConnections = 32; server.maxRequestsPerSocket = 100;
  server.on('connection', socket => { sockets.add(socket); socket.setTimeout(requestMs, () => socket.destroy()); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (_req, socket) => socket.destroy());
  server.on('clientError', (_error, socket) => socket.destroy());
  server.on('error', () => { void close(); });
  const abort = () => { void close(); };
  function close() {
    if (closing) return closing;
    closed = true; token = undefined; lifetime.abort(); signal?.removeEventListener('abort', abort);
    for (const controller of pending) controller.abort();
    closing = (async () => {
      const stopped = (async () => {
        await binding?.catch(() => {});
        return new Promise(resolve => {
          if (!server.listening) return resolve(true);
          server.close(failure => resolve(!failure));
        });
      })();
      for (const socket of sockets) socket.destroy();
      const managed = Promise.resolve().then(() => session?.close());
      const results = await Promise.allSettled([bounded(stopped, 10000), bounded(managed, 10000)]);
      const httpClosed = results[0].status === 'fulfilled' && results[0].value === true;
      const sessionClosed = results[1].status === 'fulfilled' && (!session || results[1].value?.cleanup?.confirmed === true);
      const result = Object.freeze({ confirmed: httpClosed && sessionClosed, httpClosed, sessionClosed });
      resolveTerminal(result); return result;
    })();
    return closing;
  }
  function reply(res, status, value) {
    const bytes = Buffer.from(JSON.stringify(value)); check(bytes.length <= RESPONSE, 'RESPONSE_LIMIT');
    if (!res.destroyed) { res.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': bytes.length }); res.end(bytes); }
  }
  function oneHeader(req, name) {
    check(req.rawHeaders.filter((_, index) => index % 2 === 0 && req.rawHeaders[index].toLowerCase() === name).length === 1, 'DENIED');
    return req.headers[name];
  }
  async function handle(req, res) {
    const controller = new AbortController();
    const deadline = Date.now() + requestMs;
    const remaining = () => { check(Date.now() < deadline, 'TIMEOUT'); return deadline - Date.now(); };
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    let timer;
    try {
      check(!closed && origin, 'CLOSED');
      check(oneHeader(req, 'host') === origin.slice(7), 'DENIED');
      check(req.url?.length <= 1024 && pending.size < 4, 'BUSY');
      pending.add(controller); timer = setTimeout(() => controller.abort(), requestMs);
      req.on('aborted', disconnected); res.on('close', disconnected);
      const route = { '/api/local/status': 'status', '/api/local/conversations': 'conversations', '/api/local/messages': 'messages',
        '/api/local/submit': 'submit', '/api/local/operation': 'operation', '/api/local/pending': 'pending',
        '/api/local/recover-create': 'recover-create', '/api/local/context-preview': 'context-preview' }[req.url];
      if (route) {
        check(session.status().phase === 'ready', 'CLOSED');
        check(req.method === 'POST' && oneHeader(req, 'origin') === origin && !req.headers.cookie, 'DENIED');
        const authorization = oneHeader(req, 'authorization');
        check(typeof authorization === 'string' && /^Bearer [a-f0-9]{64}$/.exec(authorization)?.[0] === authorization
          && token && timingSafeEqual(Buffer.from(authorization.slice(7), 'hex'), Buffer.from(token, 'hex')), 'DENIED');
        check(oneHeader(req, 'content-type') === 'application/json' && !req.headers['content-encoding'], 'INVALID_REQUEST');
        const bodyLimit = route === 'submit' ? SUBMIT_BODY : BODY;
        if (req.headers['content-length']) check(/^\d+$/.test(req.headers['content-length']) && Number(req.headers['content-length']) <= bodyLimit, 'BODY_LIMIT');
        const chunks = []; let length = 0;
        const read = (async () => { for await (const chunk of req) { length += chunk.length; check(length <= bodyLimit, 'BODY_LIMIT'); chunks.push(chunk); } })();
        await bounded(read, remaining()); check(!controller.signal.aborted, 'ABORTED');
        const input = readInput(route, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))));
        let work;
        if (route === 'status') {
          const current = session.status(); const activeOperationId = current.activeOperationId ?? null;
          check(activeOperationId === null || uuid(activeOperationId), 'INVALID_DATA');
          work = { phase: 'ready', agentId, chatEnabled: Boolean(chat && session.chat), activeOperationId };
        } else if (['conversations', 'messages'].includes(route)) {
          work = serializedRead(() => route === 'conversations' ? session.listConversations(input, { signal: controller.signal })
            : session.listMessages(input.conversationId, input.cursor === undefined ? {} : { cursor: input.cursor }, { signal: controller.signal }), controller.signal);
        } else {
          check(chat && session.chat, 'CHAT_DISABLED');
          // Delivery cancellation never becomes operation cancellation. These
          // named methods reserve synchronously; no request signal or retry.
          if (route === 'submit') work = receipt(session.chat.submit(input));
          if (route === 'operation') work = receipt(session.chat.get(input.operationId));
          if (route === 'recover-create') work = receipt(session.chat.recoverCreate(input.operationId));
          if (route === 'pending') { const rows = session.chat.listPending(); check(Array.isArray(rows) && rows.length <= 1, 'INVALID_DATA'); work = { items: rows.map(receipt) }; }
          if (route === 'context-preview') work = Promise.resolve(session.chat.previewContext(input)).then(preview);
        }
        const data = await bounded(work, remaining()); check(!closed && !controller.signal.aborted, 'ABORTED');
        reply(res, 200, { ok: true, data: ['conversations', 'messages'].includes(route) ? displayPage(route, data) : data });
      } else {
        check(req.method === 'GET', 'NOT_FOUND'); const file = await bounded(asset(req.url), remaining());
        check(!closed && !controller.signal.aborted, 'ABORTED');
        res.writeHead(200, { ...HEADERS, 'Content-Type': file.type, 'Content-Length': file.bytes.length }); res.end(file.bytes);
      }
    } catch (failure) {
      controller.abort(); // A deadline race must not leave this delivery alive.
      const code = ['DENIED', 'NOT_FOUND', 'BUSY', 'BODY_LIMIT', 'RESPONSE_LIMIT', 'ABORTED', 'TIMEOUT', 'CLOSED', 'CHAT_DISABLED', 'CONFLICT', 'INVALID', 'MISSING'].includes(failure?.code) ? failure.code : 'READ_FAILED';
      res.shouldKeepAlive = false;
      if (!req.complete) { res.once('finish', () => req.socket.destroy()); req.resume(); }
      if (!res.headersSent) reply(res, code === 'DENIED' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'BUSY' ? 429 : 400, { ok: false, error: code });
    } finally { clearTimeout(timer); pending.delete(controller); req.off('aborted', disconnected); res.off('close', disconnected); }
  }
  signal?.addEventListener('abort', abort, { once: true });
  try {
    check(!signal?.aborted, 'ABORTED');
    session = makeSession({ dependencyRoot: captured.dependencyRoot, stateRoot: captured.stateRoot,
      protectedRoot: captured.protectedRoot, retainedOnly: true, ...(chat ? { chat } : {}) }, { signal: lifetime.signal }, { observe });
    void session.terminal.then(() => close(), () => close());
    const identity = await bounded(session.ready, 32000); check(!closed && entity(identity?.agentId), 'NOT_READY'); agentId = identity.agentId;
    binding = listen(server);
    // close awaits this bind before closing; its underlying cleanup continues
    // even if the bounded reporting deadline marks cleanup unconfirmed.
    await binding;
    check(!closed, 'CLOSED'); origin = `http://127.0.0.1:${server.address().port}`;
    return Object.freeze({ origin, agentId, launchUrl: `${origin}/?local=1#capability=${token}`, terminal, close });
  } catch {
    const result = await close(); throw error(result.confirmed ? 'START_FAILED' : 'CLEANUP_FAILED');
  }
}
