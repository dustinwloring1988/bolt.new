import { useStore } from '@nanostores/react';
import type { Message } from 'ai';
import { useChat } from 'ai/react';
import { useAnimate } from 'framer-motion';
import { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { cssTransition, toast, ToastContainer } from 'react-toastify';
import { BaseChat, type AttachedImage } from './BaseChat';
import { useMessageParser, usePromptEnhancer, useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatHistory } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { fileModificationsToHTML } from '~/utils/diff';
import { cubicEasingFn } from '~/utils/easings';
import { createScopedLogger, renderLogger } from '~/utils/logger';
import { validateImageFile, formatFileSize } from '~/utils/images';

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

  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);

  const { showChat } = useStore(chatStore);

  const [animationScope, animate] = useAnimate();
  
  // State declarations must come before useChat hook
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');

  // Memoize the body object to prevent unnecessary re-renders
  const chatBody = useMemo(() => ({
    model: selectedModel,
    chatMode,
  }), [selectedModel, chatMode]);

  // Memoize the callbacks to prevent useChat from reinitializing
  const onError = useCallback((error: Error) => {
    logger.error('Request failed\n\n', error);
    toast.error('There was an error processing your request');
  }, []);

  const onFinish = useCallback(() => {
    logger.debug('Finished streaming');
  }, []);

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useChat({
    api: '/api/chat',
    body: chatBody,
    onError,
    onFinish,
    initialMessages,
  });

  const { enhancingPrompt, promptEnhanced, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const { parsedMessages, parseMessages } = useMessageParser();

  const TEXTAREA_MAX_HEIGHT = chatStarted ? 400 : 200;

  const runAnimation = async () => {
    if (chatStarted) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    chatStore.setKey('started', true);

    setChatStarted(true);
  };

  // Handle template parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    
    if (templateParam && !chatStarted && messages.length === 0 && !isLoading) {
      const decodedTemplate = decodeURIComponent(templateParam);
      
      // Set chat as started first
      setChatStarted(true);
      chatStore.setKey('started', true);
      
      // Run animation to transition from intro to chat
      runAnimation();
      
      // Send the template prompt automatically
      append({
        role: 'user',
        content: decodedTemplate,
      });
      
      // Clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('template');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [chatStarted, messages.length, isLoading, append, runAnimation]);

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
    chatStore.setKey('started', initialMessages.length > 0);
  }, []);

  useEffect(() => {
    // Only parse messages if we have assistant messages to parse
    const hasAssistantMessages = messages.some(msg => msg.role === 'assistant');
    if (hasAssistantMessages) {
      parseMessages(messages, isLoading);
    }

    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => toast.error(error.message));
    }
  }, [messages, isLoading, parseMessages, initialMessages.length, storeMessageHistory]);

  const scrollTextArea = () => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  };

  const abort = useCallback(() => {
    stop();
    chatStore.setKey('aborted', true);
    workbenchStore.abortAllActions();
  }, [stop]);

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

  const handleImageAttach = useCallback((files: FileList) => {
    const newImages: AttachedImage[] = [];
    const rejectedFiles: string[] = [];
    
    Array.from(files).forEach((file) => {
      if (!validateImageFile(file)) {
        if (!file.type.startsWith('image/')) {
          rejectedFiles.push(`${file.name}: Invalid file type`);
        } else if (file.size > 10 * 1024 * 1024) {
          rejectedFiles.push(`${file.name}: File too large (max 10MB, current: ${formatFileSize(file.size)})`);
        }
        return;
      }
      
      const url = URL.createObjectURL(file);
      newImages.push({
        file,
        url,
        type: file.type,
      });
    });
    
    if (rejectedFiles.length > 0) {
      toast.error(`Some files were rejected:\n${rejectedFiles.join('\n')}`);
    }
    
    if (newImages.length > 0) {
      setAttachedImages(prev => [...prev, ...newImages]);
      toast.success(`${newImages.length} image(s) attached`);
    }
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setAttachedImages(prev => {
      const image = prev[index];
      if (image) {
        URL.revokeObjectURL(image.url);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const sendMessage = useCallback(async (_event: React.UIEvent, messageInput?: string) => {
    const _input = messageInput || input;
    if ((_input.length === 0 && attachedImages.length === 0) || isLoading) {
      return;
    }
    await workbenchStore.saveAllFiles();
    const fileModifications = workbenchStore.getFileModifcations();
    chatStore.setKey('aborted', false);
    runAnimation();
    let content = '';
    if (fileModifications !== undefined) {
      const diff = fileModificationsToHTML(fileModifications);
      content = `${diff}\n\n${_input}`;
      workbenchStore.resetAllFileModifications();
    } else {
      content = _input;
    }

    // Handle image attachments
    const messageContent: any = {
      role: 'user',
      content,
    };

    // If there are images, format the message to include them
    if (attachedImages.length > 0) {
      const imageDescriptions = attachedImages.map((img, index) => 
        `[Image ${index + 1}: ${img.file.name}]`
      ).join(' ');
      
      messageContent.content = `${imageDescriptions}\n\n${content}`;
    }

    setInput('');
    setAttachedImages([]);
    resetEnhancer();
    textareaRef.current?.blur();
    
    // Clean up image URLs
    attachedImages.forEach(image => {
      URL.revokeObjectURL(image.url);
    });
    
    // Use append to send the message and update UI
    await append(messageContent);
  }, [input, attachedImages, isLoading, append, setInput, resetEnhancer]);

  const enhancePromptCallback = useCallback(() => {
    enhancePrompt(input, (input) => {
      setInput(input);
      scrollTextArea();
    });
  }, [enhancePrompt, input, setInput]);

  const [messageRef, scrollRef] = useSnapScroll();

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
    sendMessage,
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
    append,
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
    sendMessage,
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
    append,
  ]);

  return <BaseChat {...baseChatProps} />;
});
