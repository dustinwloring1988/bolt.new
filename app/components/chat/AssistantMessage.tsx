import { memo } from 'react';
import type { Message } from 'ai';
import { Markdown } from './Markdown';

interface AssistantMessageProps {
  content: string;
  append?: (message: Message) => void;
  chatMode?: 'discuss' | 'build';
  setChatMode?: (mode: 'discuss' | 'build') => void;
  model?: string;
}

export const AssistantMessage = memo(({ content, append, chatMode, setChatMode, model }: AssistantMessageProps) => {
  return (
    <div className="overflow-hidden w-full">
      <Markdown
        html
        append={append}
        chatMode={chatMode}
        setChatMode={setChatMode}
        model={model}
      >
        {content}
      </Markdown>
    </div>
  );
});
