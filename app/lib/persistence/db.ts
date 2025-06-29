import type { Message } from 'ai';
import type { ChatHistoryItem } from './useChatHistory';
import type { Snapshot, Checkpoint } from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatHistory');

// Snapshot functions
export async function getSnapshot(db: IDBDatabase, chatId: string): Promise<Snapshot | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readonly');
    const store = transaction.objectStore('snapshots');
    const request = store.get(chatId);

    request.onsuccess = () => resolve(request.result?.snapshot as Snapshot | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function setSnapshot(db: IDBDatabase, chatId: string, snapshot: Snapshot): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.put({ chatId, snapshot });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSnapshot(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('snapshots', 'readwrite');
    const store = transaction.objectStore('snapshots');
    const request = store.delete(chatId);

    request.onsuccess = () => resolve();

    request.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        resolve();
      } else {
        reject(request.error);
      }
    };
  });
}

// this is used at the top level and never rejects
export async function openDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('boltHistory', 3);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('chats')) {
          const store = db.createObjectStore('chats', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
          store.createIndex('urlId', 'urlId', { unique: true });
        }
      }
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('snapshots')) {
          db.createObjectStore('snapshots', { keyPath: 'chatId' });
        }
      }
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains('checkpoints')) {
          const store = db.createObjectStore('checkpoints', { keyPath: 'id' });
          store.createIndex('chatId', 'chatId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

export async function getAll(db: IDBDatabase): Promise<ChatHistoryItem[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as ChatHistoryItem[]);
    request.onerror = () => reject(request.error);
  });
}

