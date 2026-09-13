// WP-0041: synthetic, no-provider contract evidence, not a migration tool.
// Protocol: letta-ai/letta-code@1cf724938689a8f2bdb63bc03807db79a73d8f2d
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const VERSION = '0.32.5';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// Deliberately not the product's six-block schema: this proves file I/O only.
const LABELS = Array.from({ length: 6 }, (_, index) => `SYNTHETIC_RECORD_${index + 1}`);
const COMMANDS = Object.freeze({
  app_server_info: [], agent_list: ['query'], agent_create: ['body'],
  agent_retrieve: ['agent_id'], conversation_create: ['body'],
  conversation_update: ['conversation_id', 'body'],
  conversation_retrieve: ['conversation_id'], conversation_list: ['query'],
  read_memory_file: ['agent_id', 'path', 'encoding'],
  write_memory_file: ['agent_id', 'path', 'content', 'encoding'],
});
const READ_ONLY = new Set(['app_server_info', 'agent_list', 'agent_retrieve',
  'conversation_retrieve', 'conversation_list', 'read_memory_file']);

function requireValue(condition, code) {
  if (!condition) throw new Error(code);
}
function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, keys) {
  return record(value) && Object.keys(value).length === keys.length &&
    keys.every(key => Object.hasOwn(value, key));
}
function validId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(value) && value !== 'default';
}
function sameTags(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length &&
    actual.every(tag => typeof tag === 'string') &&
    [...actual].sort().join('\n') === [...expected].sort().join('\n');
}

export function validateEndpoint(endpoint) {
  // Check the literal before URL parsing: URL normalizes decimal/octal/hex IPs.
  const match = typeof endpoint === 'string' &&
    /^ws:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})\/ws$/.exec(endpoint);
  requireValue(match && match[0] === endpoint && Number(match[2]) <= 65535, 'invalid_endpoint');
  return endpoint;
}

export function validateReceipt(value) {
  requireValue(exactKeys(value, ['schema', 'version', 'run_id', 'agent_id', 'conversation_id', 'memory_written']) &&
    value.schema === 'wp0041-receipt-v1' && value.version === VERSION && UUID.test(value.run_id) &&
    validId(value.agent_id) && validId(value.conversation_id) && typeof value.memory_written === 'boolean', 'invalid_receipt');
  return { ...value };
}

export async function connectProtocol(endpoint, { WebSocketImpl = globalThis.WebSocket, timeoutMs = 5000, readOnly = false } = {}) {
  validateEndpoint(endpoint);
  requireValue(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 10000, 'invalid_timeout');
  requireValue(typeof WebSocketImpl === 'function', 'websocket_unavailable');
  const socket = new WebSocketImpl(endpoint);
  let pending;
  let closed = false;
  let connectReject;
  function close() {
    if (closed) return;
    closed = true;
    socket.close();
  }
  function fail(code) {
    if (pending) { clearTimeout(pending.timer); pending.reject(new Error(code)); pending = undefined; }
    if (connectReject) connectReject(new Error(code));
    close();
  }
  socket.addEventListener('error', () => fail('socket_error'));
  socket.addEventListener('close', () => fail('socket_closed'));
  socket.addEventListener('message', event => {
    if (closed) return;
    if (typeof event.data !== 'string' || event.data.length > 1_000_000) return fail('invalid_message');
    let message;
    try { message = JSON.parse(event.data); } catch { return fail('invalid_message'); }
    if (!record(message) || typeof message.type !== 'string') return fail('invalid_message');
    // Never answer tools, permissions, auth challenges or unsolicited instructions.
    if (!pending) return;
    if (message.request_id !== pending.id) return; // cannot settle a different request
    if (message.type !== pending.responseType) return fail('unexpected_response');
    if (typeof message.success !== 'boolean') return fail('invalid_response');
    clearTimeout(pending.timer);
    const current = pending;
    pending = undefined;
    if (!message.success) { current.reject(new Error('server_rejected')); close(); return; }
    current.resolve(message);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => fail('connect_timeout'), timeoutMs);
    connectReject = error => { clearTimeout(timer); reject(error); };
    socket.addEventListener('open', () => {
      if (closed) return;
      clearTimeout(timer); connectReject = undefined; resolve();
    }, { once: true });
  });
  return {
    close,
    request(type, fields = {}) {
      requireValue(Object.hasOwn(COMMANDS, type) && (!readOnly || READ_ONLY.has(type)), 'forbidden_command');
      requireValue(record(fields) && Object.keys(fields).every(key => COMMANDS[type].includes(key)), 'forbidden_field');
      requireValue(!closed && !pending, 'transport_unavailable');
      return new Promise((resolve, reject) => {
        const id = randomUUID();
        pending = { id, responseType: `${type}_response`, resolve, reject,
          timer: setTimeout(() => fail('request_timeout'), timeoutMs) };
        try { socket.send(JSON.stringify({ type, request_id: id, ...fields })); }
        catch { fail('send_failed'); }
      });
    },
  };
}

