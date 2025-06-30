import * as nodePath from 'node:path';
import React from 'react';
import type { Message } from 'ai';
import { useChat as useAIChat } from 'ai/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatService, type AttachedImage } from '~/lib/services/chatService';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useChat');

export interface UseChatOptions {
  initialMessages: Message[];
  storeMessageHistory: (messages: Message[]) => Promise<void>;
}

export interface UseChatReturn {
  // chat state
  messages: Message[];
  isLoading: boolean;
  input: string;
  chatStarted: boolean;
  attachedImages: AttachedImage[];
  selectedModel: string;
  chatMode: 'discuss' | 'build';

  // chat actions
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  setInput: (input: string) => void;
  sendMessage: (event: React.UIEvent, messageInput?: string) => Promise<void>;
  handleImageAttach: (files: FileList) => void;
  handleImageRemove: (index: number) => void;
  abort: () => void;

  // model and mode controls
  setSelectedModel: (model: string) => void;
  setChatMode: (mode: 'discuss' | 'build') => void;

  // animation and UI
  runAnimation: () => Promise<void>;
  scrollTextArea: () => void;
}

export function useChat({ initialMessages, storeMessageHistory }: UseChatOptions): UseChatReturn {
  const [chatStarted, setChatStarted] = useState(initialMessages.length > 0);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [selectedModel, setSelectedModel] = useState('claude-3-5-sonnet-20241022');
  const [chatMode, setChatMode] = useState<'discuss' | 'build'>('build');

  // memoize the body object to prevent unnecessary re-renders
  const chatBody = useMemo(
    () => ({
      model: selectedModel,
      chatMode,
    }),
    [selectedModel, chatMode],
  );

  // memoize the callbacks to prevent useChat from reinitializing
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
    // this will be implemented by the component that uses this hook
  }, []);

  const abort = useCallback(() => {
    stop();
    chatStore.abortChat();
    workbenchStore.abortAllActions();
  }, [stop]);

  const handleImageAttach = useCallback((files: FileList) => {
    const newImages = ChatService.handleImageAttach(files);
    setAttachedImages((prev: AttachedImage[]) => [...prev, ...newImages]);
  }, []);

  const handleImageRemove = useCallback((index: number) => {
    setAttachedImages((prev: AttachedImage[]) => {
      const image = prev[index];

      if (image) {
        URL.revokeObjectURL(image.url);
      }

      return prev.filter((_: AttachedImage, i: number) => i !== index);
    });
  }, []);

  const sendMessage = useCallback(
    async (_event: React.UIEvent, messageInput?: string) => {
      const _input = messageInput || input;

      if ((_input.length === 0 && attachedImages.length === 0) || isLoading) {
        return;
      }

      // reset aborted state by starting a new chat
      if (chatStore.getState().aborted) {
        chatStore.startChat();
      }

      runAnimation();

      const message = await ChatService.createMessage(_input, attachedImages);

      setInput('');
      setAttachedImages([]);

      // clean up image URLs
      ChatService.cleanupImageUrls(attachedImages);

      // use append to send the message and update UI
      await append(message);
    },
    [input, attachedImages, isLoading, append, setInput, runAnimation],
  );

  // function to load files from localStorage
  const loadPendingFiles = useCallback(async () => {
    try {
      const pendingFilesData = localStorage.getItem('bolt_pending_files');

      if (!pendingFilesData) {
        return;
      }

      const fileData = JSON.parse(pendingFilesData);
      const { files, type, repoName, folderName } = fileData;

      if (!files || typeof files !== 'object') {
        console.warn('Invalid file data in localStorage');
        localStorage.removeItem('bolt_pending_files');

        return;
      }

      console.log(`Loading ${Object.keys(files).length} files from ${type} source...`);

      // get webcontainer instance
      const container = await webcontainer;

      // clear existing files first - remove all files in the workdir
      try {
        const filesInWorkdir = await container.fs.readdir('.', { withFileTypes: true });

        for (const file of filesInWorkdir) {
          if (file.isFile()) {
            await container.fs.rm(file.name, { force: true });
          } else if (file.isDirectory()) {
            await container.fs.rm(file.name, { recursive: true, force: true });
          }
        }
      } catch (clearError) {
        console.warn('Failed to clear existing files:', clearError);
      }

      // create new files in the webcontainer
      let createdFiles = 0;

      for (const [path, content] of Object.entries(files)) {
        try {
          // create directory structure if needed
          const folder = nodePath.dirname(path);

          if (folder !== '.') {
            await container.fs.mkdir(folder, { recursive: true });
          }

          // write the file
          await container.fs.writeFile(path, content as string);
          createdFiles++;
        } catch (fileError) {
          console.warn(`Failed to create file ${path}:`, fileError);
        }
      }

      // show the workbench
      workbenchStore.setShowWorkbench(true);

      const sourceName = type === 'github' ? repoName : folderName;
      console.log(`Successfully loaded ${createdFiles} files from ${sourceName}`);

      // clean up localStorage
      localStorage.removeItem('bolt_pending_files');
    } catch (error) {
      console.error('Failed to load pending files:', error);
      localStorage.removeItem('bolt_pending_files');
    }
  }, []);

  // handle template parameter from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const templateParam = urlParams.get('template');
    const loadFilesParam = urlParams.get('loadFiles');

    if (templateParam && !chatStarted && messages.length === 0 && !isLoading) {
      const decodedTemplate = decodeURIComponent(templateParam);

      // set chat as started first
      setChatStarted(true);
      chatStore.startChat();

      // run animation to transition from intro to chat
      runAnimation();

      // load files if requested
      if (loadFilesParam === 'true') {
        loadPendingFiles();
      }

      // send the template prompt automatically
      append({
        role: 'user',
        content: decodedTemplate,
      });

      // clean up the URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('template');
      newUrl.searchParams.delete('loadFiles');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, [chatStarted, messages.length, isLoading, append, runAnimation, loadPendingFiles]);

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
    // chat state
    messages,
    isLoading,
    input,
    chatStarted,
    attachedImages,
    selectedModel,
    chatMode,

    // chat actions
    handleInputChange,
    setInput,
    sendMessage,
    handleImageAttach,
    handleImageRemove,
    abort,

    // model and mode controls
    setSelectedModel,
    setChatMode,

    // animation and UI
    runAnimation,
    scrollTextArea,
  };
}
