import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { deriveProbeSpec, createTurnEvidence, startSyntheticProvider, probeLocalChatTurn } from '../server/probe-local-chat-turn.mjs';
const { WebSocketServer } = createRequire(new URL('../server/package.json', import.meta.url))('ws');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const scope = { agent_id: 'agent-synthetic', conversation_id: 'conv-synthetic' };
const accepted = { type: 'input_accepted', request_id: 'request-1', runtime: scope, accepted: true, disposition: 'started' };
const mapped = { type: 'update_loop_status', runtime: scope, loop_status: { client_message_ids_by_run_id: { 'run-1': ['client-1'] } } };
const finished = { type: 'turn_finished', runtime: scope, run_id: 'run-1', turn_id: 'turn-1', stop_reason: 'end_turn' };
const base = { command: '/usr/bin/sandbox-exec', profile: '(version 1)\n(deny default)\n', args: ['-p', '(version 1)\n(deny default)\n', '/fake/node', '/fake/cli', 'server'],
  options: { cwd: '/private/tmp/owned/state', env: { PATH: '/explicit' }, shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] } };
// Pinned shared-reminder catalog order; dynamic host fields stay synthetic.
const reminders = [
  "<system-reminder>\nThis is an automated message providing context about the user's environment.\nThis conversation is now connected to a Letta Code execution environment.\n\n## Device Information\n- **Local time**: synthetic\n- **Device type**: desktop\n- **Letta Code version**: 0.32.5\n- **Current working directory**: /private/tmp/owned/state\n- **Git repository**: No\n</system-reminder>",
  `<system-reminder> This is an automated message providing information about you.\n- **Agent ID (also stored in \`AGENT_ID\` env var)**: ${scope.agent_id}\n- **Conversation ID (also stored in \`CONVERSATION_ID\` env var)**: ${scope.conversation_id}\n- **Agent name**: Personal Co (the user can change this with /rename)\n- **Agent description**: (no description) (the user can change this with /description)\n- **Last message**: No previous messages\n</system-reminder>`,
  '<system-reminder>\nMCP servers with available tools: None\n</system-reminder>',
].map(text => ({ type: 'text', text }));

test('derived probe grants only owned provider port, baseline remains unchanged and environment is not inherited', () => {
  const spec = deriveProbeSpec(base, 12345, 'a'.repeat(64));
  assert.equal(spec.profile, `${base.profile}(allow network-outbound (remote ip "localhost:12345"))\n`);
  assert.deepEqual(spec.options.env, { PATH: '/explicit', LMSTUDIO_BASE_URL: 'http://127.0.0.1:12345/v1' });
  assert.equal(base.options.env.LMSTUDIO_BASE_URL, undefined);
  assert.deepEqual(spec.args.slice(-4), ['--ws-auth', 'capability-token', '--ws-token-sha256', 'a'.repeat(64)]);
  assert.throws(() => deriveProbeSpec(base, '12345', 'a'.repeat(64)));
  assert.throws(() => deriveProbeSpec(base, 65536, 'a'.repeat(64)));
});

test('acceptance is not completion; out-of-order terminal/mapping must both correlate', () => {
  for (const order of [[accepted, mapped, finished], [finished, accepted, mapped], [mapped, finished, accepted]]) {
    const reducer = createTurnEvidence(scope, 'client-1', 'request-1');
    assert.equal(reducer.accept(order[0]), null); assert.equal(reducer.accept(order[1]), null);
    assert.deepEqual(reducer.accept(order[2]), { accepted: true, runId: 'run-1', turnId: 'turn-1', stopReason: 'end_turn', error: false });
  }
});

test('foreign identities, duplicate receipts/terminals, malformed maps and finite frames fail closed', () => {
  const make = () => createTurnEvidence(scope, 'client-1', 'request-1');
  assert.throws(() => make().accept({ ...accepted, request_id: 'foreign' }));
  assert.throws(() => make().accept({ ...accepted, runtime: undefined }));
  assert.throws(() => make().accept({ ...finished, stop_reason: 'SECRET_UNTRUSTED_TEXT' }));
  assert.throws(() => make().accept({ ...mapped, runtime: { ...scope, agent_id: 'foreign' } }));
  assert.throws(() => make().accept({ ...mapped, loop_status: { client_message_ids_by_run_id: { r: 'bad' } } }));
  const duplicate = make(); duplicate.accept(accepted); assert.throws(() => duplicate.accept(accepted));
  const terminal = make(); terminal.accept(finished); assert.throws(() => terminal.accept(finished));
  const limit = make(); for (let index = 0; index < 2048; index++) limit.accept({ type: 'update_queue', runtime: scope });
  assert.throws(() => limit.accept({ type: 'update_queue', runtime: scope }));
});