function synthetic(runId) {
  const marker = `wp0041:${runId}`;
  return {
    marker, name: `wp0041-${runId}`,
    initialSummary: `${marker}: synthetic learning conversation`,
    summary: `${marker}: reviewed synthetic decomposition`,
    initialTags: [marker, 'wp0041:category:learning'],
    tags: [marker, 'wp0041:category:learning', 'wp0041:manual:true'],
    memories: LABELS.map(label => ({ path: `wp0041/${runId}/${label}.md`, content: `${marker}\n${label}: synthetic fixture only\n` })),
  };
}

function checkAgent(agent, expectedId, data) {
  requireValue(record(agent) && validId(agent.id) && (!expectedId || agent.id === expectedId) &&
    agent.name === data.name && Array.isArray(agent.tags) &&
    agent.tags.every(tag => typeof tag === 'string') && agent.tags.includes(data.marker), 'agent_ownership_mismatch');
  return agent.id;
}
function checkConversation(conversation, expectedId, agentId, data, updated) {
  requireValue(record(conversation) && validId(conversation.id) && (!expectedId || conversation.id === expectedId) &&
    conversation.agent_id === agentId && conversation.summary === (updated ? data.summary : data.initialSummary) &&
    sameTags(conversation.tags, updated ? data.tags : data.initialTags), 'conversation_readback_mismatch');
  return conversation.id;
}
function checkMemory(response, agentId, memory, read) {
  requireValue(response.agent_id === agentId && response.path === memory.path &&
    (!read || (response.encoding === 'utf8' && response.content === memory.content)), 'memory_readback_mismatch');
}

