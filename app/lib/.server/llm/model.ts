import { createAnthropic } from '@ai-sdk/anthropic';

export function getAnthropicModel(apiKey: string, model?: string) {
  const anthropic = createAnthropic({
    apiKey,
  });

  return anthropic(model || 'claude-3-5-sonnet-20241022');
}
