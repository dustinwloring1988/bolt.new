import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('BaseStore');

/**
 * Base class for all stores providing common functionality
 */
export abstract class BaseStore {
  protected logger = createScopedLogger(this.constructor.name);

  /**
   * Create a persistent atom that survives hot reloads
   */
  protected createPersistentAtom<T>(key: string, defaultValue: T): WritableAtom<T> {
    return import.meta.hot?.data[key] ?? atom(defaultValue);
  }

  /**
   * Create a persistent map that survives hot reloads
   */
  protected createPersistentMap<T extends Record<string, any>>(key: string, defaultValue: T): MapStore<T> {
    return import.meta.hot?.data[key] ?? map(defaultValue);
  }

  /**
   * Save store state for hot reload persistence
   */
  protected persistForHotReload(key: string, value: any): void {
    if (import.meta.hot) {
      import.meta.hot.data[key] = value;
    }
  }

  /**
   * Get a value from localStorage with type safety
   */
  protected getFromStorage<T>(key: string, defaultValue: T): T {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch (error) {
      this.logger.warn(`Failed to parse stored value for ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Save a value to localStorage with error handling
   */
  protected saveToStorage<T>(key: string, value: T): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      this.logger.error(`Failed to save value for ${key}:`, error);
    }
  }

  /**
   * Remove a value from localStorage
   */
  protected removeFromStorage(key: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(key);
  }

  /**
   * Create a computed atom that depends on other atoms
   */
  protected createComputed<T>(dependencies: ReadableAtom<any>[], computeFn: (...values: any[]) => T): ReadableAtom<T> {
    // this is a simplified version - in practice you'd use nanostores' computed
    const result = atom(computeFn());

    // subscribe to all dependencies
    dependencies.forEach((dep) => {
      dep.subscribe(() => {
        const values = dependencies.map((d) => d.get());
        result.set(computeFn(...values));
      });
    });

    return result;
  }

  /**
   * Reset the store to its initial state
   */
  abstract reset(): void;

  /**
   * Initialize the store
   */
  abstract init(): void | Promise<void>;
}
