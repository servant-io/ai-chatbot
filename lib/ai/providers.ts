import { customProvider } from 'ai';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import { isTestEnvironment } from '../constants';

export const myProvider = isTestEnvironment
  ? (() => {
      const {
        artifactModel,
        chatModel,
        reasoningModel,
        titleModel,
      } = require('./models.test');
      return customProvider({
        languageModels: {
          'chat-model': chatModel,
          'chat-model-grok-4-fast-reasoning': reasoningModel,
          'title-model': titleModel,
          'artifact-model': artifactModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        'chat-model': openai.languageModel('gpt-5'),
        'chat-model-grok-4-fast-reasoning': xai.languageModel(
          'grok-4-fast-reasoning',
        ),
        'title-model': openai.languageModel('gpt-4.1-nano'),
        'artifact-model': openai.languageModel('gpt-4.1'),
      },
    });