test('reused process-local run ID still requires the current input acceptance, client mapping and matching terminal', () => {
  const first = createTurnEvidence(scope, 'client-1', 'request-1');
  first.accept(accepted); first.accept(mapped); assert.equal(first.accept(finished).runId, 'run-1');
  const restarted = createTurnEvidence(scope, 'client-2', 'request-2');
  assert.equal(restarted.accept({ ...accepted, request_id: 'request-2' }), null);
  assert.equal(restarted.accept(finished), null);
  assert.equal(restarted.accept(mapped), null); // Old client mapping cannot finish this input.
  assert.equal(restarted.accept({ ...mapped, loop_status: { client_message_ids_by_run_id: { 'run-1': ['client-2'] } } }).runId, 'run-1');
  const mismatched = createTurnEvidence(scope, 'client-2', 'request-2');
  mismatched.accept({ ...accepted, request_id: 'request-2' });
  mismatched.accept({ ...mapped, loop_status: { client_message_ids_by_run_id: { 'run-2': ['client-2'] } } });
  assert.equal(mismatched.accept(finished), null); // Matching request/client still needs matching run.
});

test('multiple backend runs and cumulative historical mappings require one correlated listener terminal in either order', () => {
  const continued = { ...mapped, loop_status: { client_message_ids_by_run_id: {
    'old-run': ['old-client'], 'run-1': ['client-1'], 'run-2': ['client-1'],
  } } };
  const terminal = { ...finished, run_id: 'run-2' };
  for (const terminalFirst of [false, true]) {
    const reducer = createTurnEvidence(scope, 'client-1', 'request-1');
    assert.equal(reducer.accept(accepted), null); assert.equal(reducer.accept(mapped), null);
    assert.equal(reducer.accept({ type: 'stream_delta', runtime: scope,
      delta: { message_type: 'stop_reason', run_id: 'run-1', stop_reason: 'requires_approval' } }), null);
    assert.equal(reducer.accept(terminalFirst ? terminal : continued), null);
    assert.equal(reducer.accept(terminalFirst ? continued : terminal).runId, 'run-2');
  }
  const unrelated = createTurnEvidence(scope, 'client-1', 'request-1');
  unrelated.accept(accepted); unrelated.accept(continued);
  assert.equal(unrelated.accept({ ...finished, run_id: 'old-run' }), null);
  assert.throws(() => unrelated.accept(terminal), error => error.code === 'INVALID_TERMINAL');
  const unmatched = createTurnEvidence(scope, 'client-1', 'request-1');
  unmatched.accept(accepted); unmatched.accept(continued);
  assert.equal(unmatched.accept({ ...finished, run_id: 'unmapped-run' }), null);
});

test('accumulated current-client run bounds, malformed maps and conflicting listener terminals fail closed', () => {
  const reducer = createTurnEvidence(scope, 'client-1', 'request-1');
  for (let index = 0; index < 64; index++) assert.equal(reducer.accept({ ...mapped,
    loop_status: { client_message_ids_by_run_id: { [`run-${index}`]: ['client-1'] } } }), null);
  assert.throws(() => reducer.accept({ ...mapped, loop_status: { client_message_ids_by_run_id: { overflow: ['client-1'] } } }), error => error.code === 'RUN_LIMIT');
  for (const map of [{ bad: ['client-1', 'client-1'] }, { bad: [null] },
    Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`run-${i}`, ['other-client']]))]) {
    assert.throws(() => createTurnEvidence(scope, 'client-1', 'request-1').accept({ ...mapped, loop_status: { client_message_ids_by_run_id: map } }));
  }
  const conflicting = createTurnEvidence(scope, 'client-1', 'request-1'); conflicting.accept(finished);
  assert.throws(() => conflicting.accept({ ...finished, run_id: 'run-2', turn_id: 'turn-2' }), error => error.code === 'INVALID_TERMINAL');
});

