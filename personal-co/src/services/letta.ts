import Letta from '@letta-ai/letta-client';

import type { ConnectionSettings } from '../config';
import {
  assertValidExistingAgentBlocks,
  planAgentConfigurationUpdate,
  selectTaggedAgent,
} from '../domain/agent.mjs';
import { createMemoryBlocks } from '../domain/memory.mjs';
import { MEMORY_POLICY_TEXT, PERSONA_TEXT, SYSTEM_PROMPT } from '../domain/policy.mjs';

export const PERSONAL_CO_AGENT_TAG = 'personal-co-v1';

export type AgentBlock = {
  id?: string;
  label: string;
  value: string;
  readOnly?: boolean;
  read_only?: boolean;
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
    }));
  }

  async updateBlock(block: AgentBlock, value: string): Promise<AgentBlock> {
    if (!block.id) throw new Error(`The ${block.label} block has no server id.`);
    const updated = await this.client.blocks.update(block.id, { value });
    return {
      id: updated.id,
      label: updated.label ?? block.label,
      value: updated.value,
      readOnly: updated.read_only,
      read_only: updated.read_only,
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

  async sendMessage(agentId: string, content: string): Promise<ChatMessage[]> {
    const response = await this.client.agents.messages.create(agentId, {
      messages: [{ role: 'user', content }],
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
    const passages = await this.client.agents.passages.list(agentId, { limit: 100, search: search || undefined });
    return passages.map((passage, index) => {
      const item = passage as unknown as Record<string, unknown>;
      return {
        id: stringValue(item.id) || `passage-${index}`,
        text: stringValue(item.text) || stringValue(item.content),
        tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        createdAt: stringValue(item.created_at) || undefined,
      };
    });
  }

  async archiveText(agentId: string, text: string, tags: string[]): Promise<void> {
    await this.client.agents.passages.create(agentId, { text, tags });
  }
}
