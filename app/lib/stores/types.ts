import type { MapStore, ReadableAtom, WritableAtom } from 'nanostores';

/**
 * Base interface for all store states
 */
export interface StoreState {
  [key: string]: any;
}

/**
 * Interface for stores that can be reset
 */
export interface ResettableStore {
  reset(): void;
}

/**
 * Interface for stores that can be initialized
 */
export interface InitializableStore {
  init(): void | Promise<void>;
}

/**
 * Interface for stores that can be persisted
 */
export interface PersistableStore {
  persist(): void;
  restore(): void;
}

/**
 * Interface for stores with computed values
 */
export interface ComputedStore {
  getComputed<T>(key: string): ReadableAtom<T> | undefined;
}

/**
 * Store configuration options
 */
export interface StoreConfig {
  name: string;
  persist?: boolean;
  storageKey?: string;
  hotReload?: boolean;
}

/**
 * Store metadata
 */
export interface StoreMetadata {
  name: string;
  version: string;
  createdAt: Date;
  lastModified: Date;
}

/**
 * Store subscription options
 */
export interface StoreSubscriptionOptions {
  immediate?: boolean;
  once?: boolean;
}

/**
 * Store action context
 */
export interface StoreActionContext {
  storeName: string;
  actionName: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Store action result
 */
export interface StoreActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: Error;
  context: StoreActionContext;
}

/**
 * Store action handler
 */
export type StoreActionHandler<T = any, R = any> = (
  data: T,
  context: StoreActionContext,
) => StoreActionResult<R> | Promise<StoreActionResult<R>>;

/**
 * Store middleware
 */
export type StoreMiddleware<T = any> = (
  action: StoreActionHandler<T>,
  context: StoreActionContext,
) => StoreActionHandler<T>;

/**
 * Store event types
 */
export type StoreEventType = 'init' | 'reset' | 'update' | 'persist' | 'restore' | 'error';

/**
 * Store event
 */
export interface StoreEvent<T = any> {
  type: StoreEventType;
  storeName: string;
  data?: T;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Store event handler
 */
export type StoreEventHandler<T = any> = (event: StoreEvent<T>) => void;

/**
 * Store event emitter
 */
export interface StoreEventEmitter {
  on<T = any>(eventType: StoreEventType, handler: StoreEventHandler<T>): () => void;
  emit<T = any>(event: StoreEvent<T>): void;
  off(eventType: StoreEventType, handler: StoreEventHandler): void;
}

/**
 * Store registry for managing multiple stores
 */
export interface StoreRegistry {
  register<T extends StoreState>(name: string, store: T): void;
  get<T extends StoreState>(name: string): T | undefined;
  unregister(name: string): boolean;
  list(): string[];
  reset(): void;
}

/**
 * Store validation schema
 */
export interface StoreValidationSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    default?: any;
    validator?: (value: any) => boolean;
  };
}

/**
 * Store validation result
 */
export interface StoreValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Store migration function
 */
export type StoreMigration<T = any> = (oldData: any) => T;

/**
 * Store migration config
 */
export interface StoreMigrationConfig {
  version: string;
  migrate: StoreMigration;
  rollback?: StoreMigration;
}

/**
 * Store performance metrics
 */
export interface StorePerformanceMetrics {
  initTime: number;
  updateCount: number;
  lastUpdateTime: number;
  averageUpdateTime: number;
  memoryUsage?: number;
}
