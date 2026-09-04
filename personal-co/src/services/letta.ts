import Letta from '@letta-ai/letta-client';

import type { ConnectionSettings } from '../config';
import {
  assertValidExistingAgentBlocks,
  planAgentConfigurationUpdate,
  selectTaggedAgent,
} from '../domain/agent.mjs';
import { parseArchiveTags } from '../domain/imports.mjs';
import { createMemoryBlocks, POLICY_MEMORY_LABELS } from '../domain/memory.mjs';
import { messageEnvelope, planTemporaryReconciliation } from '../domain/privacy.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT, SYSTEM_PROMPT } from '../domain/policy.mjs';

export const PERSONAL_CO_AGENT_TAG = 'personal-co-v1';

export type AgentBlock = {
  id?: string;
  label: string;
  value: string;
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

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function messageContent(message: Record<string, unknown>): string {
  return stringValue(message.content) || stringValue(message.assistant_message) || stringValue(message.reasoning);
}

export class PersonalCoLettaClient {
  private readonly client: Letta;

  constructor(settings: ConnectionSettings, apiKey?: string) {
    this.client = new Letta({
      baseURL: settings.baseUrl,
      apiKey: apiKey?.trim() || null,
    });
  }

  async ensureAgent(settings: ConnectionSettings): Promise<AgentSummary> {
    const page = await this.client.agents.list({
      tags: [PERSONAL_CO_AGENT_TAG],
      match_all_tags: true,
      include: ['agent.tags', 'agent.blocks'],
      limit: 20,
    });
    const existing = selectTaggedAgent(page.items, PERSONAL_CO_AGENT_TAG);

    if (existing) {
      assertValidExistingAgentBlocks(existing, PERSONAL_CO_AGENT_TAG);
      const update = planAgentConfigurationUpdate(
        existing,
        settings.modelHandle,
        settings.embeddingHandle,
      );
      if (update) {
        return this.client.agents.update(update.agentId, {
          model: settings.modelHandle,
          embedding: settings.embeddingHandle,
          enable_sleeptime: false,
        });
      }
      return existing;
    }

    const blocks = createMemoryBlocks(PERSONA_TEXT, MEMORY_POLICY_TEXT).map((block) => ({
      label: block.label,
      value: block.value,
      limit: block.limit,
      read_only: block.readOnly,
    }));

    return this.client.agents.create({
      name: 'Personal Co',
      description: 'One careful personal thinking partner.',
      tags: [PERSONAL_CO_AGENT_TAG],
      model: settings.modelHandle,
      embedding: settings.embeddingHandle,
      memory_blocks: blocks,
      system: SYSTEM_PROMPT,
      enable_sleeptime: false,
      include_multi_agent_tools: false,
    });
  }

  async testConnection(): Promise<void> {
    await this.client.agents.list({ limit: 1 });
  }

  async listBlocks(agentId: string): Promise<AgentBlock[]> {
    const page = await this.client.agents.blocks.list(agentId);
    return page.items.map((block) => ({
      id: block.id,
      label: block.label ?? 'UNLABELED',
      value: block.value,
      readOnly: block.read_only,
      read_only: block.read_only,
      metadata: block.metadata,
    }));
  }

  async updateBlock(
    block: AgentBlock,
    value: string,
    metadata: Record<string, unknown> | null = block.metadata ?? null,
  ): Promise<AgentBlock> {
    if (POLICY_MEMORY_LABELS.includes(block.label) || block.readOnly === true || block.read_only === true) {
      throw new Error(`${block.label} is a read-only policy block.`);
    }
    if (!block.id) throw new Error(`The ${block.label} block has no server id.`);
    const updated = await this.client.blocks.update(block.id, { value, metadata });
    return {
      id: updated.id,
      label: updated.label ?? block.label,
      value: updated.value,
      readOnly: updated.read_only,
      read_only: updated.read_only,
      metadata: updated.metadata,
    };
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

  async sendMessage(
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
    const response = await this.client.agents.messages.create(agentId, {
      messages,
      use_assistant_message: true,
      stream_tokens: false,
      streaming: false,
    });
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

  async listArchive(agentId: string, search = ''): Promise<ArchiveItem[]> {
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
      for (const passage of batch) {
        const id = stringValue(passage.id);
        if (!id || !seenPassageIds.has(id)) passages.push(passage);
        if (id) seenPassageIds.add(id);
      }
      const nextCursor = batch.length === 100 ? stringValue(batch.at(-1)?.id) : '';
      if (!nextCursor || seenCursors.has(nextCursor)) break;
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

  async archiveText(agentId: string, text: string, tags: string[], createdAt?: string | null): Promise<void> {
    await this.client.agents.passages.create(agentId, {
      text,
      tags,
      created_at: createdAt || undefined,
    });
  }

  async deleteArchiveItem(agentId: string, passageId: string): Promise<void> {
    await this.client.agents.passages.delete(passageId, { agent_id: agentId });
  }

  async captureAgentMemory(agentId: string): Promise<AgentMemorySnapshot> {
    const [blocks, archive] = await Promise.all([
      this.listBlocks(agentId),
      this.listArchive(agentId),
    ]);
    return { blocks, archive };
  }

  async reconcileTemporaryMemory(
    agentId: string,
    before: AgentMemorySnapshot,
  ): Promise<MemoryReconciliationResult> {
    let after: AgentMemorySnapshot;
    try {
      after = await this.captureAgentMemory(agentId);
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
        await this.updateBlock(block, block.value, block.metadata ?? null);
        restoredBlocks.push(block.label);
      } catch (error) {
        failures.push(`Could not restore ${block.label}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    for (const item of plan.archiveDeletes) {
      try {
        await this.deleteArchiveItem(agentId, item.id);
        deletedArchiveIds.push(item.id);
      } catch (error) {
        failures.push(`Could not remove temporary archive passage ${item.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    let state = after;
    try {
      state = await this.captureAgentMemory(agentId);
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