async function providerFixture(t) {
  const root = await fs.realpath(await fs.mkdtemp('/private/tmp/personal-co-wp0050-provider-'));
  const provider = await startSyntheticProvider(`${root}/state/negative-canary`);
  provider.expectContext('MEMORY_POLICY WP0050_SYNTHETIC_CANONICAL_CONTEXT');
  t.after(() => provider.close()); t.diagnostic(`Retained synthetic fixture: ${root}`); return provider;
}
const providerBody = { model: 'synthetic', stream: true, messages: [{ role: 'system', content: 'MEMORY_POLICY WP0050_SYNTHETIC_CANONICAL_CONTEXT' }, { role: 'user', content: 'WP0050_SYNTHETIC_USER' }] };
test('synthetic provider serves discovery and deterministic SSE without forwarding/auth/tools', async t => {
  const provider = await providerFixture(t); const origin = `http://127.0.0.1:${provider.port}`;
  assert.equal((await fetch(`${origin}/api/v0/models`)).status, 200);
  assert.equal((await fetch(`${origin}/v1/models`)).status, 200);
  provider.arm('normal'); const response = await fetch(`${origin}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(providerBody) });
  assert.equal(response.status, 200); assert.match(await response.text(), /WP0050_SYNTHETIC_REPLY/);
  provider.disarm(); assert.equal(provider.evidence().inference, 1);
});
for (const [name, configure, body, headers] of [
  ['startup inference', false, providerBody, {}],
  ['credentials', true, providerBody, { Authorization: 'Bearer public-synthetic-canary' }],
  ['tools', true, { ...providerBody, tools: [{ name: 'Write' }] }, {}],
  ['missing context', true, { ...providerBody, messages: [] }, {}],
  ['malformed body', true, '{', {}],
  ['oversized body', true, 'x'.repeat(262145), {}],
]) test(`provider rejects ${name} without leaking request`, async t => {
  const provider = await providerFixture(t); if (configure) provider.arm('normal');
  const response = await fetch(`http://127.0.0.1:${provider.port}/v1/chat/completions`, { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
  assert.equal(response.status, 400); assert.equal(await response.text(), ''); assert.throws(() => provider.evidence());
});

// Controlled native-shaped peer only: never spawns/imports upstream. Real ws,
// real local provider, bootstrap, canonical store and filesystem are composed.
function nativeFixture(t, mode = 'normal', controller) {
  let agent; let conversation; const rows = []; const commands = []; let boots = 0; let inputs = 0; let stops = 0; let messageSeq = 0; let acknowledgments = 0;
  const servers = [];
  function startProcess(spec) {
    boots++; const seen = new Set(); const correlations = {}; let seq = 0; let run = 0;
    const http = createServer(); const ws = new WebSocketServer({ server: http, path: '/ws', maxPayload: 1048576 });
    const listening = new Promise(resolve => http.listen(0, '127.0.0.1', resolve));
    servers.push({ http, ws });
    ws.on('connection', (socket, req) => {
      const token = req.headers.authorization?.slice(7);
      assert.equal(digest(token), spec.args.at(-1));
      const send = message => { if (socket.readyState === 1) socket.send(JSON.stringify(message)); };
      const event = message => send({ runtime: scope, seq: ++seq, ...message });
      socket.on('message', data => { void (async () => {
        const message = JSON.parse(data); if (message.type === 'ack') { acknowledgments++; return; }
        commands.push(message.type);
        const respond = fields => send({ type: `${message.type}_response`, request_id: message.request_id, success: true, ...fields });
        switch (message.type) {
          case 'app_server_info': return respond({ backend: 'local', protocol_version: 1, letta_code_version: '0.32.5' });
          case 'agent_list': return respond({ agents: agent ? [agent] : [] });
          case 'agent_create': agent = { id: scope.agent_id, ...message.body }; return respond({ agent });
          case 'agent_retrieve': return respond({ agent });
          case 'agent_update': agent = { ...agent, ...message.body }; return respond({ agent });
          case 'conversation_create': conversation = { id: scope.conversation_id, ...message.body }; return respond({ conversation });
          case 'conversation_retrieve': return respond({ conversation });
          case 'conversation_messages_list': return respond({ messages: rows, next_before: rows.at(-1)?.id ?? null, has_more: false });
          case 'runtime_start':
            assert.equal(message.mode, 'strict'); assert.deepEqual(message.skill_sources, []); assert.deepEqual(message.external_tools, []);
            assert.equal(message.recover_approvals, false); assert.equal(message.wait_for_replay, true);
            assert.deepEqual(message.execution_settings, { allowed_tools: [], disallowed_tools: [], tools: [], preload_skills: [], max_turns: 2, disable_memory_guard: false });
            event({ type: 'update_loop_status', loop_status: { client_message_ids_by_run_id: {} } });
            return respond({ runtime: scope, agent, conversation, created: { agent: false, conversation: false }, execution_settings: message.execution_settings });
          case 'set_reflection_settings': assert.equal(message.scope, 'local_project'); return respond({ scope: message.scope });
          case 'get_reflection_settings': return respond({ reflection_settings: { agent_id: agent.id, trigger: 'off', step_count: 25, merge: 'explicit' } });
          case 'input': {
            inputs++;
            assert.deepEqual(message.payload.client_tool_allowlist, []); assert.deepEqual(message.payload.client_toolset, { base: 'none', include: [] });
            const user = message.payload.messages[0]; const clientId = user.client_message_id;
            send({ type: 'input_accepted', request_id: message.request_id, runtime: scope, accepted: true, disposition: 'started' });
            if (seen.has(clientId)) return; seen.add(clientId); run++; const messageNumber = ++messageSeq;
            if (mode === 'socket-drop') return socket.terminate();
            if (mode === 'timeout') return;
            if (mode === 'cancel') return controller.abort();
            if (mode === 'malformed') return socket.send('{');
            if (mode === 'foreign') return event({ type: 'update_queue', runtime: { ...scope, agent_id: 'foreign' } });
            if (mode === 'approval') return event({ type: 'control_request', request_id: 'untrusted', request: { tool: 'Write' } });
            if (mode === 'oversize') return socket.send('x'.repeat(1048577));
            if (mode === 'provider-error') {
              event({ type: 'update_loop_status', loop_status: { client_message_ids_by_run_id: { [`local-run-${run}`]: [clientId] } } });
              return event({ type: 'turn_finished', run_id: `local-run-${run}`, turn_id: `turn-${run}`, stop_reason: 'error', error: 'SECRET_NATIVE_ERROR' });
            }
            const content = [...structuredClone(reminders), { type: 'text', text: user.content }];
            let stored = structuredClone(content);
            if (mode === 'altered-user') stored.at(-1).text += '-altered';
            if (mode === 'duplicate-input') stored.push({ type: 'text', text: user.content });
            if (mode === 'unexpected-prefix') stored.unshift({ type: 'text', text: 'unexpected' });
            if (mode === 'unexpected-suffix') stored.push({ type: 'text', text: 'unexpected' });
            if (mode === 'forged-reminder') stored[0].text = '<system-reminder>user-authored extra text</system-reminder>';
            if (mode === 'tagged-user') stored.at(-1).text = `<system-reminder>${user.content}</system-reminder>`;
            if (mode === 'duplicate-in-reminder') stored[0].text = stored[0].text.replace('</system-reminder>', `${user.content}</system-reminder>`);
            if (mode === 'reminder-suffix') stored[0].text += 'unexpected';
            if (mode === 'nontext-part') stored.unshift({ type: 'image', source: { data: 'synthetic' } });
            if (mode === 'plain-user') stored = user.content;
            if (!(boots === 2 && mode === 'restart-missing-user')) rows.push({ ...scope, id: `user-${messageNumber}`, message_type: 'user_message', role: 'user', content: stored,
              otid: mode === 'wrong-otid' ? 'foreign-client' : clientId,
              ...(mode === 'wrong-history-runtime' ? { conversation_id: 'foreign-conversation' } : {}) });
            if (mode === 'duplicate-user-row') rows.push({ ...rows.at(-1), id: `duplicate-user-${messageNumber}` });
            const reply = await fetch(`${spec.options.env.LMSTUDIO_BASE_URL}/chat/completions`, { method: 'POST', body: JSON.stringify({
              ...providerBody, messages: [{ role: 'system', content: agent.system }, { role: 'user', content }],
            }) });
            const output = await reply.text(); assert.equal(reply.status, 200);
            if (output.includes('tool_calls')) {
              correlations[`local-run-${run}`] = [clientId];
              event({ type: 'update_loop_status', loop_status: { client_message_ids_by_run_id: correlations } });
              event({ type: 'stream_delta', delta: { message_type: 'stop_reason', run_id: `local-run-${run}`, stop_reason: 'requires_approval' } });
              rows.push({ ...scope, id: `tool-${messageNumber}`, message_type: 'tool_return_message', tool_call_id: 'call-wp0050', status: 'error', tool_return: 'Tool not available' });
              if (mode === 'malicious-early-terminal') {
                event({ type: 'turn_finished', run_id: `local-run-${run}`, turn_id: `turn-${messageNumber}`, stop_reason: 'end_turn' }); return;
              }
              run++; correlations[`local-run-${run}`] = [clientId];
              event({ type: 'update_loop_status', loop_status: { client_message_ids_by_run_id: correlations } });
              const continuation = await fetch(`${spec.options.env.LMSTUDIO_BASE_URL}/chat/completions`, { method: 'POST', body: JSON.stringify({
                ...providerBody, messages: [{ role: 'system', content: agent.system }, { role: 'user', content },
                  { role: 'tool', tool_call_id: 'call-wp0050', content: 'Tool not available' }],
              }) });
              assert.equal(continuation.status, 200); assert.match(await continuation.text(), /WP0050_SYNTHETIC_REPLY/);
              if (mode !== 'malicious-missing-reply') rows.push({ ...scope, id: `assistant-${messageNumber}`, message_type: 'assistant_message',
                role: 'assistant', content: [{ type: 'text', text: 'WP0050_SYNTHETIC_REPLY' }] });
              if (mode === 'malicious-error-terminal') {
                event({ type: 'turn_finished', run_id: `local-run-${run}`, turn_id: `turn-${messageNumber}`, stop_reason: 'error', error: 'SECRET_NATIVE_ERROR' }); return;
              }
            }
            else if (!(boots === 2 && mode === 'restart-missing-reply')) rows.push({ ...scope, id: `assistant-${messageNumber}`, message_type: 'assistant_message', role: 'assistant', content: [{ type: 'text', text: 'WP0050_SYNTHETIC_REPLY' }] });
            event({ type: 'turn_finished', run_id: `local-run-${run}`, turn_id: `turn-${run}`, stop_reason: 'end_turn' });
            correlations[`local-run-${run}`] = [clientId];
            event({ type: 'update_loop_status', loop_status: { client_message_ids_by_run_id: correlations } });
            return;
          }
          default: assert.fail('Unexpected command');
        }
      })().catch(error => { socket.terminate(); t.diagnostic(`Controlled peer failure: ${error.code ?? 'assertion'}`); }); });
    });
    return { pid: 100000 + boots, failed: new Promise(() => {}), endpoint: async () => { await listening; return `ws://127.0.0.1:${http.address().port}/ws`; },
      stop: async () => { stops++; for (const socket of ws.clients) socket.terminate(); await new Promise(resolve => ws.close(resolve)); await new Promise(resolve => http.close(resolve));
        return { pid: 100000 + boots, reaped: mode !== 'cleanup-failure', groupGone: true }; } };
  }
  t.after(async () => { for (const { http, ws } of servers) { for (const socket of ws.clients) socket.terminate(); if (http.listening) await new Promise(resolve => http.close(resolve)); } });
  return { startProcess, stats: () => ({ boots, inputs, stops, commands, acknowledgments, messageIds: rows.map(row => row.id) }) };
}

for (const mode of ['normal', 'plain-user']) test(`full controlled journey ${mode} composes real bootstrap/provider/channel/store, restart and truthful duplicate finding`, async t => {
  const native = nativeFixture(t, mode);
  const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules' }, {
    makeSandbox: async () => base, startProcess: native.startProcess, requestMs: 1000, turnMs: 1000,
  });
  assert.equal(evidence.ok, true, JSON.stringify(evidence.failure)); assert.equal(evidence.sameRuntimeDedupe, true); assert.equal(evidence.crossRestartDedupe, false);
  assert.equal(evidence.crossRestartUserRows, 2); assert.equal(evidence.malicious.refused, true);
  assert.equal(evidence.normal.runId, 'local-run-1'); assert.equal(evidence.restarted.runId, evidence.normal.runId);
  assert.equal(new Set(native.stats().messageIds).size, native.stats().messageIds.length);
  assert.equal(evidence.provider.inference, 4); assert.equal(native.stats().boots, 2); assert.equal(native.stats().inputs, 4);
  assert.equal(native.stats().commands.filter(type => type === 'agent_create').length, 1);
  assert.equal(native.stats().commands.filter(type => type === 'conversation_create').length, 1);
  assert.ok(native.stats().acknowledgments > 0); assert.ok(evidence.cleanups.every(item => Object.values(item).every(Boolean)));
  assert.doesNotMatch(JSON.stringify(evidence), /Bearer|SYSTEM_PROMPT|WP0050_SYNTHETIC_CANONICAL_CONTEXT/);
  t.diagnostic(`Retained synthetic fixture: ${evidence.root}`);
});