export async function runProbe({ endpoint, mode = 'create', receipt, WebSocketImpl, timeoutMs } = {}) {
  requireValue(mode === 'create' || mode === 'verify', 'invalid_mode');
  const saved = mode === 'verify' ? validateReceipt(receipt) : undefined;
  requireValue(mode === 'verify' || receipt === undefined, 'unexpected_receipt');
  const runId = saved?.run_id ?? randomUUID();
  const data = synthetic(runId);
  const results = [];
  const unresolved = ['six_block_read_only_enforcement', 'structured_provenance', 'exact_archive_crud',
    'privacy_retention', 'model_switching', 'atomic_snapshot'];
  let stage = 'connect';
  let client;
  try {
    client = await connectProtocol(endpoint, { WebSocketImpl, timeoutMs, readOnly: mode === 'verify' });
    stage = 'info';
    const info = await client.request('app_server_info');
    requireValue(info.backend === 'local' && info.letta_code_version === VERSION && info.protocol_version === 1 &&
      record(info.capabilities) && ['agent_management', 'conversation_management', 'memory_management', 'runtime_start', 'split_channels']
        .every(key => typeof info.capabilities[key] === 'boolean'), 'runtime_contract_mismatch');
    requireValue(info.capabilities.agent_management && info.capabilities.conversation_management, 'required_capability_unavailable');
    results.push({ contract: 'runtime_info', observation: 'matched', version: info.letta_code_version, backend: info.backend });
    let agentId = saved?.agent_id;
    let conversationId = saved?.conversation_id;
    async function ownAgent() {
      checkAgent((await client.request('agent_retrieve', { agent_id: agentId })).agent, agentId, data);
    }
    stage = 'agent_identity';
    if (mode === 'create') {
      const before = await client.request('agent_list', { query: { tags: [data.marker], limit: 100 } });
      requireValue(Array.isArray(before.agents) && before.agents.length === 0, 'marker_not_fresh');
      const created = await client.request('agent_create', { body: { name: data.name, tags: [data.marker], tools: [], memory_blocks: [] } });
      agentId = checkAgent(created.agent, undefined, data);
    }
    await ownAgent();
    results.push({ contract: 'tagged_agent_identity', observation: 'matched', agent_id: agentId });
    stage = 'conversation_roundtrip';
    if (mode === 'create') {
      await ownAgent();
      const created = await client.request('conversation_create', { body: { agent_id: agentId, summary: data.initialSummary, tags: data.initialTags } });
      conversationId = checkConversation(created.conversation, undefined, agentId, data, false);
      await ownAgent();
      checkConversation((await client.request('conversation_retrieve', { conversation_id: conversationId })).conversation,
        conversationId, agentId, data, false);
      checkConversation((await client.request('conversation_update', { conversation_id: conversationId,
        body: { summary: data.summary, tags: data.tags } })).conversation, conversationId, agentId, data, true);
    }
    checkConversation((await client.request('conversation_retrieve', { conversation_id: conversationId })).conversation,
      conversationId, agentId, data, true);
    const listed = await client.request('conversation_list', { query: { agent_id: agentId, limit: 100 } });
    requireValue(Array.isArray(listed.conversations) && listed.conversations.length === 1, 'conversation_list_mismatch');
    checkConversation(listed.conversations[0], conversationId, agentId, data, true);
    results.push({ contract: 'same_agent_conversation_summary_tags', observation: 'matched', conversation_id: conversationId });
    stage = 'memory_roundtrip';
    let memoryWritten = saved?.memory_written ?? false;
    if (mode === 'verify' && memoryWritten) requireValue(info.capabilities.memory_management, 'memory_capability_lost');
    if ((mode === 'create' && info.capabilities.memory_management) || memoryWritten) {
      for (const memory of data.memories) {
        if (mode === 'create') {
          await ownAgent();
          checkMemory(await client.request('write_memory_file', { agent_id: agentId, ...memory, encoding: 'utf8' }), agentId, memory, false);
        }
        checkMemory(await client.request('read_memory_file', { agent_id: agentId, path: memory.path, encoding: 'utf8' }), agentId, memory, true);
      }
      memoryWritten = true;
      results.push({ contract: 'six_synthetic_memory_files', observation: 'matched', count: data.memories.length });
    } else results.push({ contract: 'six_synthetic_memory_files', observation: 'not_observed', reason: 'not_written_or_capability_unavailable' });
    return { mode, outcome: 'observations_complete', results, unresolved,
      restart_process_observed: false,
      receipt: { schema: 'wp0041-receipt-v1', version: VERSION, run_id: runId, agent_id: agentId, conversation_id: conversationId, memory_written: memoryWritten } };
  } catch (error) {
    // Do not print raw server responses, which might contain private data.
    return { mode, outcome: 'stopped', stage, error: error instanceof Error ? error.message : 'probe_failed', results, unresolved };
  } finally { client?.close(); }
}

async function main() {
  const [mode, endpoint, receiptJson, ...extra] = process.argv.slice(2);
  requireValue(extra.length === 0 && (mode === 'create' || mode === 'verify') &&
    (mode === 'create' ? receiptJson === undefined : typeof receiptJson === 'string' && receiptJson.length <= 2048), 'usage: create <loopback-ws-url> | verify <loopback-ws-url> <receipt-json>');
  const receipt = mode === 'verify' ? JSON.parse(receiptJson) : undefined;
  const result = await runProbe({ endpoint, mode, receipt });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.outcome === 'stopped') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { process.stderr.write('Probe arguments or receipt invalid; no retry performed.\n'); process.exitCode = 1; });
}
