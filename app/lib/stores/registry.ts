import { createScopedLogger } from '~/utils/logger';
import type { StoreRegistry as IStoreRegistry, StoreState } from './types';

const logger = createScopedLogger('StoreRegistry');

/**
 * Store metadata
 */
interface StoreMetadata {
  name: string;
  instance: any;
  createdAt: Date;
  lastAccessed: Date;
}

/**
 * Store Registry implementation for managing all stores
 */
export class StoreRegistry implements IStoreRegistry {
  private stores = new Map<string, StoreMetadata>();
  private eventListeners = new Map<string, Set<() => void>>();

  /**
   * Register a store with the registry
   */
  register<T extends StoreState>(name: string, store: T): void {
    if (this.stores.has(name)) {
      logger.warn(`Store '${name}' is already registered, overwriting`);
    }

    const metadata: StoreMetadata = {
      name,
      instance: store,
      createdAt: new Date(),
      lastAccessed: new Date(),
    };

    this.stores.set(name, metadata);
    this.emit('register', { name, store });

    logger.debug(`Store '${name}' registered`);
  }

  /**
   * Get a store from the registry
   */
  get<T extends StoreState>(name: string): T | undefined {
    const metadata = this.stores.get(name);
    
    if (metadata) {
      metadata.lastAccessed = new Date();
      return metadata.instance as T;
    }

    logger.debug(`Store '${name}' not found`);
    return undefined;
  }

  /**
   * Unregister a store from the registry
   */
  unregister(name: string): boolean {
    const metadata = this.stores.get(name);
    
    if (metadata) {
      // Call destroy method if it exists
      if (typeof metadata.instance.destroy === 'function') {
        try {
          metadata.instance.destroy();
        } catch (error) {
          logger.error(`Error destroying store '${name}':`, error);
        }
      }

      this.stores.delete(name);
      this.emit('unregister', { name });
      
      logger.debug(`Store '${name}' unregistered`);
      return true;
    }

    return false;
  }

  /**
   * List all registered store names
   */
  list(): string[] {
    return Array.from(this.stores.keys());
  }

  /**
   * Get all registered stores
   */
  getAll(): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [name, metadata] of this.stores) {
      result[name] = metadata.instance;
    }
    
    return result;
  }

  /**
   * Reset all stores
   */
  reset(): void {
    const storeNames = this.list();
    
    for (const name of storeNames) {
      const store = this.get(name);
      if (store && typeof store.reset === 'function') {
        try {
          store.reset();
        } catch (error) {
          logger.error(`Error resetting store '${name}':`, error);
        }
      }
    }

    this.emit('reset', { storeNames });
    logger.debug('All stores reset');
  }

  /**
   * Destroy all stores and clear the registry
   */
  destroy(): void {
    const storeNames = this.list();
    
    for (const name of storeNames) {
      this.unregister(name);
    }

    this.stores.clear();
    this.eventListeners.clear();
    
    logger.debug('Store registry destroyed');
  }

  /**
   * Get store metadata
   */
  getMetadata(name: string): StoreMetadata | undefined {
    return this.stores.get(name);
  }

  /**
   * Check if a store is registered
   */
  has(name: string): boolean {
    return this.stores.has(name);
  }

  /**
   * Get the number of registered stores
   */
  size(): number {
    return this.stores.size;
  }

  /**
   * Subscribe to registry events
   */
  on(event: string, callback: () => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.eventListeners.delete(event);
        }
      }
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback();
        } catch (error) {
          logger.error(`Error in event listener for '${event}':`, error);
        }
      });
    }
  }

  /**
   * Get store statistics
   */
  getStats(): {
    totalStores: number;
    storeNames: string[];
    oldestStore: string | null;
    mostAccessedStore: string | null;
  } {
    const storeNames = this.list();
    let oldestStore: string | null = null;
    let mostAccessedStore: string | null = null;
    let oldestTime = Date.now();
    let mostAccessedTime = 0;

    for (const [name, metadata] of this.stores) {
      if (metadata.createdAt.getTime() < oldestTime) {
        oldestTime = metadata.createdAt.getTime();
        oldestStore = name;
      }

      if (metadata.lastAccessed.getTime() > mostAccessedTime) {
        mostAccessedTime = metadata.lastAccessed.getTime();
        mostAccessedStore = name;
      }
    }

    return {
      totalStores: storeNames.length,
      storeNames,
      oldestStore,
      mostAccessedStore,
    };
  }
}

// Create and export the singleton instance
export const storeRegistry = new StoreRegistry();

// Export convenience methods
export const registerStore = (name: string, store: any) => storeRegistry.register(name, store);
export const getStore = <T>(name: string): T | undefined => storeRegistry.get<T>(name);
export const unregisterStore = (name: string) => storeRegistry.unregister(name);
export const listStores = () => storeRegistry.list();
export const resetAllStores = () => storeRegistry.reset();
export const destroyRegistry = () => storeRegistry.destroy(); 