import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertRegisteredModelHandles,
  planAgentConfigurationUpdate,
  selectTaggedAgent,
  validateExistingAgentBlocks,
} from '../src/domain/agent.mjs';
import { createMemoryBlocks } from '../src/domain/memory.mjs';
import { PersonalCoLettaClient } from '../src/services/letta.ts';

const TAG = 'personal-co-v1';

function serverBlocks() {
  return createMemoryBlocks('persona', 'policy').map(({ label, readOnly }) => ({
    label,
    read_only: readOnly,
  }));
}

const MODELS = [
  {
    handle: 'deepseek/deepseek-v4-pro',
    name: 'deepseek-v4-pro',
    display_name: 'DeepSeek V4 Pro',
    provider_name: 'deepseek',
  },
];
const EMBEDDINGS = [
  {
    handle: 'ollama/nomic-embed-text',
    name: 'nomic-embed-text',
    display_name: 'Nomic Embed Text',
    embedding_model: 'nomic-embed-text',
  },
];

const SETTINGS = {
  baseUrl: 'http://localhost:8283',
  modelHandle: MODELS[0].handle,
  embeddingHandle: EMBEDDINGS[0].handle,
};

function adapterWithClient(client) {
  const adapter = new PersonalCoLettaClient(SETTINGS);
  adapter.client = client;
  return adapter;
}

test('model preflight accepts only exact registered generation and embedding handles', () => {
  assert.deepEqual(
    assertRegisteredModelHandles(
      '  deepseek/deepseek-v4-pro  ',
      '  ollama/nomic-embed-text  ',
      MODELS,
      EMBEDDINGS,
    ),
    {
      modelHandle: 'deepseek/deepseek-v4-pro',
      embeddingHandle: 'ollama/nomic-embed-text',
    },
  );
});

test('model preflight rejects generation mismatches without display, partial, case, or fallback matches', () => {
  for (const configured of [
    'DeepSeek V4 Pro',
    'deepseek-v4-pro',
    'deepseek/deepseek-v4',
    'DeepSeek/deepseek-v4-pro',
    'openai/gpt-5.6-terra',
  ]) {
    assert.throws(
      () => assertRegisteredModelHandles(configured, EMBEDDINGS[0].handle, MODELS, EMBEDDINGS),
      new RegExp(`Configured generation model handle .*${configured.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.* is not registered by Letta`),
    );
  }
});

test('model preflight rejects embedding display or model-name matches and missing handles', () => {
  for (const configured of ['Nomic Embed Text', 'nomic-embed-text']) {
    assert.throws(
      () => assertRegisteredModelHandles(MODELS[0].handle, configured, MODELS, EMBEDDINGS),
      /Configured embedding model handle .* is not registered by Letta/,
    );
  }

  for (const inventory of [[], [{}], [{ handle: '' }], [{ handle: '   ' }]]) {
    assert.throws(
      () => assertRegisteredModelHandles(MODELS[0].handle, EMBEDDINGS[0].handle, MODELS, inventory),
      /Configured embedding model handle .*ollama\/nomic-embed-text.* is not registered by Letta/,
    );
  }
});

test('model preflight rejects missing generation handles and blank configured handles', () => {
  assert.throws(
    () => assertRegisteredModelHandles(MODELS[0].handle, EMBEDDINGS[0].handle, [{}], EMBEDDINGS),
    /Configured generation model handle .*deepseek\/deepseek-v4-pro.* is not registered by Letta/,
  );
  assert.throws(
    () => assertRegisteredModelHandles('   ', EMBEDDINGS[0].handle, MODELS, EMBEDDINGS),
    /Configured generation model handle is required/,
  );
});

