# Store System Architecture

This directory contains a comprehensive store system for managing application state using nanostores. The system provides a structured approach to state management with features like middleware, validation, persistence, and debugging tools.

## Architecture Overview

### Core Components

1. **BaseStore** - Abstract base class providing common functionality
2. **StoreRegistry** - Central registry for managing all stores
3. **Middleware System** - Cross-cutting concerns like logging, validation, and caching
4. **Utilities** - Helper functions for validation, migration, and debugging

### Store Types

- **ChatStore** - Manages chat state and interactions
- **ThemeStore** - Handles theme switching and system preferences
- **WorkbenchStore** - Manages the development workbench
- **FilesStore** - Handles file system operations
- **EditorStore** - Manages code editor state
- **TerminalStore** - Manages terminal state
- **SettingsStore** - Application settings and shortcuts

## Usage Examples

### Basic Store Usage

```typescript
import { chatStore, themeStore } from '~/lib/stores';

// Access store state
const chatState = chatStore.getState();
const isDark = themeStore.isDark();

// Perform actions
chatStore.startChat();
themeStore.toggleTheme();
```

### Creating a Custom Store

```typescript
import { BaseStore } from '~/lib/stores';
import { map, type MapStore } from 'nanostores';

interface UserState {
  id: string;
  name: string;
  email: string;
  isAuthenticated: boolean;
}

export class UserStore extends BaseStore {
  public readonly state: MapStore<UserState> = map({
    id: '',
    name: '',
    email: '',
    isAuthenticated: false,
  });

  constructor() {
    super();
    this.init();
  }

  async init(): Promise<void> {
    // Initialize store
    this.restoreFromStorage();
  }

  reset(): void {
    this.state.set({
      id: '',
      name: '',
      email: '',
      isAuthenticated: false,
    });
  }

  login(userData: Omit<UserState, 'isAuthenticated'>): void {
    this.state.set({
      ...userData,
      isAuthenticated: true,
    });
    this.persistToStorage();
  }

  logout(): void {
    this.reset();
    this.clearStorage();
  }

  private persistToStorage(): void {
    this.saveToStorage('user_state', this.state.get());
  }

  private restoreFromStorage(): void {
    const stored = this.getFromStorage('user_state', this.state.get());
    this.state.set(stored);
  }

  private clearStorage(): void {
    this.removeFromStorage('user_state');
  }
}
```

### Using Middleware

```typescript
import { 
  createLoggingMiddleware, 
  createValidationMiddleware,
  composeMiddleware 
} from '~/lib/stores';

// Create validation schema
const userValidationSchema = {
  name: { type: 'string', required: true },
  email: { type: 'string', required: true, validator: (email: string) => email.includes('@') },
  age: { type: 'number', required: false },
};

// Create middleware stack
const userMiddleware = composeMiddleware(
  createLoggingMiddleware(),
  createValidationMiddleware((data) => validateStoreData(data, userValidationSchema))
);

// Apply middleware to store actions
const validatedLogin = userMiddleware(userStore.login.bind(userStore), {
  storeName: 'user',
  actionName: 'login',
  timestamp: new Date(),
});
```

### Store Registry Usage

```typescript
import { storeRegistry, registerStore, getStore } from '~/lib/stores';

// Register a store
const userStore = new UserStore();
registerStore('user', userStore);

// Get a store
const retrievedStore = getStore<UserStore>('user');

// List all stores
const storeNames = storeRegistry.list();

// Get store statistics
const stats = storeRegistry.getStats();
```

### Persistence and Migration

```typescript
import { createStorePersistence, migrateStoreData } from '~/lib/stores';

// Create persistence helper
const userPersistence = createStorePersistence<UserState>('user');

// Save state
userPersistence.save(userStore.getState());

// Load state
const savedState = userPersistence.load();
if (savedState) {
  userStore.state.set(savedState);
}

// Migrate data
const migration = (oldData: any) => ({
  ...oldData,
  // Add new fields or transform existing ones
  createdAt: oldData.createdAt || new Date().toISOString(),
});

const { data: migratedData } = migrateStoreData(oldData, migration, '2.0.0');
```

### Debugging and Performance

```typescript
import { 
  createStoreDebugger, 
  createStorePerformanceMonitor 
} from '~/lib/stores';

// Create debugger
const userDebugger = createStoreDebugger(
  'user',
  () => userStore.getState(),
  (state) => userStore.state.set(state)
);

// Log actions
userDebugger.logAction('login', userStore.getState());

// Time travel
userDebugger.timeTravel(0); // Go back to first action

// Performance monitoring
const performanceMonitor = createStorePerformanceMonitor();
const stopTimer = performanceMonitor.startTimer('user');

// ... perform action ...

stopTimer();
const metrics = performanceMonitor.getMetrics('user');
```

## Best Practices

### 1. Store Design

- Keep stores focused on a single domain
- Use TypeScript interfaces for state definitions
- Implement proper initialization and cleanup
- Provide clear action methods

### 2. State Management

- Use immutable updates
- Avoid deeply nested state
- Normalize data when possible
- Use computed values for derived state

### 3. Performance

- Use middleware for cross-cutting concerns
- Implement proper cleanup in destroy methods
- Monitor store performance
- Use debouncing for frequent updates

### 4. Testing

- Test store actions in isolation
- Mock dependencies
- Test state transitions
- Validate store contracts

### 5. Error Handling

- Use middleware for error handling
- Provide meaningful error messages
- Implement retry logic where appropriate
- Log errors for debugging

## Migration Guide

### From Old Store Pattern

**Before:**
```typescript
export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,
});
```

**After:**
```typescript
export class ChatStore extends BaseStore {
  public readonly state: MapStore<ChatState> = map({
    started: false,
    aborted: false,
    showChat: true,
  });

  startChat(): void {
    this.state.set({ ...this.state.get(), started: true });
  }

  // ... other methods
}
```

### Benefits of New Architecture

1. **Better Organization** - Clear separation of concerns
2. **Type Safety** - Full TypeScript support
3. **Middleware** - Cross-cutting concerns
4. **Persistence** - Built-in storage management
5. **Debugging** - Time travel and performance monitoring
6. **Testing** - Easier to test and mock
7. **Scalability** - Registry and composition patterns

## API Reference

### BaseStore

- `createPersistentAtom<T>()` - Create persistent atom
- `createPersistentMap<T>()` - Create persistent map
- `getFromStorage<T>()` - Get value from localStorage
- `saveToStorage<T>()` - Save value to localStorage
- `removeFromStorage()` - Remove value from localStorage

### StoreRegistry

- `register<T>()` - Register a store
- `get<T>()` - Get a store by name
- `unregister()` - Unregister a store
- `list()` - List all store names
- `reset()` - Reset all stores
- `getStats()` - Get store statistics

### Middleware

- `createLoggingMiddleware()` - Log store actions
- `createValidationMiddleware()` - Validate action data
- `createPerformanceMiddleware()` - Monitor performance
- `createErrorHandlingMiddleware()` - Handle errors
- `createRetryMiddleware()` - Retry failed actions
- `createCachingMiddleware()` - Cache action results
- `createDebounceMiddleware()` - Debounce actions

### Utilities

- `validateStoreData()` - Validate against schema
- `migrateStoreData()` - Migrate store data
- `cloneStoreData()` - Deep clone data
- `diffStoreStates()` - Compare states
- `createStorePersistence()` - Persistence helper
- `createStoreDebugger()` - Debugging tools
- `createStorePerformanceMonitor()` - Performance monitoring 