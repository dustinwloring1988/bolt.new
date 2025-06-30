import type {
  StoreValidationSchema,
  StoreValidationResult,
  StoreMigration,
  StoreMigrationConfig,
  StorePerformanceMetrics,
} from './types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('StoreUtils');

/**
 * Validate store data against a schema
 */
export function validateStoreData<T extends Record<string, any>>(
  data: T,
  schema: StoreValidationSchema,
): StoreValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, fieldSchema] of Object.entries(schema)) {
    const value = data[key];

    // check if required field is missing
    if (fieldSchema.required && value === undefined) {
      errors.push(`Required field '${key}' is missing`);
      continue;
    }

    // skip validation if value is undefined and not required
    if (value === undefined) {
      continue;
    }

    // check type
    const actualType = Array.isArray(value) ? 'array' : typeof value;

    if (actualType !== fieldSchema.type) {
      errors.push(`Field '${key}' should be of type '${fieldSchema.type}', got '${actualType}'`);
    }

    // run custom validator if provided
    if (fieldSchema.validator && !fieldSchema.validator(value)) {
      errors.push(`Field '${key}' failed custom validation`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Migrate store data using a migration function
 */
export function migrateStoreData<T>(
  data: any,
  migration: StoreMigration<T>,
  version: string,
): { data: T; version: string } {
  try {
    const migratedData = migration(data);

    logger.debug(`Store data migrated successfully`, {
      fromVersion: 'unknown',
      toVersion: version,
    });

    return {
      data: migratedData,
      version,
    };
  } catch (error) {
    logger.error(`Store data migration failed`, {
      version,
      error,
    });

    throw new Error(`Migration to version ${version} failed: ${error}`);
  }
}

/**
 * Create a migration chain for multiple versions
 */
export function createMigrationChain<T>(migrations: StoreMigrationConfig[]): StoreMigration<T> {
  return (data: any) => {
    let currentData = data;

    for (const migration of migrations) {
      try {
        currentData = migration.migrate(currentData);
        logger.debug(`Applied migration`, { version: migration.version });
      } catch (error) {
        logger.error(`Migration failed`, { version: migration.version, error });
        throw error;
      }
    }

    return currentData as T;
  };
}

/**
 * Deep clone store data
 */
export function cloneStoreData<T>(data: T): T {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => cloneStoreData(item)) as T;
  }

  const cloned: any = {};

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      cloned[key] = cloneStoreData(data[key]);
    }
  }

  return cloned;
}

/**
 * Compare two store states and return differences
 */
export function diffStoreStates<T extends Record<string, any>>(
  oldState: T,
  newState: T,
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  // find added and changed keys
  for (const key in newState) {
    if (!(key in oldState)) {
      added.push(key);
    } else if (JSON.stringify(oldState[key]) !== JSON.stringify(newState[key])) {
      changed.push(key);
    }
  }

  // find removed keys
  for (const key in oldState) {
    if (!(key in newState)) {
      removed.push(key);
    }
  }

  return { added, removed, changed };
}

/**
 * Create a performance monitor for stores
 */
export function createStorePerformanceMonitor() {
  const metrics = new Map<string, StorePerformanceMetrics>();

  return {
    startTimer(storeName: string): () => void {
      const startTime = Date.now();

      return () => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        const existing = metrics.get(storeName) || {
          initTime: 0,
          updateCount: 0,
          lastUpdateTime: 0,
          averageUpdateTime: 0,
        };

        const newMetrics: StorePerformanceMetrics = {
          ...existing,
          updateCount: existing.updateCount + 1,
          lastUpdateTime: endTime,
          averageUpdateTime:
            (existing.averageUpdateTime * existing.updateCount + duration) / (existing.updateCount + 1),
        };

        metrics.set(storeName, newMetrics);
      };
    },

    getMetrics(storeName?: string): StorePerformanceMetrics | Record<string, StorePerformanceMetrics> {
      if (storeName) {
        return (
          metrics.get(storeName) || {
            initTime: 0,
            updateCount: 0,
            lastUpdateTime: 0,
            averageUpdateTime: 0,
          }
        );
      }

      return Object.fromEntries(metrics);
    },

    reset(): void {
      metrics.clear();
    },
  };
}

