import test from 'node:test';
import assert from 'node:assert/strict';

import { messageEnvelope } from '../src/domain/privacy.mjs';
import { PersonalCoLettaClient } from '../src/services/letta.ts';

const SETTINGS = {
  baseUrl: 'http://synthetic.invalid',
  modelHandle: 'test/model',
  embeddingHandle: 'test/embed',
};
const AGENT_ID = 'agent-synthetic';
const CONTENT = '帮我想清楚下一步';
const OPTIONS = { requestNoMemoryWrites: true, language: '中文' };
const MESSAGE_URL = `${SETTINGS.baseUrl}/v1/agents/${AGENT_ID}/messages`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
  });
}

function transportAdapter(t, respond) {
  const requests = [];
  // Keep the real SDK and intercept every transport call before it reaches a network.
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init);
    const body = await request.text();
    requests.push({ url: request.url, method: request.method, body: body ? JSON.parse(body) : null });
    return respond();
  });
  return { adapter: new PersonalCoLettaClient(SETTINGS), requests };
}

function assertSingleMessage(requests) {
  assert.equal(requests.length, 1, 'one send must make one request without retry or fallback');
  assert.deepEqual(requests[0], {
    url: MESSAGE_URL,
    method: 'POST',
    body: {
      messages: messageEnvelope(CONTENT, true, OPTIONS.language),
      use_assistant_message: true,
      stream_tokens: false,
      streaming: false,
    },
  });
  assert.equal(requests[0].body.messages[0].role, 'system');
  assert.deepEqual(requests[0].body.messages.at(-1), { role: 'user', content: CONTENT });
}

const SENDERS = {
  direct: (adapter) => adapter.sendMessage(AGENT_ID, CONTENT, OPTIONS),
  workflow: (adapter) => adapter.runPersistentWorkflow('test message delivery', (client) =>
    client.sendMessage(AGENT_ID, CONTENT, OPTIONS)),
};

for (const [name, send] of Object.entries(SENDERS)) {
  for (const status of [500, 429]) {
    test(`${name} message sends exactly one POST after HTTP ${status}`, async (t) => {
      const { adapter, requests } = transportAdapter(t, () =>
        jsonResponse({ error: 'synthetic ambiguous failure' }, status));

      await assert.rejects(() => send(adapter), (error) => error.status === status);
      assertSingleMessage(requests);
    });
  }

  test(`${name} message sends exactly one POST after a thrown network error`, async (t) => {
    const failure = new TypeError('synthetic connection lost after send');
    const { adapter, requests } = transportAdapter(t, () => { throw failure; });

    await assert.rejects(() => send(adapter), (error) => error.cause === failure);
    assertSingleMessage(requests);
  });

  test(`${name} message preserves the envelope and normalizes a successful SDK response`, async (t) => {
    const { adapter, requests } = transportAdapter(t, () => jsonResponse({
      messages: [
        { id: 'user-1', message_type: 'user_message', content: CONTENT },
        { id: 'reasoning-1', message_type: 'reasoning_message', reasoning: 'internal' },
        { id: 'reply-1', message_type: 'assistant_message', content: '下一步' },
        { message_type: 'assistant_message', assistant_message: '先列出选择' },
        { id: 'empty', message_type: 'assistant_message', content: '' },
      ],
    }));

    assert.deepEqual(await send(adapter), [
      { id: 'reply-1', role: 'assistant', content: '下一步' },
      { id: 'answer-3', role: 'assistant', content: '先列出选择' },
    ]);
    assertSingleMessage(requests);
  });
}

test('non-message health requests retain the SDK retry default', async (t) => {
  const { adapter, requests } = transportAdapter(t, () =>
    jsonResponse({ error: 'synthetic health failure' }, 500));

  await assert.rejects(() => adapter.testConnection(), (error) => error.status === 500);
  assert.equal(requests.length, 3);
  assert.ok(requests.every((request) => request.method === 'GET' && request.body === null));
});
