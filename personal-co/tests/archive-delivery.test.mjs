import test from 'node:test';
import assert from 'node:assert/strict';

import { PersonalCoLettaClient } from '../src/services/letta.ts';

const SETTINGS = {
  baseUrl: 'http://synthetic.invalid',
  modelHandle: 'test/model',
  embeddingHandle: 'test/embed',
};
const AGENT_ID = 'agent-synthetic';
const TEXT = '已确认的学习观察';
const TAGS = ['source:test', 'type:observation'];
const CREATED_AT = '2026-09-12T10:20:30.000Z';
const ARCHIVE_URL = `${SETTINGS.baseUrl}/v1/agents/${AGENT_ID}/archival-memory`;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'retry-after-ms': '1' },
  });
}

function transportAdapter(t, respond) {
  const requests = [];
  // Exercise the installed SDK while intercepting every request before the network.
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const request = new Request(input, init);
    const body = await request.text();
    requests.push({ url: request.url, method: request.method, body: body ? JSON.parse(body) : null });
    return respond();
  });
  return { adapter: new PersonalCoLettaClient(SETTINGS), requests };
}

function expectedAppend(createdAt = CREATED_AT) {
  return {
    url: ARCHIVE_URL,
    method: 'POST',
    body: { text: TEXT, tags: TAGS, ...(createdAt ? { created_at: createdAt } : {}) },
  };
}

const APPENDERS = {
  direct: (adapter, ...timestamp) => adapter.archiveText(AGENT_ID, TEXT, TAGS, ...timestamp),
  workflow: (adapter, ...timestamp) => adapter.runPersistentWorkflow('test archive delivery', (client) =>
    client.archiveText(AGENT_ID, TEXT, TAGS, ...timestamp)),
};

for (const [name, append] of Object.entries(APPENDERS)) {
  const connectionFailure = new TypeError('synthetic connection lost after append');
  const failures = [
    ...[500, 429].map((status) => ({
      label: `HTTP ${status}`,
      respond: () => jsonResponse({ error: 'synthetic ambiguous failure' }, status),
      matches: (error) => error.status === status,
    })),
    {
      label: 'a thrown network error',
      respond: () => { throw connectionFailure; },
      matches: (error) => error.cause === connectionFailure,
    },
  ];

  for (const failure of failures) {
    test(`${name} archive makes one POST after ${failure.label} and releases its lease`, async (t) => {
      let failing = true;
      const { adapter, requests } = transportAdapter(t, () => failing
        ? failure.respond()
        : jsonResponse([{ id: 'passage-next', text: TEXT, tags: TAGS }]));

      await assert.rejects(() => append(adapter, CREATED_AT), failure.matches);
      assert.deepEqual(requests, [expectedAppend()], 'no hidden retry, fallback, or read-back');
      assert.equal(adapter.activeMutations, 0, 'the rejected operation must release its mutation lease');

      failing = false;
      assert.equal(await append(adapter, CREATED_AT), undefined);
      assert.deepEqual(requests, [expectedAppend(), expectedAppend()], 'an explicit next append remains allowed');
      assert.equal(adapter.activeMutations, 0);
    });
  }

  test(`${name} archive preserves the exact payload and resolves void on success`, async (t) => {
    const { adapter, requests } = transportAdapter(t, () =>
      jsonResponse([{ id: 'passage-1', text: TEXT, tags: TAGS, created_at: CREATED_AT }]));

    const result = append(adapter, CREATED_AT);
    assert.ok(result instanceof Promise);
    assert.equal(await result, undefined);
    assert.deepEqual(requests, [expectedAppend()]);
  });

  test(`${name} archive omits created_at for absent, null, and empty timestamps`, async (t) => {
    const { adapter, requests } = transportAdapter(t, () => jsonResponse([]));

    for (const timestamp of [[], [undefined], [null], ['']]) {
      assert.equal(await append(adapter, ...timestamp), undefined);
    }
    assert.deepEqual(requests, Array.from({ length: 4 }, () => expectedAppend(null)));
  });

  test(`${name} explicit identical archive calls remain separate operations`, async (t) => {
    const { adapter, requests } = transportAdapter(t, () => jsonResponse([]));

    await append(adapter, CREATED_AT);
    await append(adapter, CREATED_AT);
    assert.deepEqual(requests, [expectedAppend(), expectedAppend()]);
  });
}

test('health reads retain the SDK retry default after an archive append', async (t) => {
  let readingHealth = false;
  const { adapter, requests } = transportAdapter(t, () => readingHealth
    ? jsonResponse({ error: 'synthetic health failure' }, 500)
    : jsonResponse([]));

  await APPENDERS.direct(adapter, CREATED_AT);
  readingHealth = true;
  await assert.rejects(() => adapter.testConnection(), (error) => error.status === 500);
  assert.deepEqual(requests, [expectedAppend(), ...Array.from({ length: 3 }, () => ({
    url: `${SETTINGS.baseUrl}/v1/health/`,
    method: 'GET',
    body: null,
  }))]);
});
