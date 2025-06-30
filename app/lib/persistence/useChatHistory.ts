import { useLoaderData, useNavigate } from '@remix-run/react';
import type { Message } from 'ai';
import { atom } from 'nanostores';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  getMessages,
  getNextId,
  getUrlId,
  openDatabase,
  setMessages,
  getSnapshot,
  setSnapshot,
  saveCheckpoint,
  getCheckpoints,
  getCheckpoint,
  deleteCheckpoint,
  updateChatDescription,
  updateChatDescriptionByUrlId,
} from './db';
import type { Snapshot, Checkpoint } from './types';
import type { FileMap } from '~/lib/stores/files';
import { workbenchStore } from '~/lib/stores/workbench';

export interface ChatHistoryItem {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
}

const persistenceEnabled = !import.meta.env.VITE_DISABLE_PERSISTENCE;

export const db = persistenceEnabled ? await openDatabase() : undefined;

export const chatId = atom<string | undefined>(undefined);
export const description = atom<string | undefined>(undefined);

export function useChatHistory() {
  const navigate = useNavigate();
  const { id: mixedId } = useLoaderData<{ id?: string }>();

  const [initialMessages, setInitialMessages] = useState<Message[]>([]);
  const [archivedMessages, setArchivedMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState<boolean>(false);
  const [urlId, setUrlId] = useState<string | undefined>();

  const restoreSnapshot = useCallback(async (id: string, snapshot?: Snapshot) => {
    if (!snapshot || !snapshot.files) {
      console.warn('No snapshot data to restore');
      return;
    }

    try {
      // clear current workbench state
      workbenchStore.resetAllFileModifications();

      // set the files from the snapshot
      workbenchStore.setDocuments(snapshot.files);

      console.log('Successfully restored snapshot for chat:', id);
      toast.success('Files restored from checkpoint');
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
      toast.error('Failed to restore files from checkpoint');
    }
  }, []);

  useEffect(() => {
    if (!db) {
      setReady(true);

      if (persistenceEnabled) {
        toast.error(`Chat persistence is unavailable`);
      }

      return;
    }

    if (mixedId) {
      Promise.all([getMessages(db, mixedId), getSnapshot(db, mixedId)])
        .then(async ([storedMessages, snapshot]) => {
          if (storedMessages && storedMessages.messages.length > 0) {
            const validSnapshot = snapshot || { chatIndex: '', files: {} };

            setInitialMessages(storedMessages.messages);
            setArchivedMessages([]);
            setUrlId(storedMessages.urlId);
            description.set(storedMessages.description);
            chatId.set(storedMessages.id);

            // if we have a snapshot, restore it
            if (validSnapshot.files) {
              await restoreSnapshot(storedMessages.id, validSnapshot);
            }
          } else {
            navigate(`/`, { replace: true });
          }

          setReady(true);
        })
        .catch((error) => {
          console.error(error);
          toast.error('Failed to load chat: ' + error.message);
          setReady(true);
        });
    } else {
      setReady(true);
    }
  }, [mixedId, db, navigate, restoreSnapshot]);

  const takeSnapshot = useCallback(
    async (chatIdx: string, files: FileMap, _chatId?: string | undefined, chatSummary?: string) => {
      const id = _chatId || chatId.get();

      if (!id || !db) {
        return;
      }

      const snapshot: Snapshot = {
        chatIndex: chatIdx,
        files,
        summary: chatSummary,
      };

      try {
        await setSnapshot(db, id, snapshot);
      } catch (error) {
        console.error('Failed to save snapshot:', error);
        toast.error('Failed to save chat snapshot.');
      }
    },
    [db],
  );

  const createCheckpoint = useCallback(
    async (name: string, description?: string, currentMessages?: any[], isAutoSave = false) => {
      const id = chatId.get();

      if (!id || !db) {
        toast.error('Cannot create checkpoint: No active chat.');
        return;
      }

      const files = workbenchStore.files.get();
      const currentSnapshot = await getSnapshot(db, id);

      // get current chat messages if not provided
      let messages = currentMessages;

      if (!messages) {
        try {
          const chatHistory = await getMessages(db, id);
          messages = chatHistory?.messages || [];
        } catch (error) {
          console.warn('Could not fetch current messages:', error);
          messages = [];
        }
      }

      const checkpoint: Checkpoint = {
        id: `${id}-${Date.now()}`,
        name,
        description,
        timestamp: new Date().toISOString(),
        chatIndex: currentSnapshot?.chatIndex || '',
        files: currentSnapshot?.files || files,
        messages: messages || [],
        messageCount: messages?.length || 0,
        isAutoSave,
        chatId: id,
      };

      try {
        await saveCheckpoint(db, checkpoint);
        toast.success(`Checkpoint "${name}" created successfully.`);

        return checkpoint;
      } catch (error) {
        console.error('Failed to create checkpoint:', error);
        toast.error('Failed to create checkpoint.');
      }
    },
    [db],
  );

  const loadCheckpoints = useCallback(async () => {
    const id = chatId.get();

    if (!id || !db) {
      return [];
    }

    try {
      return await getCheckpoints(db, id);
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
      toast.error('Failed to load checkpoints.');

      return [];
    }
  }, [db]);

  const restoreCheckpoint = useCallback(
    async (checkpointId: string) => {
      if (!db) {
        toast.error('Database not available.');
        return;
      }

      try {
        const checkpoint = await getCheckpoint(db, checkpointId);

        if (!checkpoint) {
          toast.error('Checkpoint not found.');
          return;
        }

        // create a new chat session with the checkpoint data
        const newChatId = await getNextId(db);
        const newUrlId = await getUrlId(db, `checkpoint-${checkpoint.name.toLowerCase().replace(/\s+/g, '-')}`);

        // save the checkpoint messages as a new chat
        await setMessages(db, newChatId, checkpoint.messages, newUrlId, `Restored: ${checkpoint.name}`);

        // save the checkpoint files as a snapshot for the new chat
        await setSnapshot(db, newChatId, {
          chatIndex: checkpoint.chatIndex,
          files: checkpoint.files,
        });

        // navigate to the new chat
        const url = new URL(window.location.href);
        url.pathname = `/chat/${newUrlId}`;
        window.location.href = url.toString();

        toast.success(`Restored to checkpoint "${checkpoint.name}" in new chat`);

        return checkpoint;
      } catch (error) {
        console.error('Failed to restore checkpoint:', error);
        toast.error('Failed to restore checkpoint.');
      }
    },
    [db],
  );

  const removeCheckpoint = useCallback(
    async (checkpointId: string) => {
      if (!db) {
        toast.error('Database not available.');
        return;
      }

      try {
        await deleteCheckpoint(db, checkpointId);
        toast.success('Checkpoint deleted successfully.');
      } catch (error) {
        console.error('Failed to delete checkpoint:', error);
        toast.error('Failed to delete checkpoint.');
      }
    },
    [db],
  );

  const updateDescription = useCallback(
    async (newDescription: string) => {
      if (!db) {
        toast.error('Database not available.');
        return false;
      }

      // validate description
      if (!newDescription.trim()) {
        toast.error('Description cannot be empty.');
        return false;
      }

      if (newDescription.length > 100) {
        toast.error('Description is too long. Maximum 100 characters.');
        return false;
      }

      const currentChatId = chatId.get();
      const currentUrlId = urlId;

      if (!currentChatId && !currentUrlId) {
        toast.error('No active chat to update.');
        return false;
      }

      try {
        // update the database
        if (currentUrlId) {
          await updateChatDescriptionByUrlId(db, currentUrlId, newDescription.trim());
        } else if (currentChatId) {
          await updateChatDescription(db, currentChatId, newDescription.trim());
        }

        // update the local state
        description.set(newDescription.trim());
        toast.success('Chat title updated successfully.');

        return true;
      } catch (error) {
        console.error('Failed to update description:', error);
        toast.error('Failed to update chat title.');

        return false;
      }
    },
    [db, urlId],
  );

  return {
    ready: !mixedId || ready,
    initialMessages,
    archivedMessages,
    takeSnapshot,
    restoreSnapshot,
    createCheckpoint,
    loadCheckpoints,
    restoreCheckpoint,
    removeCheckpoint,
    updateDescription,
    storeMessageHistory: async (messages: Message[]) => {
      if (!db || messages.length === 0) {
        return;
      }

      const { firstArtifact } = workbenchStore;

      if (!urlId && firstArtifact?.id) {
        const urlId = await getUrlId(db, firstArtifact.id);

        navigateChat(urlId);
        setUrlId(urlId);
      }

      if (!description.get() && firstArtifact?.title) {
        description.set(firstArtifact?.title);
      }

      if (initialMessages.length === 0 && !chatId.get()) {
        const nextId = await getNextId(db);

        chatId.set(nextId);

        if (!urlId) {
          navigateChat(nextId);
        }
      }

      const finalChatId = chatId.get();

      if (!finalChatId) {
        console.error('Cannot save messages, chat ID is not set.');
        toast.error('Failed to save chat messages: Chat ID missing.');

        return;
      }

      await setMessages(db, finalChatId, messages, urlId, description.get());
    },
  };
}

function navigateChat(nextId: string) {
  /**
   * FIXME: Using the intended navigate function causes a rerender for <Chat /> that breaks the app.
   *
   * `navigate(`/chat/${nextId}`, { replace: true });`
   */
  const url = new URL(window.location.href);
  url.pathname = `/chat/${nextId}`;

  window.history.replaceState({}, '', url);
}
