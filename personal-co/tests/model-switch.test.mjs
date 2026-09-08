import test from 'node:test';
import assert from 'node:assert/strict';

import { createMemoryBlocks } from '../src/domain/memory.mjs';
import {
  assertUnchangedAgentMemory,
  canonicalAgentMemory,
  prepareModelSwitch,
} from '../src/domain/model-switch.mjs';
import {
  ModelSwitchError,
  PERSONAL_CO_AGENT_TAG,
  PersonalCoLettaClient,
} from '../src/services/letta.ts';

const CURRENT_MODEL = 'deepseek/deepseek-v4-pro';
const TARGET_MODEL = 'openai/gpt-5.6-terra';
const EMBEDDING = 'ollama/nomic-embed-text';
const SETTINGS = {
  baseUrl: 'http://localhost:8283',
  modelHandle: CURRENT_MODEL,
  embeddingHandle: EMBEDDING,
};

function serverBlocks() {
  return createMemoryBlocks('persona', 'policy').map((block, index) => ({
    id: `block-${index}`,
    label: block.label,
    value: `${block.label} value`,
    limit: block.limit,
    read_only: block.readOnly,
    metadata: { source: 'test', token: 'filtered-from-comparison' },
  }));
}

function archivePassages() {
  return [{
    id: 'passage-1',
    text: 'durable observation',
    tags: ['source:test', 'type:observation'],
    created_at: '2026-09-07T00:00:00.000Z',
    updated_at: '2026-09-07T01:00:00.000Z',
  }];
}

function fakeLetta(options = {}) {
  const calls = [];
  const updates = [];
  const state = {
    agent: options.agent === null ? null : {
      id: 'agent-1',
      name: 'Personal Co',
      tags: [PERSONAL_CO_AGENT_TAG],
      model: CURRENT_MODEL,
      embedding: EMBEDDING,
      enable_sleeptime: false,
      blocks: serverBlocks(),
      ...(options.agent ?? {}),
    },
    archive: archivePassages(),
  };
  let retrieveCount = 0;
  let updateCount = 0;
  let blocksListCount = 0;
  let passagesListCount = 0;

  const client = {
    health: async () => ({ status: 'ok' }),
    models: {
      list: async () => {
        calls.push('models.list');
        return options.models ?? [{ handle: CURRENT_MODEL }, { handle: TARGET_MODEL }];
      },
      embeddings: {
        list: async () => {
          calls.push('models.embeddings.list');
          return options.embeddings ?? [{ handle: EMBEDDING }];
        },
      },
    },
    blocks: {
      update: async (blockId, body) => {
        calls.push('blocks.update');
        const block = state.agent.blocks.find((item) => item.id === blockId);
        Object.assign(block, body);
        return block;
      },
    },
    agents: {
      list: async () => {
        calls.push('agents.list');
        return { items: state.agent ? [state.agent] : [] };
      },
      create: async (body) => {
        calls.push('agents.create');
        if (options.onCreate) return options.onCreate(body, state);
        state.agent = {
          id: 'agent-created',
          name: body.name,
          tags: body.tags,
          model: body.model,
          embedding: body.embedding,
          enable_sleeptime: body.enable_sleeptime,
          blocks: serverBlocks(),
        };
        return state.agent;
      },
      delete: async () => {
        calls.push('agents.delete');
        throw new Error('Agent deletion must never occur.');
      },
      retrieve: async (agentId, query) => {
        calls.push('agents.retrieve');
        retrieveCount += 1;
        assert.equal(agentId, 'agent-1');
        assert.deepEqual(query, { include: ['agent.blocks', 'agent.tags'] });
        const observed = { ...state.agent, blocks: state.agent.blocks.map((block) => ({ ...block })) };
        return options.onRetrieve
          ? options.onRetrieve(observed, retrieveCount, state)
          : observed;
      },
      update: async (agentId, body) => {
        calls.push('agents.update');
        updateCount += 1;
        updates.push({ agentId, body: { ...body } });
        if (options.onUpdate) return options.onUpdate(agentId, body, updateCount, state);
        state.agent = { ...state.agent, ...body };
        return state.agent;
      },
      blocks: {
        list: async (agentId) => {
          calls.push('agents.blocks.list');
          blocksListCount += 1;
          assert.equal(agentId, 'agent-1');
          const observed = state.agent.blocks.map((block) => ({ ...block }));
          return {
            items: options.onBlocksList
              ? options.onBlocksList(observed, blocksListCount, state)
              : observed,
          };
        },
      },
      passages: {
        list: async (agentId, query) => {
          calls.push('agents.passages.list');
          passagesListCount += 1;
          assert.equal(agentId, 'agent-1');
          const observed = state.archive.map((item) => ({ ...item, tags: [...item.tags] }));
          return options.onPassagesList
            ? options.onPassagesList(observed, query, passagesListCount, state)
            : observed;
        },
        create: async (agentId, body) => {
          calls.push('agents.passages.create');
          state.archive.push({ id: `passage-${state.archive.length + 1}`, ...body });
        },
        delete: async (passageId) => {
          calls.push('agents.passages.delete');
          state.archive = state.archive.filter((item) => item.id !== passageId);
        },
      },
      messages: {
        list: async () => ({ items: [] }),
        create: options.createMessage ?? (async () => ({ messages: [] })),
      },
    },
  };

  return { client, calls, updates, state };
}