export async function setMessages(
  db: IDBDatabase,
  id: string,
  messages: Message[],
  urlId?: string,
  description?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');

    const request = store.put({
      id,
      messages,
      urlId,
      description,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getMessages(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return (await getMessagesById(db, id)) || (await getMessagesByUrlId(db, id));
}

export async function getMessagesByUrlId(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    const request = index.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function getMessagesById(db: IDBDatabase, id: string): Promise<ChatHistoryItem> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result as ChatHistoryItem);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteById(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots'], 'readwrite');
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');

    const deleteChatRequest = chatStore.delete(id);
    const deleteSnapshotRequest = snapshotStore.delete(id);

    let chatDeleted = false;
    let snapshotDeleted = false;

    const checkCompletion = () => {
      if (chatDeleted && snapshotDeleted) {
        resolve(undefined);
      }
    };

    deleteChatRequest.onsuccess = () => {
      chatDeleted = true;
      checkCompletion();
    };
    deleteChatRequest.onerror = () => reject(deleteChatRequest.error);

    deleteSnapshotRequest.onsuccess = () => {
      snapshotDeleted = true;
      checkCompletion();
    };

    deleteSnapshotRequest.onerror = (event) => {
      if ((event.target as IDBRequest).error?.name === 'NotFoundError') {
        snapshotDeleted = true;
        checkCompletion();
      } else {
        reject(deleteSnapshotRequest.error);
      }
    };

    transaction.oncomplete = () => {
      // This might resolve before checkCompletion if one operation finishes much faster
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getNextId(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAllKeys();

    request.onsuccess = () => {
      const highestId = request.result.reduce((cur, acc) => Math.max(+cur, +acc), 0);
      resolve(String(+highestId + 1));
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getUrlId(db: IDBDatabase, id: string): Promise<string> {
  const idList = await getUrlIds(db);

  if (!idList.includes(id)) {
    return id;
  } else {
    let i = 2;

    while (idList.includes(`${id}-${i}`)) {
      i++;
    }

    return `${id}-${i}`;
  }
}

async function getUrlIds(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const idList: string[] = [];

    const request = store.openCursor();

    request.onsuccess = (event: Event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        idList.push(cursor.value.urlId);
        cursor.continue();
      } else {
        resolve(idList);
      }
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Checkpoint functions
export async function saveCheckpoint(db: IDBDatabase, checkpoint: Checkpoint): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('checkpoints', 'readwrite');
    const store = transaction.objectStore('checkpoints');
    const request = store.put(checkpoint);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCheckpoints(db: IDBDatabase, chatId: string): Promise<Checkpoint[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('checkpoints', 'readonly');
    const store = transaction.objectStore('checkpoints');
    const index = store.index('chatId');
    const request = index.getAll(chatId);

    request.onsuccess = () => {
      const checkpoints = (request.result as Checkpoint[]).sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      resolve(checkpoints);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getCheckpoint(db: IDBDatabase, checkpointId: string): Promise<Checkpoint | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('checkpoints', 'readonly');
    const store = transaction.objectStore('checkpoints');
    const request = store.get(checkpointId);

    request.onsuccess = () => resolve(request.result as Checkpoint | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCheckpoint(db: IDBDatabase, checkpointId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('checkpoints', 'readwrite');
    const store = transaction.objectStore('checkpoints');
    const request = store.delete(checkpointId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCheckpointsByChatId(db: IDBDatabase, chatId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('checkpoints', 'readwrite');
    const store = transaction.objectStore('checkpoints');
    const index = store.index('chatId');
    const request = index.openCursor(IDBKeyRange.only(chatId));

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateChatDescription(
  db: IDBDatabase,
  id: string,
  newDescription: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    
    // First get the existing chat data
    const getRequest = store.get(id);
    
    getRequest.onsuccess = () => {
      const chatData = getRequest.result;
      if (!chatData) {
        reject(new Error('Chat not found'));
        return;
      }
      
      // Update the description and timestamp
      const updatedChat = {
        ...chatData,
        description: newDescription,
        timestamp: new Date().toISOString(),
      };
      
      // Save the updated chat
      const putRequest = store.put(updatedChat);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function updateChatDescriptionByUrlId(
  db: IDBDatabase,
  urlId: string,
  newDescription: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    const index = store.index('urlId');
    
    // First get the existing chat data by urlId
    const getRequest = index.get(urlId);
    
    getRequest.onsuccess = () => {
      const chatData = getRequest.result;
      if (!chatData) {
        reject(new Error('Chat not found'));
        return;
      }
      
      // Update the description and timestamp
      const updatedChat = {
        ...chatData,
        description: newDescription,
        timestamp: new Date().toISOString(),
      };
      
      // Save the updated chat
      const putRequest = store.put(updatedChat);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function exportAllChats(db: IDBDatabase): Promise<string> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots', 'checkpoints'], 'readonly');
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');
    const checkpointStore = transaction.objectStore('checkpoints');
    
    const exportData = {
      chats: [] as any[],
      snapshots: [] as any[],
      checkpoints: [] as any[],
      exportDate: new Date().toISOString(),
      version: '1.0',
    };
    
    let completed = 0;
    const total = 3;
    
    const checkCompletion = () => {
      completed++;
      if (completed === total) {
        resolve(JSON.stringify(exportData, null, 2));
      }
    };
    
    // Export chats
    const chatRequest = chatStore.getAll();
    chatRequest.onsuccess = () => {
      exportData.chats = chatRequest.result;
      checkCompletion();
    };
    chatRequest.onerror = () => reject(chatRequest.error);
    
    // Export snapshots
    const snapshotRequest = snapshotStore.getAll();
    snapshotRequest.onsuccess = () => {
      exportData.snapshots = snapshotRequest.result;
      checkCompletion();
    };
    snapshotRequest.onerror = () => reject(snapshotRequest.error);
    
    // Export checkpoints
    const checkpointRequest = checkpointStore.getAll();
    checkpointRequest.onsuccess = () => {
      exportData.checkpoints = checkpointRequest.result;
      checkCompletion();
    };
    checkpointRequest.onerror = () => reject(checkpointRequest.error);
  });
}

export async function deleteAllChats(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['chats', 'snapshots', 'checkpoints'], 'readwrite');
    const chatStore = transaction.objectStore('chats');
    const snapshotStore = transaction.objectStore('snapshots');
    const checkpointStore = transaction.objectStore('checkpoints');
    
    let completed = 0;
    const total = 3;
    
    const checkCompletion = () => {
      completed++;
      if (completed === total) {
        resolve();
      }
    };
    
    // Clear chats
    const clearChatsRequest = chatStore.clear();
    clearChatsRequest.onsuccess = () => checkCompletion();
    clearChatsRequest.onerror = () => reject(clearChatsRequest.error);
    
    // Clear snapshots
    const clearSnapshotsRequest = snapshotStore.clear();
    clearSnapshotsRequest.onsuccess = () => checkCompletion();
    clearSnapshotsRequest.onerror = () => reject(clearSnapshotsRequest.error);
    
    // Clear checkpoints
    const clearCheckpointsRequest = checkpointStore.clear();
    clearCheckpointsRequest.onsuccess = () => checkCompletion();
    clearCheckpointsRequest.onerror = () => reject(clearCheckpointsRequest.error);
  });
}
