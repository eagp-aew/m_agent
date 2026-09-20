import path from 'node:path';
import { createAuthenticatedAppServer } from './authenticated-app-server.mjs';
import { createConversationReader } from './conversation-reader.mjs';
import { startOwned, validateEndpoint, listenerGone } from './runtime-process.mjs';
import { prepareAssistantBootstrap } from './assistant-bootstrap.mjs';
import { captureLocalChatConfig, createRuntimeSandbox, deriveLocalChatSandbox, createLocalChatProviderGuard } from './runtime-sandbox.mjs';
import { openChatOperationStore } from './chat-operation-store.mjs';
import { createLocalChatOperations } from './local-chat-operations.mjs';

const leases = new Set();
class SessionError extends Error {
  constructor(code) { super('Managed read session failed.'); this.code = code; }
}
const check = (value, code) => { if (!value) throw new SessionError(code); };
function exact(value, keys) {
  check(value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value)), 'INVALID_CONFIG');
  for (const key of Reflect.ownKeys(value)) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    check(typeof key === 'string' && keys.includes(key) && field.enumerable
      && Object.hasOwn(field, 'value'), 'INVALID_CONFIG');
  }
}
async function bounded(promise, ms) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new SessionError('DEADLINE')), Math.max(1, ms));
    })]);
  } finally { clearTimeout(timer); }
}

/**
 * Experimental macOS existing-Agent host session. No Agent bootstrap, HTTP or
 * browser authentication, provider turns, canonical-memory integration, privacy
 * retention, restart/recovery or production deployment guarantee.
 *
 * The immediate handle has ready (resolves undefined or rejects a static error),
 * terminal (always resolves a sanitized cleanup result), status(), read methods
 * and idempotent close(). ready has an internal rejection observer so a caller
 * may await terminal/close first without creating an unhandled rejection.
 * Readiness proves pinned authenticated info and one native-visible tagged
 * expected Agent only. Caller must still await ready before invoking reads.
 *
 * Roots/Agent are captured before awaits. The unchanged sandbox validates paths
 * before spawn. The in-memory exact-stateRoot lease is confined to this loaded
 * host module, NOT a disk lock or cross-process exclusivity promise. Host must
 * control directories. Uncertain cleanup keeps its lease until host recovery.
 *
 * Lifetime cancellation terminates the owned connection/process. Per-read abort
 * only cancels reader delivery and does not close this session. Startup deadline
 * is 25s and terminal cleanup budget is 7s; late resources are disposed, never
 * promoted to ready. No automatic retry/restart. Raw logs/spec/client/capability
 * never cross this handle. Third argument is trusted tests only, not user/model
 * options; observe receives only public lifecycle evidence, never credentials.
 */
export function createManagedReadSession(config, options = {}, seams = {}) {
  return managedSession(config, options, seams, false);
}

/** Roots-only first-run/reopen entrypoint. ready resolves {agentId}, not memory.
 * Uses the same runtime owner; initialization adds a cooperative disk lock and
 * irreversible creation intent. Pending/ambiguous creation never auto-retries.
 * Optional trusted chat:{providerPort,model} enables host-private segment B.
 * Explicit per-message canonical context preview/admission is host-private;
 * HTTP/browser enablement remains separate. No arbitrary RPC/settings return.
 */
export function initializeManagedReadSession(config, options = {}, seams = {}) {
  return managedSession(config, options, seams, true);
}