async function connectedAdapter(options = {}) {
  const fake = fakeLetta(options);
  const adapter = new PersonalCoLettaClient(SETTINGS);
  adapter.client = fake.client;
  await adapter.ensureAgent(SETTINGS);
  fake.calls.length = 0;
  return { adapter, ...fake };
}

const SWITCH = {
  agentId: 'agent-1',
  currentModelHandle: CURRENT_MODEL,
  targetModelHandle: TARGET_MODEL,
  embeddingHandle: EMBEDDING,
};

test('model-switch preconditions reject disconnected, wrong-ID, blank, no-op, stale, and embedding-mismatch requests', async () => {
  assert.throws(
    () => prepareModelSwitch({ ...SWITCH, connectedAgent: null }),
    /connected exact Agent context/,
  );
  const connectedAgent = {
    id: 'agent-1',
    model: CURRENT_MODEL,
    embedding: EMBEDDING,
  };
  for (const [override, pattern] of [
    [{ agentId: 'agent-2' }, /Agent ID does not match/],
    [{ targetModelHandle: '  ' }, /target generation model handle is required/i],
    [{ targetModelHandle: CURRENT_MODEL }, /must differ/],
    [{ currentModelHandle: 'stale/model' }, /no longer matches/],
    [{ embeddingHandle: 'other/embedding' }, /embedding migration is not supported/],
  ]) {
    assert.throws(
      () => prepareModelSwitch({ ...SWITCH, ...override, connectedAgent }),
      pattern,
    );
  }

  const adapter = new PersonalCoLettaClient(SETTINGS);
  await assert.rejects(() => adapter.switchGenerationModel(SWITCH), /connected exact Agent context/);

  for (const [override, pattern] of [
    [{ agentId: 'agent-2' }, /Agent ID does not match/],
    [{ targetModelHandle: '  ' }, /target generation model handle is required/i],
    [{ targetModelHandle: CURRENT_MODEL }, /must differ/],
    [{ currentModelHandle: 'stale/model' }, /no longer matches/],
    [{ embeddingHandle: 'other/embedding' }, /embedding migration is not supported/],
  ]) {
    const connected = await connectedAdapter();
    await assert.rejects(
      () => connected.adapter.switchGenerationModel({ ...SWITCH, ...override }),
      pattern,
    );
    assert.deepEqual(connected.calls, []);
  }
});

