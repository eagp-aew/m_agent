export type ConnectionSettings = {
  baseUrl: string;
  modelHandle: string;
  embeddingHandle: string;
};

type RuntimeWithEnv = typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const env = (globalThis as RuntimeWithEnv).process?.env ?? {};

export const RECOMMENDED_MODEL_HANDLES = Object.freeze({
  default: 'deepseek/deepseek-v4-pro',
  quality: 'openai/gpt-5.6-terra',
});

export const RECOMMENDED_EMBEDDING_HANDLE = 'ollama/nomic-embed-text';

export const DEFAULT_SETTINGS: ConnectionSettings = {
  baseUrl: env.EXPO_PUBLIC_LETTA_BASE_URL ?? 'http://localhost:8283',
  modelHandle: env.EXPO_PUBLIC_LETTA_MODEL ?? RECOMMENDED_MODEL_HANDLES.default,
  embeddingHandle:
    env.EXPO_PUBLIC_LETTA_EMBEDDING ?? RECOMMENDED_EMBEDDING_HANDLE,
};

export function normalizeSettings(
  settings: ConnectionSettings,
): ConnectionSettings {
  const baseUrl = settings.baseUrl.trim().replace(/\/+$/, '');
  const modelHandle = settings.modelHandle.trim();
  const embeddingHandle = settings.embeddingHandle.trim();

  if (!baseUrl || !modelHandle || !embeddingHandle) {
    throw new Error('Base URL, model handle, and embedding handle are required.');
  }

  return { baseUrl, modelHandle, embeddingHandle };
}