test('adapter health check and exact-handle preflight precede Agent lookup and reuse', async () => {
  const calls = [];
  const existing = {
    id: 'agent-1',
    name: 'Personal Co',
    tags: [TAG],
    model: MODELS[0].handle,
    embedding: EMBEDDINGS[0].handle,
    enable_sleeptime: false,
    blocks: serverBlocks(),
  };
  const adapter = adapterWithClient({
    health: async () => {
      calls.push('health');
      return { status: 'ok' };
    },
    models: {
      list: async () => {
        calls.push('models.list');
        return MODELS;
      },
      embeddings: {
        list: async () => {
          calls.push('models.embeddings.list');
          return EMBEDDINGS;
        },
      },
    },
    agents: {
      list: async () => {
        calls.push('agents.list');
        return { items: [existing] };
      },
      update: async () => {
        calls.push('agents.update');
        throw new Error('Existing conforming Agent must not be updated.');
      },
      create: async () => {
        calls.push('agents.create');
        throw new Error('Existing conforming Agent must not be replaced.');
      },
    },
  });

  await adapter.testConnection();
  const selected = await adapter.ensureAgent(SETTINGS);

  assert.equal(selected, existing);
  assert.deepEqual(calls, [
    'health',
    'models.list',
    'models.embeddings.list',
    'agents.list',
  ]);
});

test('adapter sanitizes inventory failures and performs no Agent operation', async () => {
  const calls = [];
  const upstreamSecret = 'Bearer sk-upstream-secret';
  const adapter = adapterWithClient({
    health: async () => {
      calls.push('health');
      return { status: 'ok' };
    },
    models: {
      list: async () => {
        calls.push('models.list');
        throw new Error(upstreamSecret);
      },
      embeddings: {
        list: async () => {
          calls.push('models.embeddings.list');
          return EMBEDDINGS;
        },
      },
    },
    agents: {
      list: async () => calls.push('agents.list'),
      update: async () => calls.push('agents.update'),
      create: async () => calls.push('agents.create'),
    },
  });

  await adapter.testConnection();
  await assert.rejects(
    () => adapter.ensureAgent(SETTINGS),
    (error) => {
      assert.match(error.message, /generation model/);
      assert.match(error.message, /deepseek\/deepseek-v4-pro/);
      assert.doesNotMatch(error.message, new RegExp(upstreamSecret));
      return true;
    },
  );

  assert.deepEqual(calls, [
    'health',
    'models.list',
    'models.embeddings.list',
  ]);
  assert.deepEqual(calls.filter((call) => call.startsWith('agents.')), []);
});

test('tagged-agent selection handles zero and one exact match', () => {
  assert.equal(selectTaggedAgent([], TAG), null);

  const match = { id: 'agent-1', tags: [TAG, 'another-tag'] };
  assert.equal(
    selectTaggedAgent([match, { id: 'other', tags: ['another-tag'] }], TAG),
    match,
  );
});

test('tagged-agent selection rejects duplicate exact matches', () => {
  assert.throws(
    () => selectTaggedAgent([
      { id: 'agent-1', tags: [TAG] },
      { id: 'agent-2', tags: [TAG] },
    ], TAG),
    /Found 2 agents tagged personal-co-v1/,
  );
});

test('existing blocks must have the exact labels and permissions', () => {
  assert.deepEqual(validateExistingAgentBlocks(serverBlocks()), {
    valid: true,
    exactLabels: true,
    policyReadOnly: true,
    userWritable: true,
  });

  const missingBlock = serverBlocks().slice(0, -1);
  assert.equal(validateExistingAgentBlocks(missingBlock).valid, false);

  const extraBlock = [...serverBlocks(), { label: 'DYNAMIC', read_only: false }];
  assert.equal(validateExistingAgentBlocks(extraBlock).valid, false);

  const writablePolicy = serverBlocks().map((block) =>
    block.label === 'PERSONA' ? { ...block, read_only: false } : block,
  );
  assert.equal(validateExistingAgentBlocks(writablePolicy).policyReadOnly, false);

  const readOnlyUserBlock = serverBlocks().map((block) =>
    block.label === 'PROFILE' ? { ...block, read_only: true } : block,
  );
  assert.equal(validateExistingAgentBlocks(readOnlyUserBlock).userWritable, false);
});

test('configuration updates preserve the selected agent ID and disable sleeptime', () => {
  const update = planAgentConfigurationUpdate(
    {
      id: 'agent-1',
      model: 'old-model',
      embedding: 'old-embedding',
      enable_sleeptime: true,
    },
    'new-model',
    'new-embedding',
  );

  assert.deepEqual(update, {
    agentId: 'agent-1',
  });

  assert.equal(
    planAgentConfigurationUpdate(
      {
        id: 'agent-1',
        model: 'new-model',
        embedding: 'new-embedding',
        enable_sleeptime: false,
      },
      'new-model',
      'new-embedding',
    ),
    null,
  );
});