for (const mode of ['altered-user', 'duplicate-input', 'unexpected-prefix', 'unexpected-suffix', 'forged-reminder',
  'tagged-user', 'duplicate-in-reminder', 'reminder-suffix', 'nontext-part', 'wrong-otid', 'wrong-history-runtime', 'duplicate-user-row']) {
  test(`durable native-shaped history rejects ${mode} without resending`, async t => {
    const native = nativeFixture(t, mode);
    const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules' }, {
      makeSandbox: async () => base, startProcess: native.startProcess, requestMs: 1000, turnMs: 1000,
    });
    assert.equal(evidence.ok, false);
    assert.deepEqual(evidence.failure, { stage: 'normal_turn', code: mode === 'wrong-history-runtime' ? 'FOREIGN_HISTORY' : 'DURABILITY' });
    assert.equal(native.stats().inputs, 1); assert.equal(native.stats().boots, 1); assert.equal(native.stats().stops, 1);
    assert.ok(evidence.cleanups.every(item => Object.values(item).every(Boolean)));
  });
}

for (const mode of ['restart-missing-user', 'restart-missing-reply']) test(`reused run ID does not waive exact restarted persistence: ${mode}`, async t => {
  const native = nativeFixture(t, mode);
  const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules' }, {
    makeSandbox: async () => base, startProcess: native.startProcess, requestMs: 1000, turnMs: 1000,
  });
  assert.equal(evidence.ok, false);
  assert.deepEqual(evidence.failure, { stage: 'cross_restart_measurement', code: 'RESTART_DEDUPE_CHANGED' });
  assert.equal(native.stats().inputs, 3); assert.equal(native.stats().boots, 2); assert.equal(native.stats().stops, 2);
  assert.ok(evidence.cleanups.every(item => Object.values(item).every(Boolean)));
});

