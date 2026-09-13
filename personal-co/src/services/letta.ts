import Letta from '@letta-ai/letta-client';

import type { ConnectionSettings } from '../config';
import {
  assertRegisteredModelHandles,
  assertValidExistingAgentBlocks,
  selectTaggedAgent,
} from '../domain/agent.mjs';
import { parseArchiveTags } from '../domain/imports.mjs';
import { createMemoryBlocks, POLICY_MEMORY_LABELS } from '../domain/memory.mjs';
import {
  assertModelSwitchAgentState,
  assertUnchangedAgentMemory,
  prepareModelSwitch,
} from '../domain/model-switch.mjs';
import { messageEnvelope, planTemporaryReconciliation } from '../domain/privacy.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT, SYSTEM_PROMPT } from '../domain/policy.mjs';

export const PERSONAL_CO_AGENT_TAG = 'personal-co-v1';

export type AgentBlock = {
  id?: string;
  label: string;
  value: string;
  limit?: number | null;
  readOnly?: boolean;
  read_only?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type AgentSummary = {
  id: string;
  name: string;
  tags?: string[];
  model?: string | null;
  embedding?: string | null;
  enable_sleeptime?: boolean | null;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type ArchiveItem = {
  id: string;
  text: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  category: string;
  source: string;
  epistemicState: string;
  date: string;
  provenance: string;
};

export type AgentMemorySnapshot = {
  blocks: AgentBlock[];
  archive: ArchiveItem[];
};

export type MemoryReconciliationResult = {
  success: boolean;
  failures: string[];
  restoredBlocks: string[];
  deletedArchiveIds: string[];
  state: AgentMemorySnapshot;
};

export type ModelSwitchRequest = {
  agentId: string;
  currentModelHandle: string;
  targetModelHandle: string;
  embeddingHandle: string;
};

export type ModelSwitchResult = {
  outcome: 'switched';
  agent: AgentSummary;
  memory: AgentMemorySnapshot;
};

export type PersistentWorkflow = {
  captureAgentMemory(agentId: string): Promise<AgentMemorySnapshot>;
  sendMessage(
    agentId: string,
    content: string,
    options?: { requestNoMemoryWrites?: boolean; language?: string },
  ): Promise<ChatMessage[]>;
  updateBlock(
    block: AgentBlock,
    value: string,
    metadata?: Record<string, unknown> | null,
  ): Promise<AgentBlock>;
  listArchive(agentId: string, search?: string): Promise<ArchiveItem[]>;
  archiveText(agentId: string, text: string, tags: string[], createdAt?: string | null): Promise<void>;
  deleteArchiveItem(agentId: string, passageId: string): Promise<void>;
  reconcileTemporaryMemory(
    agentId: string,
    before: AgentMemorySnapshot,
  ): Promise<MemoryReconciliationResult>;
};

type PersistentMutationLease = {
  active: boolean;
};

export class ModelSwitchError extends Error {
  readonly outcome: 'rolled_back' | 'rollback_locked';
  readonly agent: AgentSummary | null;
  readonly memory: AgentMemorySnapshot | null;
  readonly writesLocked: boolean;

  constructor(
    message: string,
    outcome: 'rolled_back' | 'rollback_locked',
    agent: AgentSummary | null = null,
    memory: AgentMemorySnapshot | null = null,
  ) {
    super(message);
    this.name = 'ModelSwitchError';
    this.outcome = outcome;
    this.agent = agent;
    this.memory = memory;
    this.writesLocked = outcome === 'rollback_locked';
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function messageContent(message: Record<string, unknown>): string {
  return stringValue(message.content) || stringValue(message.assistant_message) || stringValue(message.reasoning);
}

async function fetchLettaInventory<T>(
  kind: string,
  configuredHandle: string,
  request: () => PromiseLike<T>,
): Promise<T> {
  try {
    return await request();
  } catch {
    throw new Error(
      `Could not verify ${kind} handle "${configuredHandle}": Letta ${kind} inventory request failed.`,
    );
  }
}

export class PersonalCoLettaClient {
  private readonly client: Letta;
  private connectedAgent: AgentSummary | null = null;
  private writeBarrier: 'open' | 'switching' | 'rollback_locked' = 'open';
  private activeMutations = 0;
  private readonly mutationDrainWaiters: Array<() => void> = [];

  constructor(settings: ConnectionSettings, apiKey?: string) {
    this.client = new Letta({
      baseURL: settings.baseUrl,
      apiKey: apiKey?.trim() || null,
    });
  }

  private beginPersistentMutation(operation: string): PersistentMutationLease {
    if (this.writeBarrier !== 'open') {
      const reason = this.writeBarrier === 'rollback_locked'
        ? 'rollback could not be verified; reload and inspect the Agent before writing'
        : 'a model switch is in progress';
      throw new Error(`Persistent write rejected for ${operation}: ${reason}.`);
    }
    this.activeMutations += 1;
    return { active: true };
  }

  private endPersistentMutation(lease: PersistentMutationLease): void {
    if (!lease.active) return;
    lease.active = false;
    this.activeMutations -= 1;
    if (this.activeMutations === 0) {
      for (const resolve of this.mutationDrainWaiters.splice(0)) resolve();
    }
  }

  private async withPersistentMutation<T>(
    operation: string,
    request: () => Promise<T>,
  ): Promise<T> {
    const lease = this.beginPersistentMutation(operation);
    try {
      return await request();
    } finally {
      this.endPersistentMutation(lease);
    }
  }

  runPersistentWorkflow<T>(
    operation: string,
    workflow: (client: PersistentWorkflow) => Promise<T>,
  ): Promise<T> {
    const lease = this.beginPersistentMutation(operation);
    const assertActive = () => {
      if (!lease.active) {
        throw new Error(`Persistent workflow capability for ${operation} is no longer active.`);
      }
    };
    const scopedClient: PersistentWorkflow = {
      captureAgentMemory: (agentId) => {
        assertActive();
        return this.rawCaptureAgentMemory(agentId);
      },
      sendMessage: (agentId, content, options = {}) => {
        assertActive();
        return this.rawSendMessage(agentId, content, options);
      },
      updateBlock: (block, value, metadata = block.metadata ?? null) => {
        assertActive();
        this.assertWritableBlock(block);
        return this.rawUpdateBlock(block, value, metadata);
      },
      listArchive: (agentId, search = '') => {
        assertActive();
        return this.rawListArchive(agentId, search);
      },
      archiveText: (agentId, text, tags, createdAt) => {
        assertActive();
        return this.rawArchiveText(agentId, text, tags, createdAt);
      },
      deleteArchiveItem: (agentId, passageId) => {
        assertActive();
        return this.rawDeleteArchiveItem(agentId, passageId);
      },
      reconcileTemporaryMemory: (agentId, before) => {
        assertActive();
        return this.rawReconcileTemporaryMemory(agentId, before);
      },
    };

    return (async () => {
      try {
        return await workflow(scopedClient);
      } finally {
        this.endPersistentMutation(lease);
      }
    })();
  }

  private waitForActiveMutations(): Promise<void> {
    if (this.activeMutations === 0) return Promise.resolve();
    return new Promise((resolve) => this.mutationDrainWaiters.push(resolve));
  }

  async ensureAgent(settings: ConnectionSettings): Promise<AgentSummary> {
    return this.withPersistentMutation('Agent initialization', async () => {
      const configuredModelHandle = settings.modelHandle.trim();
      const configuredEmbeddingHandle = settings.embeddingHandle.trim();
      const [models, embeddings] = await Promise.all([
        fetchLettaInventory('generation model', configuredModelHandle, () =>
          this.client.models.list(),
        ),
        fetchLettaInventory('embedding model', configuredEmbeddingHandle, () =>
          this.client.models.embeddings.list(),
        ),
      ]);
      const { modelHandle, embeddingHandle } = assertRegisteredModelHandles(
        configuredModelHandle,
        configuredEmbeddingHandle,
        models,
        embeddings,
      );

      const page = await this.client.agents.list({
        tags: [PERSONAL_CO_AGENT_TAG],
        match_all_tags: true,
        include: ['agent.tags', 'agent.blocks'],
        limit: 20,
      });
      const existing = selectTaggedAgent(page.items, PERSONAL_CO_AGENT_TAG);

      if (existing) {
        assertValidExistingAgentBlocks(existing, PERSONAL_CO_AGENT_TAG);
        if (existing.embedding !== embeddingHandle) {
          throw new Error(
            'The existing Personal Co Agent uses a different embedding handle. Reconnect will not mutate it, and embedding migration is not supported.',
          );
        }
        if (existing.model !== modelHandle) {
          throw new Error(
            'The existing Personal Co Agent uses a different generation model. Reconnect with the active settings, then use the explicit model-switch action.',
          );
        }
        if (existing.enable_sleeptime !== false) {
          throw new Error(
            'The existing Personal Co Agent has sleeptime enabled. Reconnect will not mutate its configuration; correct it explicitly before connecting.',
          );
        }
        this.connectedAgent = existing;
        return existing;
      }

      const blocks = createMemoryBlocks(PERSONA_TEXT, MEMORY_POLICY_TEXT).map((block) => ({
        label: block.label,
        value: block.value,
        limit: block.limit,
        read_only: block.readOnly,
      }));

      const created = await this.client.agents.create({
        name: 'Personal Co',
        description: 'One careful personal thinking partner.',
        tags: [PERSONAL_CO_AGENT_TAG],
        model: modelHandle,
        embedding: embeddingHandle,
        memory_blocks: blocks,
        system: SYSTEM_PROMPT,
        enable_sleeptime: false,
        include_multi_agent_tools: false,
      });
      this.connectedAgent = created;
      return created;
    });
  }

  async testConnection(): Promise<void> {
    await this.client.health();
  }

  private async rawListBlocks(agentId: string): Promise<AgentBlock[]> {
    const page = await this.client.agents.blocks.list(agentId);
    return page.items.map((block) => ({
      id: block.id,
      label: block.label ?? 'UNLABELED',
      value: block.value,
      limit: block.limit,
      readOnly: block.read_only,
      read_only: block.read_only,
      metadata: block.metadata,
    }));
  }

  async listBlocks(agentId: string): Promise<AgentBlock[]> {
    return this.rawListBlocks(agentId);
  }

  private async rawUpdateBlock(
    block: AgentBlock,
    value: string,
    metadata: Record<string, unknown> | null,
  ): Promise<AgentBlock> {
    const updated = await this.client.blocks.update(block.id!, { value, metadata });
    return {
      id: updated.id,
      label: updated.label ?? block.label,
      value: updated.value,
      limit: updated.limit ?? block.limit,
      readOnly: updated.read_only,
      read_only: updated.read_only,
      metadata: updated.metadata,
    };
  }

  async updateBlock(
    block: AgentBlock,
    value: string,
    metadata: Record<string, unknown> | null = block.metadata ?? null,
  ): Promise<AgentBlock> {
    this.assertWritableBlock(block);
    return this.withPersistentMutation(
      `${block.label} block update`,
      () => this.rawUpdateBlock(block, value, metadata),
    );
  }

  private assertWritableBlock(block: AgentBlock): void {
    if (POLICY_MEMORY_LABELS.includes(block.label) || block.readOnly === true || block.read_only === true) {
      throw new Error(`${block.label} is a read-only policy block.`);
    }
    if (!block.id) throw new Error(`The ${block.label} block has no server id.`);
  }

  async listMessages(agentId: string): Promise<ChatMessage[]> {
    const page = await this.client.agents.messages.list(agentId, { limit: 40, use_assistant_message: true });
    return page.items
      .map((message, index): ChatMessage | null => {
        const raw = message as unknown as Record<string, unknown>;
        const kind = stringValue(raw.message_type) || stringValue(raw.messageType);
        const role = kind === 'user_message' ? 'user' : kind === 'assistant_message' ? 'assistant' : null;
        const content = messageContent(raw);
        if (!role || !content) return null;
        return { id: stringValue(raw.id) || `message-${index}`, role, content };
      })
      .filter((message): message is ChatMessage => message !== null);
  }

  private async rawSendMessage(
    agentId: string,
    content: string,
    options: { requestNoMemoryWrites?: boolean; language?: string } = {},
  ): Promise<ChatMessage[]> {
    const messages = messageEnvelope(
      content,
      options.requestNoMemoryWrites === true,
      options.language,
    ) as Array<{
      role: 'user' | 'system';
      content: string;
    }>;
    // Delivery may have succeeded even when the response fails; do not replay messages.
    const response = await this.client.agents.messages.create(agentId, {
      messages,
      use_assistant_message: true,
      stream_tokens: false,
      streaming: false,
    }, { maxRetries: 0 });
    return (response.messages ?? [])
      .map((message, index): ChatMessage | null => {
        const raw = message as unknown as Record<string, unknown>;
        const kind = stringValue(raw.message_type) || stringValue(raw.messageType);
        if (kind !== 'assistant_message') return null;
        const answer = messageContent(raw);
        return answer ? { id: stringValue(raw.id) || `answer-${index}`, role: 'assistant', content: answer } : null;
      })
      .filter((message): message is ChatMessage => message !== null);
  }

  async sendMessage(
    agentId: string,
    content: string,
    options: { requestNoMemoryWrites?: boolean; language?: string } = {},
  ): Promise<ChatMessage[]> {
    return this.withPersistentMutation(
      'message send',
      () => this.rawSendMessage(agentId, content, options),
    );
  }

  private async rawListArchive(agentId: string, search = ''): Promise<ArchiveItem[]> {
    const passages: Array<Record<string, unknown>> = [];
    let after: string | undefined;
    const seenCursors = new Set<string>();
    const seenPassageIds = new Set<string>();
    do {
      const page = await this.client.agents.passages.list(agentId, {
        limit: 100,
        search: search || undefined,
        after,
      });
      const batch = page.map((passage) => passage as unknown as Record<string, unknown>);
      let addedIds = 0;
      for (const passage of batch) {
        const id = stringValue(passage.id);
        if (!id || !seenPassageIds.has(id)) {
          passages.push(passage);
          if (id) addedIds += 1;
        }
        if (id) seenPassageIds.add(id);
      }
      if (batch.length < 100) break;
      const nextCursor = stringValue(batch.at(-1)?.id);
      if (!nextCursor || nextCursor === after || seenCursors.has(nextCursor) || addedIds === 0) {
        throw new Error('Archive pagination could not prove forward progress; the complete Archive snapshot is unavailable.');
      }
      seenCursors.add(nextCursor);
      after = nextCursor;
    } while (after);

    return passages.map((item, index) => {
      const id = stringValue(item.id);
      if (!id) throw new Error(`Archive passage ${index + 1} has no server ID; destructive controls are disabled.`);
      const tags = Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [];
      const createdAt = stringValue(item.created_at) || undefined;
      const metadata = parseArchiveTags(tags, createdAt);
      return {
        id,
        text: stringValue(item.text) || stringValue(item.content),
        tags,
        createdAt,
        updatedAt: stringValue(item.updated_at) || undefined,
        ...metadata,
      };
    });
  }

  async listArchive(agentId: string, search = ''): Promise<ArchiveItem[]> {
    return this.rawListArchive(agentId, search);
  }

  private async rawArchiveText(
    agentId: string,
    text: string,
    tags: string[],
    createdAt?: string | null,
  ): Promise<void> {
    // An append may succeed even when its response fails; do not replay it.
    await this.client.agents.passages.create(agentId, {
      text,
      tags,
      created_at: createdAt || undefined,
    }, { maxRetries: 0 });
  }

  async archiveText(agentId: string, text: string, tags: string[], createdAt?: string | null): Promise<void> {
    return this.withPersistentMutation(
      'Archive append',
      () => this.rawArchiveText(agentId, text, tags, createdAt),
    );
  }

  private async rawDeleteArchiveItem(agentId: string, passageId: string): Promise<void> {
    await this.client.agents.passages.delete(passageId, { agent_id: agentId });
  }

  async deleteArchiveItem(agentId: string, passageId: string): Promise<void> {
    return this.withPersistentMutation(
      'Archive deletion',
      () => this.rawDeleteArchiveItem(agentId, passageId),
    );
  }

  private async rawCaptureAgentMemory(agentId: string): Promise<AgentMemorySnapshot> {
    const [blocks, archive] = await Promise.all([
      this.rawListBlocks(agentId),
      this.rawListArchive(agentId),
    ]);
    return { blocks, archive };
  }

  async captureAgentMemory(agentId: string): Promise<AgentMemorySnapshot> {
    return this.rawCaptureAgentMemory(agentId);
  }

  async switchGenerationModel(request: ModelSwitchRequest): Promise<ModelSwitchResult> {
    const plan = prepareModelSwitch({
      connectedAgent: this.connectedAgent,
      ...request,
    });
    if (this.writeBarrier !== 'open') {
      throw new Error('A model switch cannot start while persistent writes are already paused.');
    }

    // This assignment intentionally occurs before the first await so concurrent callers
    // cannot enter a new persistent mutation after the switch has been requested.
    this.writeBarrier = 'switching';
    let forwardAttempted = false;
    let beforeMemory: AgentMemorySnapshot | null = null;

    try {
      await this.waitForActiveMutations();

      const [models, embeddings] = await Promise.all([
        fetchLettaInventory('generation model', plan.targetModelHandle, () =>
          this.client.models.list(),
        ),
        fetchLettaInventory('embedding model', plan.embeddingHandle, () =>
          this.client.models.embeddings.list(),
        ),
      ]);
      assertRegisteredModelHandles(
        plan.targetModelHandle,
        plan.embeddingHandle,
        models,
        embeddings,
      );

      let beforeAgent;
      try {
        beforeAgent = await this.client.agents.retrieve(plan.agentId, {
          include: ['agent.blocks', 'agent.tags'],
        });
      } catch {
        throw new Error('Model switch aborted before update because the current Agent state could not be retrieved.');
      }
      assertModelSwitchAgentState(beforeAgent, {
        agentId: plan.agentId,
        modelHandle: plan.currentModelHandle,
        embeddingHandle: plan.embeddingHandle,
        requiredTag: PERSONAL_CO_AGENT_TAG,
      });

      try {
        beforeMemory = await this.rawCaptureAgentMemory(plan.agentId);
      } catch {
        throw new Error('Model switch aborted before update because a complete Blocks and Archive snapshot could not be captured.');
      }
      assertModelSwitchAgentState({ ...beforeAgent, blocks: beforeMemory.blocks }, {
        agentId: plan.agentId,
        modelHandle: plan.currentModelHandle,
        embeddingHandle: plan.embeddingHandle,
        requiredTag: PERSONAL_CO_AGENT_TAG,
      });
      assertUnchangedAgentMemory(
        { blocks: beforeAgent.blocks, archive: [] },
        { blocks: beforeMemory.blocks, archive: [] },
      );

      forwardAttempted = true;
      await this.client.agents.update(plan.agentId, {
        model: plan.targetModelHandle,
        enable_sleeptime: false,
      });

      const afterAgent = await this.client.agents.retrieve(plan.agentId, {
        include: ['agent.blocks', 'agent.tags'],
      });
      const afterMemory = await this.rawCaptureAgentMemory(plan.agentId);
      assertModelSwitchAgentState(afterAgent, {
        agentId: plan.agentId,
        modelHandle: plan.targetModelHandle,
        embeddingHandle: plan.embeddingHandle,
        requiredTag: PERSONAL_CO_AGENT_TAG,
      });
      assertModelSwitchAgentState({ ...afterAgent, blocks: afterMemory.blocks }, {
        agentId: plan.agentId,
        modelHandle: plan.targetModelHandle,
        embeddingHandle: plan.embeddingHandle,
        requiredTag: PERSONAL_CO_AGENT_TAG,
      });
      assertUnchangedAgentMemory(
        { blocks: afterAgent.blocks, archive: [] },
        { blocks: afterMemory.blocks, archive: [] },
      );
      assertUnchangedAgentMemory(beforeMemory, afterMemory);

      this.connectedAgent = afterAgent;
      this.writeBarrier = 'open';
      return { outcome: 'switched', agent: afterAgent, memory: afterMemory };
    } catch (error) {
      if (!forwardAttempted || !beforeMemory) {
        this.writeBarrier = 'open';
        throw error;
      }

      let rollbackAgent: AgentSummary | null = null;
      let rollbackMemory: AgentMemorySnapshot | null = null;
      try {
        await this.client.agents.update(plan.agentId, {
          model: plan.currentModelHandle,
          enable_sleeptime: false,
        });
        const observedRollbackAgent = await this.client.agents.retrieve(plan.agentId, {
          include: ['agent.blocks', 'agent.tags'],
        });
        rollbackAgent = observedRollbackAgent;
        rollbackMemory = await this.rawCaptureAgentMemory(plan.agentId);
        assertModelSwitchAgentState(observedRollbackAgent, {
          agentId: plan.agentId,
          modelHandle: plan.currentModelHandle,
          embeddingHandle: plan.embeddingHandle,
          requiredTag: PERSONAL_CO_AGENT_TAG,
        });
        assertModelSwitchAgentState({ ...observedRollbackAgent, blocks: rollbackMemory.blocks }, {
          agentId: plan.agentId,
          modelHandle: plan.currentModelHandle,
          embeddingHandle: plan.embeddingHandle,
          requiredTag: PERSONAL_CO_AGENT_TAG,
        });
        assertUnchangedAgentMemory(
          { blocks: observedRollbackAgent.blocks, archive: [] },
          { blocks: rollbackMemory.blocks, archive: [] },
        );
        assertUnchangedAgentMemory(beforeMemory, rollbackMemory);
      } catch {
        this.writeBarrier = 'rollback_locked';
        throw new ModelSwitchError(
          'The model switch failed and rollback could not be verified. Persistent writes remain locked for this client; reload and inspect the Agent before writing.',
          'rollback_locked',
          rollbackAgent,
          rollbackMemory,
        );
      }

      this.connectedAgent = rollbackAgent;
      this.writeBarrier = 'open';
      throw new ModelSwitchError(
        'The model switch failed after the forward update was attempted. The original model and memory were restored and verified.',
        'rolled_back',
        rollbackAgent,
        rollbackMemory,
      );
    }
  }

  async reconcileTemporaryMemory(
    agentId: string,
    before: AgentMemorySnapshot,
  ): Promise<MemoryReconciliationResult> {
    return this.withPersistentMutation('temporary-memory reconciliation', () =>
      this.rawReconcileTemporaryMemory(agentId, before));
  }

  private async rawReconcileTemporaryMemory(
    agentId: string,
    before: AgentMemorySnapshot,
  ): Promise<MemoryReconciliationResult> {
    let after: AgentMemorySnapshot;
    try {
      after = await this.rawCaptureAgentMemory(agentId);
    } catch (error) {
      return {
        success: false,
        failures: [`Could not inspect memory after the private message: ${error instanceof Error ? error.message : 'unknown error'}`],
        restoredBlocks: [],
        deletedArchiveIds: [],
        state: before,
      };
    }
    const plan = planTemporaryReconciliation(before, after);
    const failures = [...plan.violations];
    const restoredBlocks: string[] = [];
    const deletedArchiveIds: string[] = [];

    for (const block of plan.blockRestores) {
      try {
        if (!block.id) throw new Error(`The ${block.label} block has no server id.`);
        await this.rawUpdateBlock(block, block.value, block.metadata ?? null);
        restoredBlocks.push(block.label);
      } catch (error) {
        failures.push(`Could not restore ${block.label}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    for (const item of plan.archiveDeletes) {
      try {
        await this.rawDeleteArchiveItem(agentId, item.id);
        deletedArchiveIds.push(item.id);
      } catch (error) {
        failures.push(`Could not remove temporary archive passage ${item.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    let state = after;
    try {
      state = await this.rawCaptureAgentMemory(agentId);
      const remaining = planTemporaryReconciliation(before, state);
      if (remaining.blockRestores.length || remaining.archiveDeletes.length || remaining.violations.length) {
        failures.push('Verification found unreconciled memory differences after rollback.');
      }
    } catch (error) {
      failures.push(`Could not verify reconciled memory: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return {
      success: failures.length === 0,
      failures,
      restoredBlocks,
      deletedArchiveIds,
      state,
    };
  }
}