function managedSession(config, options, {
  makeAuth = createAuthenticatedAppServer, start = startOwned, checkListenerGone = listenerGone,
  prepare = prepareAssistantBootstrap,
  makeProviderGuard = createLocalChatProviderGuard,
  openOperations = openChatOperationStore, operationMs = 180000,
  startupMs = 25000, cleanupMs = 7000, observe = () => {},
}, initialize) {
  exact(config, ['dependencyRoot', 'stateRoot', 'protectedRoot', 'retainedOnly', ...initialize ? ['chat'] : ['agentId']]);
  let chatConfig;
  if (config.chat !== undefined) {
    try { chatConfig = captureLocalChatConfig(config.chat); } catch { throw new SessionError('INVALID_CONFIG'); }
  }
  exact(options, ['signal']);
  const retainedOnly = config.retainedOnly === undefined ? false : config.retainedOnly;
  check(typeof retainedOnly === 'boolean', 'INVALID_CONFIG');
  let { agentId } = config;
  check(initialize || (typeof agentId === 'string' && agentId !== 'default' && agentId.length <= 128
    && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.exec(agentId)?.[0] === agentId), 'INVALID_CONFIG');
  const roots = Object.freeze({ dependencyRoot: config.dependencyRoot, stateRoot: config.stateRoot, protectedRoot: config.protectedRoot });
  for (const value of Object.values(roots)) check(typeof value === 'string'
    && path.isAbsolute(value) && path.normalize(value) === value && value.startsWith('/private/tmp/'), 'INVALID_CONFIG');
  check(Number.isInteger(startupMs) && startupMs > 0 && startupMs <= 25000
    && Number.isInteger(cleanupMs) && cleanupMs > 0 && cleanupMs <= 7000, 'INVALID_TEST_SEAM');
  const external = options.signal;
  check(external === undefined || external instanceof AbortSignal, 'INVALID_CONFIG');
  check(!leases.has(roots.stateRoot), 'STATE_IN_USE');
  leases.add(roots.stateRoot);
  const lifetime = new AbortController();
  let phase = 'starting';
  let reason = null;
  let auth;
  let child;
  let client;
  let reader;
  let preparation;
  let operationStore;
  let operations;
  let providerGuard;
  let endpoint;
  let cleanupTask;
  let lateCleanupFailed = false;
  let resolveReady;
  let rejectReady;
  let resolveTerminal;
  const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  void ready.catch(() => {});
  const terminal = new Promise(resolve => { resolveTerminal = resolve; });
  const announce = value => { try { observe(Object.freeze(value)); } catch { /* Observers do not control lifecycle. */ } };
  const abort = () => transition('ABORTED');
  const startupTimer = setTimeout(() => transition('STARTUP_TIMEOUT'), startupMs);
  let startupTask;

  function transition(code) {
    if (phase === 'closing' || phase === 'closed' || phase === 'failed') return terminal;
    phase = 'closing'; reason = code; clearTimeout(startupTimer);
    reader?.close(); // Invalidate delivery before awaiting any cleanup work.
    void operations?.close();
    rejectReady(new SessionError(code));
    lifetime.abort(); external?.removeEventListener('abort', abort);
    cleanupTask = cleanup();
    void cleanupTask.catch(() => {
      phase = 'failed';
      resolveTerminal(Object.freeze({ phase, reason, cleanup: Object.freeze({ confirmed: false }),
        errors: Object.freeze(['CLEANUP_FAILED']) }));
    });
    return terminal;
  }
  async function cleanup() {
    const deadline = Date.now() + cleanupMs;
    const failures = [];
    let authClosed = true;
    let processReaped = true;
    let groupGone = true;
    let portGone = null;
    async function attempt(code, fn) {
      try { check(Date.now() < deadline, 'DEADLINE'); return await bounded(Promise.resolve().then(fn), deadline - Date.now()); }
      catch { failures.push(code); return undefined; }
    }
    // Close already-owned resources first; stopping the child also settles a
    // pending endpoint wait. Then reconcile late factory/connect completions.
    if (auth) authClosed = await attempt('AUTH_CLEANUP_FAILED', async () => { await auth.dispose(); return true; }) === true;
    if (child) {
      const result = await attempt('PROCESS_CLEANUP_FAILED', () => child.stop());
      processReaped = result?.reaped === true; groupGone = result?.groupGone === true;
      if (!processReaped || !groupGone) failures.push('PROCESS_UNCONFIRMED');
      announce({ type: 'process_cleanup', pid: child.pid ?? null, reaped: processReaped, groupGone });
    }
    const settled = await attempt('STARTUP_UNSETTLED', async () => { await startupTask.catch(() => {}); return true; });
    if (settled && auth) authClosed = await attempt('AUTH_CLEANUP_FAILED', async () => { await auth.dispose(); return true; }) === true;
    if (operations) await attempt('CHAT_UNSETTLED', () => operations.close());
    if (operationStore) await attempt('CHAT_STORE_CLEANUP_FAILED', () => operationStore.close());
    if (preparation) await attempt('BOOTSTRAP_CLEANUP_FAILED', () => preparation.close());
    if (lateCleanupFailed) { failures.push('LATE_CLEANUP_FAILED'); authClosed = false; }
    if (endpoint) portGone = await attempt('LISTENER_CLEANUP_FAILED', () => checkListenerGone(endpoint)) === true;
    if (portGone === false) failures.push('LISTENER_UNCONFIRMED');
    const confirmed = failures.length === 0 && authClosed && processReaped && groupGone && portGone !== false;
    if (confirmed) leases.delete(roots.stateRoot);
    phase = confirmed ? 'closed' : 'failed';
    const result = Object.freeze({ phase, reason,
      cleanup: Object.freeze({ confirmed, authClosed, processReaped, groupGone, listenerGone: portGone }),
      errors: Object.freeze([...new Set(failures)]) });
    announce({ type: 'terminal', ...result }); resolveTerminal(result);
  }
  startupTask = Promise.resolve().then(async () => {
    if (phase !== 'starting') return;
    auth = await makeAuth(roots, ...(chatConfig ? [{ makeSandbox: async captured =>
      deriveLocalChatSandbox(await createRuntimeSandbox(captured), chatConfig) }] : []));
    if (phase !== 'starting') {
      try { await auth.dispose(); } catch { lateCleanupFailed = true; }
      return;
    }
    if (initialize) {
      try { preparation = await prepare(roots, { signal: lifetime.signal }); }
      catch (error) { if (error.code === 'CLEANUP_FAILED') lateCleanupFailed = true; throw error; }
      if (phase !== 'starting') {
        try { await preparation.close(); } catch { lateCleanupFailed = true; }
        return;
      }
    }
    if (chatConfig) {
      await preparation.assertOwnership();
      if (phase !== 'starting') return;
      providerGuard = await makeProviderGuard(roots.stateRoot);
      await preparation.assertOwnership();
      if (phase !== 'starting') return;
    }
    child = start(auth.launchSpec);
    void child.failed.then(() => transition('PROCESS_FAILED'));
    void child.done.then(() => transition('PROCESS_EXITED'));
    announce({ type: 'spawned', pid: child.pid ?? null });
    if (phase !== 'starting') return;
    endpoint = validateEndpoint(await child.endpoint());
    announce({ type: 'endpoint', endpoint });
    if (phase !== 'starting') return;
    client = await auth.connect(endpoint, { signal: lifetime.signal });
    if (phase !== 'starting') {
      try { await client.close(); } catch { lateCleanupFailed = true; }
      return;
    }
    void client.closed.then(clean => transition(clean === false ? 'SOCKET_CLEANUP_FAILED' : 'SOCKET_CLOSED'));
    if (initialize) {
      let identity;
      try { identity = await preparation.resolve(client); }
      finally {
        // Cleanup may already have exhausted its deadline while filesystem IO
        // was pending. Still release our late-settled preparation; never ready.
        if (phase !== 'starting') try { await preparation.close(); } catch { lateCleanupFailed = true; }
      }
      if (phase !== 'starting') return;
      agentId = identity.agentId;
    }
    const response = await client.request('agent_list', { query: { tags: ['personal-co-v1'], limit: 2 } }, { signal: lifetime.signal });
    check(response?.success === true && Array.isArray(response.agents) && response.agents.length === 1
      && response.agents[0]?.id === agentId && Array.isArray(response.agents[0].tags)
      && response.agents[0].tags.length <= 32 && response.agents[0].tags.every(tag => typeof tag === 'string' && tag.length <= 256)
      && response.agents[0].tags.includes('personal-co-v1'), 'AGENT_MISMATCH');
    if (phase !== 'starting') return;
    if (chatConfig) {
      await preparation.assertOwnership(); await providerGuard.check(); await preparation.assertOwnership();
      if (phase !== 'starting') return;
      operationStore = openOperations({ directory: roots.protectedRoot, agentId });
      operations = createLocalChatOperations({ store: operationStore, agentId, model: chatConfig.model,
        readMemory: () => preparation.readMemory(),
        signal: lifetime.signal, operationMs, stop: () => transition('CHAT_UNCERTAIN'),
        connect: async () => {
          try {
            check(phase === 'ready', 'NOT_READY');
            await preparation.assertOwnership(); await providerGuard.check(); await preparation.assertOwnership();
            check(phase === 'ready', 'NOT_READY');
          } catch { void transition('PROVIDER_ADMISSION_FAILED'); throw new SessionError('PROVIDER_ADMISSION_FAILED'); }
          return auth.connectChat(endpoint, { agentId, stateRoot: roots.stateRoot, ...chatConfig }, { signal: lifetime.signal });
        } });
    }
    reader = createConversationReader(client, { agentId, retainedOnly,
      ...(operations ? { originalUser: value => operations.originalUser(value) } : {}) });
    phase = 'ready'; clearTimeout(startupTimer); resolveReady(initialize ? Object.freeze({ agentId }) : undefined); announce({ type: 'ready' });
  });
  void startupTask.catch(failure => transition(failure instanceof SessionError ? failure.code : 'STARTUP_FAILED'));
  external?.addEventListener('abort', abort, { once: true });
  if (external?.aborted) abort();

  async function read(method, args) {
    check(phase === 'ready', 'NOT_READY');
    try {
      const value = await reader[method](...args);
      check(phase === 'ready', 'NOT_READY'); return value;
    } catch (failure) {
      throw new SessionError(phase !== 'ready' ? 'NOT_READY' : failure?.code === 'ABORTED' ? 'READ_ABORTED' : 'READ_FAILED');
    }
  }
  return Object.freeze({ ready, terminal, status: () => Object.freeze({ phase, reason,
    chatEnabled: Boolean(chatConfig), activeOperationId: operations?.activeOperationId() ?? null }),
    ...(chatConfig ? { chat: Object.freeze({
      previewContext(input) { check(phase === 'ready', 'NOT_READY'); return operations.previewContext(input); },
      submit(value) { check(phase === 'ready', 'NOT_READY'); return operations.submit(value); },
      get(operationId) { check(phase === 'ready', 'NOT_READY'); return operations.get(operationId); },
      listPending() { check(phase === 'ready', 'NOT_READY'); return operations.listPending(); },
      recoverCreate(operationId) { check(phase === 'ready', 'NOT_READY'); return operations.recoverCreate(operationId); },
    }) } : {}),
    listConversations: (...args) => read('listConversations', args),
    listMessages: (...args) => read('listMessages', args),
    close: () => transition('CLOSED'),
  });
}