for (const mode of ['malicious-missing-reply', 'malicious-error-terminal', 'malicious-early-terminal']) test(`two-run malicious input rejects ${mode}`, async t => {
  const native = nativeFixture(t, mode);
  const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules' }, {
    makeSandbox: async () => base, startProcess: native.startProcess, requestMs: 1000, turnMs: 1000,
  });
  assert.equal(evidence.ok, false);
  assert.deepEqual(evidence.failure, { stage: 'malicious_turn', code: mode === 'malicious-error-terminal' ? 'TURN_TERMINAL' : 'MALICIOUS_DURABILITY' });
  assert.equal(native.stats().inputs, 4); assert.equal(native.stats().boots, 2); assert.equal(native.stats().stops, 2);
  assert.ok(evidence.cleanups.every(item => Object.values(item).every(Boolean)));
});

for (const mode of ['socket-drop', 'timeout', 'cancel', 'malformed', 'foreign', 'approval', 'oversize', 'provider-error', 'cleanup-failure']) {
  test(`controlled ${mode} stops without automatic resend and reports sanitized cleanup`, async t => {
    const controller = new AbortController(); const native = nativeFixture(t, mode, controller);
    const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules', signal: controller.signal }, {
      makeSandbox: async () => base, startProcess: native.startProcess, requestMs: 1000, turnMs: 60,
    });
    assert.equal(evidence.ok, false); assert.equal(native.stats().boots, 1); assert.equal(native.stats().stops, 1);
    assert.equal(native.stats().inputs, mode === 'cleanup-failure' ? 2 : 1);
    assert.doesNotMatch(JSON.stringify(evidence), /SECRET_NATIVE_ERROR|Bearer|public-synthetic-canary/);
    if (mode === 'cleanup-failure') assert.equal(evidence.failure.code, 'CLEANUP_FAILED');
    t.diagnostic(`Retained synthetic fixture: ${evidence.root}`);
  });
}

