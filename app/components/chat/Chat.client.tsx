import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useMemo, useCallback } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { BaseChat } from './BaseChat';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll, useChat } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const toastAnimation = cssTransition({
  enter: 'animated fadeInRight',
  exit: 'animated fadeOutRight',
});

const logger = createScopedLogger('Chat');

export function Chat() {
  renderLogger.trace('Chat');

  const { ready, initialMessages, storeMessageHistory } = useChatHistory();

  return (
    <>
      {ready && <ChatImpl initialMessages={initialMessages} storeMessageHistory={storeMessageHistory} />}
      <ToastContainer
        closeButton={({ closeToast }) => {
          return (
            <button className="Toastify__close-button" onClick={closeToast}>
              <div className="i-ph:x text-lg" />
            </button>
          );
        }}
        icon={({ type }) => {
          /**
           * @todo Handle more types if we need them. This may require extra color palettes.
           */
          switch (type) {
            case 'success': {
              return <div className="i-ph:check-bold text-bolt-elements-icon-success text-2xl" />;
            }
            case 'error': {
              return <div className="i-ph:warning-circle-bold text-bolt-elements-icon-error text-2xl" />;
            }
          }

          return undefined;
        }}
        position="bottom-right"
        pauseOnFocusLoss
        transition={toastAnimation}
      />
    </>
  );
}

interface ChatProps {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export const ChatImpl = memo(({ initialMessages, storeMessageHistory }: ChatProps) => {
  useShortcuts();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatState = useStore(chatStore.state);
  const { showChat } = chatState;

  const [animationScope, animate] = useAnimate();

  // Use the new useChat hook
  const {
    messages,
    isLoading,
    input,
    chatStarted,
    attachedImages,
    selectedModel,
    chatMode,
    handleInputChange,
    setInput,
    sendMessage,
    handleImageAttach,
    handleImageRemove,
    abort,
    setSelectedModel,
    setChatMode,
    runAnimation,
    scrollTextArea,
  } = useChat({ initialMessages, storeMessageHistory });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  // Enhanced runAnimation with actual animations
  const enhancedRunAnimation = useCallback(async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    await runAnimation();
  }, [chatStarted, animate, runAnimation]);

  // Override the scrollTextArea function from the hook
  const enhancedScrollTextArea = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, []);

  // Handle textarea height adjustment
  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      const currentHeight = textarea.style.height;
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;
      const newHeight = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;

      // Only update if the height actually changed
      if (currentHeight !== newHeight) {
        textarea.style.height = newHeight;
        textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
      }
    }
  }, [input, textareaRef, TEXTAREA_MAX_HEIGHT]);

  // Enhanced sendMessage that includes enhancer reset
  const enhancedSendMessage = useCallback(async (event: React.UIEvent, messageInput?: string) => {
    await sendMessage(event, messageInput);
    resetEnhancer();
    textareaRef.current?.blur();
  }, [sendMessage, resetEnhancer]);

  // Enhanced enhancePrompt callback
  const enhancePromptCallback = useCallback(() => {
    enhancePrompt(input, (input) => {
      setInput(input);
      enhancedScrollTextArea();
    });
  }, [enhancePrompt, input, setInput, enhancedScrollTextArea]);

  const [messageRef, scrollRef] = useSnapScroll();

  // Memoize the transformed messages to prevent unnecessary re-renders
  const transformedMessages = useMemo(() => {
    return messages.map((message, i) => {
      if (message.role === 'user') {
        return message;
      }
      return {
        ...message,
        content: parsedMessages[i] || '',
      };
    });
  }, [messages, parsedMessages]);

  useEffect(() => {
    // Only parse messages if we have assistant messages to parse
    const hasAssistantMessages = messages.some(msg => msg.role === 'assistant');
    if (hasAssistantMessages) {
      parseMessages(messages, isLoading);
    }
  }, [messages, isLoading, parseMessages]);

  // Memoize BaseChat props to prevent unnecessary re-renders
  const baseChatProps = useMemo(() => ({
    ref: animationScope,
    textareaRef,
    input,
    showChat,
    chatStarted,
    isStreaming: isLoading,
    enhancingPrompt,
    promptEnhanced,
    attachedImages,
    sendMessage: enhancedSendMessage,
    messageRef,
    scrollRef,
    handleInputChange,
    handleImageAttach,
    handleImageRemove,
    handleStop: abort,
    messages: transformedMessages,
    enhancePrompt: enhancePromptCallback,
    model: selectedModel,
    onModelChange: setSelectedModel,
    chatMode,
    setChatMode,
  }), [
    animationScope,
    textareaRef,
    input,
    showChat,
    chatStarted,
    isLoading,
    enhancingPrompt,
    promptEnhanced,
    attachedImages,
    enhancedSendMessage,
    messageRef,
    scrollRef,
    handleInputChange,
    handleImageAttach,
    handleImageRemove,
    abort,
    transformedMessages,
    enhancePromptCallback,
    selectedModel,
    setSelectedModel,
    chatMode,
    setChatMode,
  ]);

  return <BaseChat {...baseChatProps} />;
});