test('canonical memory ignores ordering, tag ordering, volatile timestamps, and secret-like metadata only', () => {
  const before = {
    blocks: serverBlocks(),
    archive: archivePassages().map((item) => ({
      id: item.id,
      text: item.text,
      tags: item.tags,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  };
  const after = {
    blocks: [...before.blocks].reverse().map((block) => ({
      ...block,
      metadata: { token: 'changed-secret', source: 'test' },
    })),
    archive: before.archive.map((item) => ({
      ...item,
      tags: [...item.tags].reverse(),
      updatedAt: 'later',
    })),
  };
  assert.deepEqual(canonicalAgentMemory(before), canonicalAgentMemory(after));
  assert.doesNotThrow(() => assertUnchangedAgentMemory(before, after));
  assert.throws(
    () => assertUnchangedAgentMemory(before, {
      ...after,
      archive: after.archive.map((item) => ({ ...item, text: 'changed' })),
    }),
    /Blocks or Archive change/,
  );
  assert.throws(
    () => assertUnchangedAgentMemory(before, {
      ...after,
      blocks: after.blocks.map((block, index) => index === 0
        ? { ...block, limit: block.limit + 1 }
        : block),
    }),
    /Blocks or Archive change/,
  );
});

test('initial connection still creates one exact Agent when no tagged Agent exists', async () => {
  const fake = fakeLetta({ agent: null });
  const adapter = new PersonalCoLettaClient(SETTINGS);
  adapter.client = fake.client;
  const created = await adapter.ensureAgent(SETTINGS);

  assert.equal(created.id, 'agent-created');
  assert.deepEqual(fake.calls.filter((call) => call.startsWith('agents.')), [
    'agents.list',
    'agents.create',
  ]);
});

test('reconnect mismatch fails closed before Agent update, create, or delete', async () => {
  const fake = fakeLetta({
    embeddings: [{ handle: EMBEDDING }, { handle: 'other/embedding' }],
  });
  const adapter = new PersonalCoLettaClient(SETTINGS);
  adapter.client = fake.client;

  await assert.rejects(
    () => adapter.ensureAgent({ ...SETTINGS, modelHandle: TARGET_MODEL }),
    /explicit model-switch action/,
  );
  assert.deepEqual(
    fake.calls.filter((call) => ['agents.update', 'agents.create', 'agents.delete'].includes(call)),
    [],
  );

  fake.calls.length = 0;
  await assert.rejects(
    () => adapter.ensureAgent({ ...SETTINGS, embeddingHandle: 'other/embedding' }),
    /embedding migration is not supported/,
  );
  assert.deepEqual(
    fake.calls.filter((call) => ['agents.update', 'agents.create', 'agents.delete'].includes(call)),
    [],
  );
});

test('successful switch updates only the model on the same Agent and proves memory invariants', async () => {
  const { adapter, calls, updates, state } = await connectedAdapter();
  const result = await adapter.switchGenerationModel(SWITCH);

  assert.equal(result.outcome, 'switched');
  assert.equal(result.agent.id, 'agent-1');
  assert.equal(result.agent.model, TARGET_MODEL);
  assert.equal(result.agent.embedding, EMBEDDING);
  assert.deepEqual(updates, [{
    agentId: 'agent-1',
    body: { model: TARGET_MODEL, enable_sleeptime: false },
  }]);
  assert.equal('embedding' in updates[0].body, false);
  assert.equal(calls.includes('agents.create'), false);
  assert.equal(calls.includes('agents.delete'), false);
  assert.equal(state.agent.id, 'agent-1');
  assert.ok(calls.indexOf('models.list') < calls.indexOf('agents.retrieve'));
  assert.equal(calls.filter((call) => call === 'agents.retrieve').length, 2);
  assert.equal(calls.filter((call) => call === 'agents.blocks.list').length, 2);
  assert.equal(calls.filter((call) => call === 'agents.passages.list').length, 2);
});

test('repeated full-page Archive cursor aborts before the forward model update', async () => {
  const fullPage = Array.from({ length: 100 }, (_, index) => ({
    id: `repeated-${index + 1}`,
    text: `passage ${index + 1}`,
    tags: ['source:test', 'type:observation'],
    created_at: '2026-09-07T00:00:00.000Z',
  }));
  const { adapter, calls, updates } = await connectedAdapter({
    onPassagesList: () => fullPage.map((item) => ({ ...item, tags: [...item.tags] })),
  });

  await assert.rejects(
    () => adapter.switchGenerationModel(SWITCH),
    /complete Blocks and Archive snapshot could not be captured/,
  );
  assert.equal(calls.filter((call) => call === 'agents.passages.list').length, 2);
  assert.equal(calls.includes('agents.update'), false);
  assert.deepEqual(updates, []);
});

test('Block limit drift after the forward update triggers verified rollback', async () => {
  const { adapter, updates } = await connectedAdapter({
    onBlocksList: (observed, count) => count === 2
      ? observed.map((block, index) => index === 0
        ? { ...block, limit: block.limit + 1 }
        : block)
      : observed,
  });

  await assert.rejects(
    () => adapter.switchGenerationModel(SWITCH),
    (error) => error instanceof ModelSwitchError && error.outcome === 'rolled_back',
  );
  assert.deepEqual(updates, [
    { agentId: 'agent-1', body: { model: TARGET_MODEL, enable_sleeptime: false } },
    { agentId: 'agent-1', body: { model: CURRENT_MODEL, enable_sleeptime: false } },
  ]);
});

test('switch closes the barrier synchronously, drains an active write, and rejects new writes', async () => {
  let releaseMessage;
  const activeMessage = new Promise((resolve) => { releaseMessage = resolve; });
  const { adapter, updates } = await connectedAdapter({
    createMessage: async () => {
      await activeMessage;
      return { messages: [] };
    },
  });

  const sending = adapter.sendMessage('agent-1', 'hello');
  const switching = adapter.switchGenerationModel(SWITCH);
  const writableBlock = serverBlocks().find((block) => block.read_only === false);
  const snapshot = {
    blocks: serverBlocks(),
    archive: [{
      id: 'passage-1',
      text: 'durable observation',
      tags: ['source:test'],
      category: 'observation',
      source: 'test',
      epistemicState: 'observed',
      date: '2026-09-07',
      provenance: 'original',
    }],
  };
  for (const mutation of [
    () => adapter.sendMessage('agent-1', 'second message'),
    () => adapter.updateBlock(writableBlock, 'blocked'),
    () => adapter.archiveText('agent-1', 'blocked', []),
    () => adapter.deleteArchiveItem('agent-1', 'passage-1'),
    () => adapter.reconcileTemporaryMemory('agent-1', snapshot),
    () => adapter.ensureAgent(SETTINGS),
  ]) {
    await assert.rejects(mutation, /model switch is in progress/);
  }
  assert.equal(updates.length, 0);

  releaseMessage();
  await sending;
  await switching;
  assert.equal(updates.length, 1);
});

test('workflow lease spans message through reconciliation, rejects new workflows, and cannot leak', async () => {
  let markGapReached;
  let releaseGap;
  const gapReached = new Promise((resolve) => { markGapReached = resolve; });
  const gap = new Promise((resolve) => { releaseGap = resolve; });
  const { adapter, updates } = await connectedAdapter();
  let leakedWorkflow;

  const messageWorkflow = adapter.runPersistentWorkflow(
    'private message workflow',
    async (workflow) => {
      leakedWorkflow = workflow;
      const before = await workflow.captureAgentMemory('agent-1');
      await workflow.sendMessage('agent-1', 'private message', { requestNoMemoryWrites: true });
      markGapReached();
      await gap;
      return workflow.reconcileTemporaryMemory('agent-1', before);
    },
  );
  await gapReached;

  const switching = adapter.switchGenerationModel(SWITCH);
  await assert.rejects(
    Promise.resolve().then(() => adapter.runPersistentWorkflow('late workflow', async () => undefined)),
    /model switch is in progress/,
  );
  assert.equal(updates.length, 0);

  releaseGap();
  const reconciliation = await messageWorkflow;
  assert.equal(reconciliation.success, true);
  await switching;
  assert.equal(updates.length, 1);
  await assert.rejects(
    async () => leakedWorkflow.archiveText('agent-1', 'leaked write', []),
    /no longer active/,
  );
});

test('workflow lease lets only its own multi-write sequence finish after the switch latch', async () => {
  let markFirstWriteComplete;
  let releaseSecondWrite;
  const firstWriteComplete = new Promise((resolve) => { markFirstWriteComplete = resolve; });
  const secondWriteGate = new Promise((resolve) => { releaseSecondWrite = resolve; });
  const { adapter, updates, state } = await connectedAdapter();

  const importing = adapter.runPersistentWorkflow('representative import workflow', async (workflow) => {
    await workflow.captureAgentMemory('agent-1');
    await workflow.archiveText('agent-1', 'first import', ['source:test']);
    markFirstWriteComplete();
    await secondWriteGate;
    await workflow.archiveText('agent-1', 'second import', ['source:test']);
    return workflow.listArchive('agent-1');
  });
  await firstWriteComplete;

  const switching = adapter.switchGenerationModel(SWITCH);
  await assert.rejects(
    () => adapter.archiveText('agent-1', 'unrelated write', []),
    /model switch is in progress/,
  );
  assert.equal(updates.length, 0);

  releaseSecondWrite();
  const observed = await importing;
  assert.equal(observed.some((item) => item.text === 'first import'), true);
  assert.equal(observed.some((item) => item.text === 'second import'), true);
  assert.equal(state.archive.some((item) => item.text === 'unrelated write'), false);
  await switching;
  assert.equal(updates.length, 1);
});

test('post-update invariant failure performs and verifies same-ID rollback', async () => {
  const { adapter, updates } = await connectedAdapter({
    onRetrieve: (observed) => observed.model === TARGET_MODEL
      ? { ...observed, embedding: 'unexpected/embedding' }
      : observed,
  });

  await assert.rejects(
    () => adapter.switchGenerationModel(SWITCH),
    (error) => {
      assert.equal(error instanceof ModelSwitchError, true);
      assert.equal(error.outcome, 'rolled_back');
      assert.equal(error.writesLocked, false);
      assert.equal(error.agent.model, CURRENT_MODEL);
      return true;
    },
  );
  assert.deepEqual(updates, [
    { agentId: 'agent-1', body: { model: TARGET_MODEL, enable_sleeptime: false } },
    { agentId: 'agent-1', body: { model: CURRENT_MODEL, enable_sleeptime: false } },
  ]);
  await assert.doesNotReject(() => adapter.archiveText('agent-1', 'after rollback', []));
});

test('ambiguous forward rejection still performs a verified compensating update', async () => {
  const { adapter, updates } = await connectedAdapter({
    onUpdate: async (_agentId, body, count, state) => {
      state.agent = { ...state.agent, ...body };
      if (count === 1) throw new Error('ambiguous transport rejection');
      return state.agent;
    },
  });

  await assert.rejects(
    () => adapter.switchGenerationModel(SWITCH),
    (error) => error instanceof ModelSwitchError && error.outcome === 'rolled_back',
  );
  assert.equal(updates.length, 2);
  assert.equal(updates[1].body.model, CURRENT_MODEL);
});

test('rollback failure retains the write barrier with an explicit diagnostic', async () => {
  const { adapter, updates } = await connectedAdapter({
    onUpdate: async (_agentId, body, count, state) => {
      if (count === 1) {
        state.agent = { ...state.agent, ...body };
        return state.agent;
      }
      throw new Error('rollback unavailable');
    },
    onRetrieve: (observed) => observed.model === TARGET_MODEL
      ? { ...observed, embedding: 'unexpected/embedding' }
      : observed,
  });

  await assert.rejects(
    () => adapter.switchGenerationModel(SWITCH),
    (error) => {
      assert.equal(error instanceof ModelSwitchError, true);
      assert.equal(error.outcome, 'rollback_locked');
      assert.equal(error.writesLocked, true);
      assert.match(error.message, /writes remain locked/i);
      return true;
    },
  );
  assert.equal(updates.length, 2);
  await assert.rejects(
    () => adapter.sendMessage('agent-1', 'must stay blocked'),
    /rollback could not be verified/,
  );
});