test('aborted pending validation returns bounded uncertainty; diagnostic exceptions never control cleanup', async t => {
  const controller = new AbortController(); let release; let spawned = false;
  const result = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules', signal: controller.signal,
    observe() { throw new Error('OBSERVER_SECRET'); } }, {
    makeSandbox: () => new Promise(resolve => { release = resolve; setTimeout(() => controller.abort(), 5); }),
    startProcess() { spawned = true; assert.fail('No late spawn'); },
  });
  assert.equal(result.ok, false); assert.equal(result.failure.code, 'IO_UNCERTAIN'); assert.equal(spawned, false);
  release(base); await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(spawned, false);
  t.diagnostic(`Retained synthetic fixture: ${result.root}`);
});

for (const acquisition of ['preparation', 'store']) test(`late ${acquisition} handle is closed after bounded abort, never continued`, async t => {
  const controller = new AbortController(); const native = nativeFixture(t); let release; let closes = 0; let continued = false;
  const delayed = () => new Promise(resolve => { release = resolve; setTimeout(() => controller.abort(), 5); });
  const result = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/synthetic-dependency/node_modules', signal: controller.signal }, {
    makeSandbox: async () => base, startProcess: native.startProcess,
    ...(acquisition === 'preparation' ? { prepareBootstrap: delayed } : { openStore: delayed }),
  });
  assert.equal(result.ok, false); assert.equal(result.failure.code, 'IO_UNCERTAIN');
  release({ close: async () => { closes++; }, resolve() { continued = true; }, read() { continued = true; } });
  await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(closes, 1); assert.equal(continued, false);
  assert.equal(native.stats().inputs, 0); t.diagnostic(`Retained synthetic fixture: ${result.root}`);
});

