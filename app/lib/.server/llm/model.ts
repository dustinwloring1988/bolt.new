import { createAnthropic } from '@ai-sdk/anthropic';

export function getAnthropicModel(apiKey: string, modelId: string = 'claude-3-5-sonnet-20241022') {
  const anthropic = createAnthropic({
    apiKey,
  });
  return anthropic(modelId);
}

export const CLAUDE_MAX_MODEL = {
  id: 'claude-3-7-sonnet-20250219',
  name: 'Claude 3.7 Sonnet',
  provider: 'Anthropic',
};
