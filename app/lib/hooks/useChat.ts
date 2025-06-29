import type { Message } from 'ai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useChat as useAIChat } from 'ai/react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { ChatService, type AttachedImage } from '~/lib/services/chatService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useChat');

export interface UseChatOptions {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export interface UseChatReturn {
  // Chat state
  messages: Message[];
  isLoading: boolean;
  input: string;
  chatStarted: boolean;
  attachedImages: AttachedImage[];
  selectedModel: string;
  chatMode: 'discuss' | 'build';
  
  // Chat actions
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  setInput: (input: string) => void;
  sendMessage: (event: React.UIEvent, messageInput?: string) => Promise<void>;
  handleImageAttach: (files: FileList) => void;
  handleImageRemove: (index: number) => void;
  abort: () => void;
  
  // Model and mode controls
  setSelectedModel: (model: string) => void;
  setChatMode: (mode: 'discuss' | 'build') => void;
  
  // Animation and UI
  runAnimation: () => Promise<void>;
  scrollTextArea: () => void;
}

export function useChat({ initialMessages, storeMessageHistory }: UseChatOptions): UseChatReturn {
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');

  // Memoize the body object to prevent unnecessary re-renders
  const chatBody = useMemo(() => ({
    model: selectedModel,
    chatMode,
  }), [selectedModel, chatMode]);

  // Memoize the callbacks to prevent useChat from reinitializing
  const onError = useCallback((error: Error) => {
    ChatService.handleChatError(error);
  }, []);

  const onFinish = useCallback(() => {
    ChatService.handleChatFinish();
  }, []);

  const { messages, isLoading, input, handleInputChange, setInput, stop, append } = useAIChat({
    api: '/api/chat',
    body: chatBody,
    onError,
    onFinish,
    initialMessages,
  });

  const runAnimation = useCallback(async () => {
    if (chatStarted) {
      return;
    }

    chatStore.startChat();
    setChatStarted(true);
  }, [chatStarted]);

  const scrollTextArea = useCallback(() => {
    // This will be implemented by the component that uses this hook
  }, []);

  const abort = useCallback(() => {
    stop();
    chatStore.abortChat();
    workbenchStore.abortAllActions();
  }, [stop]);

  const handleImageAttach = useCallback((files: FileList) => {
    const newImages = ChatService.handleImageAttach(files);
    setAttachedImages(prev => [...prev, ...newImages]);
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

    // Reset aborted state by starting a new chat
    if (chatStore.getState().aborted) {
      chatStore.startChat();
    }
    runAnimation();

    const message = await ChatService.createMessage(_input, attachedImages);

    setInput('');
    setAttachedImages([]);
    
    // Clean up image URLs
    ChatService.cleanupImageUrls(attachedImages);
    
    // Use append to send the message and update UI
    await append(message);
  }, [input, attachedImages, isLoading, append, setInput, runAnimation]);

  // Handle template parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    
    if (templateParam && !chatStarted && messages.length === 0 && !isLoading) {
      const decodedTemplate = decodeURIComponent(templateParam);
      
      // Set chat as started first
      setChatStarted(true);
      chatStore.startChat();
      
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

  useEffect(() => {
    if (initialMessages.length > 0) {
      chatStore.startChat();
    }
  }, [initialMessages.length]);

  useEffect(() => {
    if (messages.length > initialMessages.length) {
      storeMessageHistory(messages).catch((error) => {
        logger.error('Failed to store message history:', error);
      });
    }
  }, [messages, initialMessages.length, storeMessageHistory]);

  return {
    // Chat state
    messages,
    isLoading,
    input,
    chatStarted,
    attachedImages,
    selectedModel,
    chatMode,
    
    // Chat actions
    handleInputChange,
    setInput,
    sendMessage,
    handleImageAttach,
    handleImageRemove,
    abort,
    
    // Model and mode controls
    setSelectedModel,
    setChatMode,
    
    // Animation and UI
    runAnimation,
    scrollTextArea,
  };
} 