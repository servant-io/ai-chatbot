export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  provider: 'openai' | 'xai';
  providerModelId: string;
  capabilities?: {
    liveSearch?: boolean;
    fileSearch?: boolean;
  };
}

export const chatModels = [
  {
    id: 'chat-model',
    name: 'GPT-5',
    description: 'Unified chat + reasoning (OpenAI gpt-5)',
    provider: 'openai',
    providerModelId: 'openai/gpt-5',
    capabilities: {
      liveSearch: false,
      fileSearch: true,
    },
  },
  {
    id: 'chat-model-grok-4-fast-reasoning',
    name: 'Grok 4 (Fast)',
    description:
      'Fast multimodal reasoning from X AI',
    provider: 'xai',
    providerModelId: 'xai/grok-4-fast-reasoning',
    capabilities: {
      liveSearch: true,
      fileSearch: false,
    },
  },
] satisfies ReadonlyArray<ChatModel>;

export type ChatModelId = (typeof chatModels)[number]['id'];

export function getChatModelById(id: string): ChatModel | undefined {
  return chatModels.find((model) => model.id === id);
}

export function resolveProviderModelId(id: string): string {
  const chatModel = getChatModelById(id);
  if (chatModel) {
    return chatModel.providerModelId;
  }

  switch (id) {
    case 'title-model':
      return 'openai/gpt-4.1-nano';
    case 'artifact-model':
      return 'openai/gpt-4.1';
    default:
      return id;
  }
}