/**
 * Create a store debugger
 */
export function createStoreDebugger<T extends Record<string, any>>(
  storeName: string,
  getState: () => T,
  setState: (state: T) => void,
) {
  const history: Array<{ timestamp: number; state: T; action?: string }> = [];
  const maxHistory = 100;

  return {
    logAction(action: string, state?: T): void {
      const currentState = state || getState();
      history.push({
        timestamp: Date.now(),
        state: cloneStoreData(currentState),
        action,
      });

      if (history.length > maxHistory) {
        history.shift();
      }

      logger.debug(`Store action logged`, {
        store: storeName,
        action,
        historyLength: history.length,
      });
    },

    getHistory(): Array<{ timestamp: number; state: T; action?: string }> {
      return history.map((item) => ({
        ...item,
        state: cloneStoreData(item.state),
      }));
    },

    timeTravel(index: number): boolean {
      if (index < 0 || index >= history.length) {
        logger.warn(`Invalid history index`, { index, historyLength: history.length });
        return false;
      }

      const targetState = history[index].state;
      setState(cloneStoreData(targetState));

      logger.debug(`Store time travel executed`, {
        store: storeName,
        targetIndex: index,
        targetAction: history[index].action,
      });

      return true;
    },

    reset(): void {
      history.length = 0;
    },
  };
}

/**
 * Create a store persistence helper
 */
export function createStorePersistence<T>(storeName: string, storageKey?: string) {
  const key = storageKey || `store_${storeName}`;

  return {
    save(data: T): void {
      try {
        const serialized = JSON.stringify(data);
        localStorage.setItem(key, serialized);

        logger.debug(`Store data persisted`, {
          store: storeName,
          key,
          dataSize: serialized.length,
        });
      } catch (error) {
        logger.error(`Failed to persist store data`, {
          store: storeName,
          key,
          error,
        });
      }
    },

    load(): T | null {
      try {
        const serialized = localStorage.getItem(key);

        if (!serialized) {
          return null;
        }

        const data = JSON.parse(serialized);

        logger.debug(`Store data loaded`, {
          store: storeName,
          key,
          dataSize: serialized.length,
        });

        return data;
      } catch (error) {
        logger.error(`Failed to load store data`, {
          store: storeName,
          key,
          error,
        });
        return null;
      }
    },

    clear(): void {
      try {
        localStorage.removeItem(key);

        logger.debug(`Store data cleared`, {
          store: storeName,
          key,
        });
      } catch (error) {
        logger.error(`Failed to clear store data`, {
          store: storeName,
          key,
          error,
        });
      }
    },

    exists(): boolean {
      return localStorage.getItem(key) !== null;
    },
  };
}

/**
 * Create a store subscription helper
 */
export function createStoreSubscription<T>(
  store: { subscribe: (callback: (value: T) => void) => () => void },
  callback: (value: T) => void,
  options: { immediate?: boolean; once?: boolean } = {},
) {
  let unsubscribe: (() => void) | undefined;
  let hasRun = false;

  const wrappedCallback = (value: T) => {
    callback(value);

    if (options.once) {
      hasRun = true;

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
    }
  };

  unsubscribe = store.subscribe(wrappedCallback);

  if (options.immediate) {
    /*
     * Note: This assumes the store has a get() method
     * You might need to adjust this based on your store implementation
     */
    try {
      const currentValue = (store as any).get();

      if (currentValue !== undefined) {
        wrappedCallback(currentValue);
      }
    } catch (error) {
      logger.warn(`Failed to get initial store value`, { error });
    }
  }

  return {
    unsubscribe: () => {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = undefined;
      }
    },
    hasRun,
  };
}
