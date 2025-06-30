/**
 * Storage utility that provides a unified interface for storing data
 * Prioritizes IndexedDB but falls back to localStorage when needed
 */

interface StorageUtility {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class IndexedDBStorage implements StorageUtility {
  private dbName = 'boltStorage';
  private storeName = 'keyValue';
  private version = 1;

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      throw error;
    }
  }
}

class LocalStorageWrapper implements StorageUtility {
  async getItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      throw error;
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw error;
    }
  }
}

class MigrationStorage implements StorageUtility {
  private indexedDBStorage: IndexedDBStorage;
  private localStorageWrapper: LocalStorageWrapper;
  private preferIndexedDB: boolean;

  constructor() {
    this.indexedDBStorage = new IndexedDBStorage();
    this.localStorageWrapper = new LocalStorageWrapper();
    this.preferIndexedDB = typeof indexedDB !== 'undefined';
  }

  async getItem(key: string): Promise<string | null> {
    if (this.preferIndexedDB) {
      try {
        const value = await this.indexedDBStorage.getItem(key);

        if (value !== null) {
          return value;
        }

        // check localStorage as fallback and migrate if found
        const localValue = await this.localStorageWrapper.getItem(key);

        if (localValue !== null) {
          await this.indexedDBStorage.setItem(key, localValue);
          await this.localStorageWrapper.removeItem(key);

          return localValue;
        }

        return null;
      } catch {
        return this.localStorageWrapper.getItem(key);
      }
    } else {
      return this.localStorageWrapper.getItem(key);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.preferIndexedDB) {
      try {
        await this.indexedDBStorage.setItem(key, value);
        // remove from localStorage if it exists
        await this.localStorageWrapper.removeItem(key);
      } catch {
        await this.localStorageWrapper.setItem(key, value);
      }
    } else {
      await this.localStorageWrapper.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (this.preferIndexedDB) {
      try {
        await this.indexedDBStorage.removeItem(key);
      } catch {
        // fallback to localStorage
      }
    }

    // always try to remove from localStorage as well
    await this.localStorageWrapper.removeItem(key);
  }
}

export function createStorageUtility(): StorageUtility {
  return new MigrationStorage();
}

// legacy sync functions for backward compatibility
export function getItemSync(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setItemSync(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function removeItemSync(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
