import { streamText as _streamText, convertToCoreMessages } from 'ai';
import { MAX_TOKENS } from './constants';
import { getSystemPrompt } from './prompts';
import { discussPrompt } from '~/lib/common/prompts/discuss-prompt';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { getAnthropicModel } from '~/lib/.server/llm/model';

interface ToolResult<Name extends string, Args, Result> {
  state: 'result';
  toolCallId: string;
  toolName: Name;
  args: Args;
  result: Result;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: ToolResult<string, unknown, unknown>[];
}

export type Messages = Message[];

export type StreamingOptions = Omit<Parameters<typeof _streamText>[0], 'model'>;

export function streamText(messages: Messages, env: Env, options?: StreamingOptions & { modelId?: string, chatMode?: 'discuss' | 'build' }) {
  const modelId = options?.modelId || 'claude-3-5-sonnet-20241022';
  const chatMode = options?.chatMode || 'build';
  
  // Use discuss prompt when in discuss mode, otherwise use build prompt
  const systemPrompt = chatMode === 'discuss' ? discussPrompt() : getSystemPrompt();
  
  return _streamText({
    model: getAnthropicModel(getAPIKey(env), modelId),
    system: systemPrompt,
    maxTokens: MAX_TOKENS,
    headers: {
      'anthropic-beta': 'max-tokens-3-5-sonnet-2024-07-15',
    },
    messages: convertToCoreMessages(messages),
    ...options,
  });
}
