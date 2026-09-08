import { validateMemorySchema } from './memory.mjs';

function normalizedConfiguredHandle(kind, handle) {
  const normalized = typeof handle === 'string' ? handle.trim() : '';
  if (!normalized) {
    throw new Error(`Configured ${kind} handle is required.`);
  }
  return normalized;
}

function assertInventoryContainsHandle(kind, configuredHandle, inventory) {
  const handle = normalizedConfiguredHandle(kind, configuredHandle);
  const available = Array.isArray(inventory) && inventory.some(
    (item) =>
      typeof item?.handle === 'string' &&
      item.handle.trim() !== '' &&
      item.handle === handle,
  );

  if (!available) {
    throw new Error(`Configured ${kind} handle "${handle}" is not registered by Letta.`);
  }

  return handle;
}

export function assertRegisteredModelHandles(
  modelHandle,
  embeddingHandle,
  models,
  embeddings,
) {
  return {
    modelHandle: assertInventoryContainsHandle('generation model', modelHandle, models),
    embeddingHandle: assertInventoryContainsHandle(
      'embedding model',
      embeddingHandle,
      embeddings,
    ),
  };
}

export function selectTaggedAgent(agents, tag) {
  const matches = agents.filter(
    (agent) => Array.isArray(agent.tags) && agent.tags.includes(tag),
  );

  if (matches.length > 1) {
    throw new Error(`Found ${matches.length} agents tagged ${tag}; resolve duplicates before connecting.`);
  }

  return matches[0] ?? null;
}

export function validateExistingAgentBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return {
      valid: false,
      exactLabels: false,
      policyReadOnly: false,
      userWritable: false,
    };
  }

  return validateMemorySchema(
    blocks.map((block) => ({
      label: block.label,
      readOnly: block.read_only,
    })),
  );
}

export function assertValidExistingAgentBlocks(agent, tag) {
  const validation = validateExistingAgentBlocks(agent.blocks);
  if (!validation.valid) {
    throw new Error(
      `Agent ${agent.id} tagged ${tag} does not have the exact Personal Co memory schema.`,
    );
  }
}

export function planAgentConfigurationUpdate(agent, model, embedding) {
  if (
    agent.model === model &&
    agent.embedding === embedding &&
    agent.enable_sleeptime === false
  ) {
    return null;
  }

  return {
    agentId: agent.id,
  };
}
