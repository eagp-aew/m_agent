import { validateMemorySchema } from './memory.mjs';
import { stripSecretLikeFields } from './snapshot.mjs';

function requiredHandle(kind, value) {
  const handle = typeof value === 'string' ? value.trim() : '';
  if (!handle) throw new Error(`${kind} is required for a model switch.`);
  return handle;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function canonicalBlock(block) {
  return {
    id: String(block?.id ?? ''),
    label: String(block?.label ?? ''),
    value: String(block?.value ?? ''),
    limit: typeof block?.limit === 'number' ? block.limit : null,
    readOnly: block?.readOnly === true || block?.read_only === true,
    metadata: stableValue(stripSecretLikeFields(block?.metadata ?? {})),
  };
}

function canonicalArchiveItem(item) {
  return {
    id: String(item?.id ?? ''),
    text: String(item?.text ?? ''),
    tags: [...new Set(Array.isArray(item?.tags) ? item.tags.map(String) : [])].sort(),
    createdAt: typeof item?.createdAt === 'string' ? item.createdAt : null,
  };
}

export function canonicalAgentMemory(memory) {
  return {
    blocks: (memory?.blocks ?? [])
      .map(canonicalBlock)
      .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id)),
    archive: (memory?.archive ?? [])
      .map(canonicalArchiveItem)
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function prepareModelSwitch({
  connectedAgent,
  agentId,
  currentModelHandle,
  targetModelHandle,
  embeddingHandle,
}) {
  if (!connectedAgent?.id) {
    throw new Error('A connected exact Agent context is required for a model switch.');
  }
  const expectedAgentId = String(agentId ?? '').trim();
  if (!expectedAgentId || expectedAgentId !== connectedAgent.id) {
    throw new Error('The requested Agent ID does not match the connected Agent.');
  }
  const currentModel = requiredHandle('The active generation model handle', currentModelHandle);
  const targetModel = requiredHandle('The target generation model handle', targetModelHandle);
  const embedding = requiredHandle('The locked embedding handle', embeddingHandle);
  if (connectedAgent.model !== currentModel) {
    throw new Error('The active generation model no longer matches the connected Agent. Reconnect before switching.');
  }
  if (connectedAgent.embedding !== embedding) {
    throw new Error('The locked embedding handle does not match the connected Agent; embedding migration is not supported.');
  }
  if (targetModel === currentModel) {
    throw new Error('The target generation model must differ from the active model.');
  }
  return {
    agentId: expectedAgentId,
    currentModelHandle: currentModel,
    targetModelHandle: targetModel,
    embeddingHandle: embedding,
  };
}

export function assertModelSwitchAgentState(
  agent,
  { agentId, modelHandle, embeddingHandle, requiredTag },
) {
  if (agent?.id !== agentId) {
    throw new Error('Model-switch verification returned a different Agent ID.');
  }
  if (agent.model !== modelHandle) {
    throw new Error(`Model-switch verification did not observe generation model "${modelHandle}".`);
  }
  if (agent.embedding !== embeddingHandle) {
    throw new Error('Model-switch verification detected an embedding change.');
  }
  if (agent.enable_sleeptime !== false) {
    throw new Error('Model-switch verification did not observe disabled sleeptime.');
  }
  if (!Array.isArray(agent.tags) || !agent.tags.includes(requiredTag)) {
    throw new Error('Model-switch verification lost the Personal Co Agent tag.');
  }
  const schema = validateMemorySchema(
    Array.isArray(agent.blocks)
      ? agent.blocks.map((block) => ({
          label: block?.label,
          readOnly: block?.readOnly === true || block?.read_only === true,
        }))
      : [],
  );
  if (!schema.valid) {
    throw new Error('Model-switch verification requires the exact six-block Personal Co memory schema.');
  }
  if (agent.blocks.some((block) => !String(block?.id ?? '').trim())) {
    throw new Error('Model-switch verification requires stable server IDs for all six memory blocks.');
  }
  return agent;
}

export function assertUnchangedAgentMemory(before, after) {
  const expected = canonicalAgentMemory(before);
  const observed = canonicalAgentMemory(after);
  if (JSON.stringify(expected) !== JSON.stringify(observed)) {
    throw new Error('Model-switch verification detected a Blocks or Archive change.');
  }
  return observed;
}