export const reviewFiles = ['../server/probe-local-chat-turn.mjs', './local-chat-turn-probe.test.mjs', '../README.md',
  '../server/runtime-sandbox.mjs', '../server/runtime-process.mjs', '../server/assistant-bootstrap.mjs', '../server/canonical-memory-store.mjs',
  '../src/domain/app-server-memory-codec.mjs', '../src/domain/policy.mjs', '../src/domain/memory.mjs', '../server/package.json', '../server/package-lock.json'];
test('native governed synthetic turn (independent frozen security review required)', { skip: process.env.WP0050_RUN_NATIVE !== '1', timeout: 120000 }, async t => {
  const hash = createHash('sha256'); for (const file of reviewFiles) hash.update(await fs.readFile(new URL(file, import.meta.url)));
  assert.equal(process.env.WP0050_REVIEWED_SHA256, hash.digest('hex')); assert.equal(process.platform, 'darwin');
  const controller = new AbortController(); const abort = () => controller.abort();
  process.on('SIGINT', abort); process.on('SIGTERM', abort); t.signal.addEventListener('abort', abort, { once: true });
  try {
    const evidence = await probeLocalChatTurn({ dependencyRoot: '/private/tmp/personal-co-wp0048-runtime.o3519u/node_modules', signal: controller.signal });
    t.diagnostic(JSON.stringify(evidence)); assert.equal(evidence.ok, true, 'Native contract failed; retain fixture and stop, never relax controls.');
  } finally { controller.abort(); process.off('SIGINT', abort); process.off('SIGTERM', abort); t.signal.removeEventListener('abort', abort); }
});
