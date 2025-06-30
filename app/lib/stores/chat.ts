import { map, type MapStore } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ChatStore');

/**
 * Chat store state interface
 */
export interface ChatState {
  started: boolean;
  aborted: boolean;
  showChat: boolean;
  isStreaming: boolean;
  lastMessageId?: string;
  messageCount: number;
  sessionStartTime?: Date;
}

/**
 * Chat store actions interface
 */
export interface ChatActions {
  startChat(): void;
  stopChat(): void;
  abortChat(): void;
  toggleChat(): void;
  setStreaming(isStreaming: boolean): void;
  addMessage(messageId: string): void;
  reset(): void;
}

/**
 * Chat store configuration
 */
export interface ChatStoreConfig {
  autoStart?: boolean;
  persistState?: boolean;
  maxMessages?: number;
}

/**
 * Enhanced Chat Store with better organization and functionality
 */
export class ChatStore {
  private readonly config: ChatStoreConfig;
  private readonly storageKey = 'bolt_chat_state';

  // Main store state
  readonly state: MapStore<ChatState> = map<ChatState>({
    started: false,
    aborted: false,
    showChat: true,
    isStreaming: false,
    messageCount: 0,
  });

  constructor(config: ChatStoreConfig = {}) {
    this.config = {
      autoStart: false,
      persistState: true,
      maxMessages: 1000,
      ...config,
    };

    this.init();
  }

  /**
   * Initialize the store
   */
  private init(): void {
    if (this.config.persistState) {
      this.restoreState();
    }

    if (this.config.autoStart) {
      this.startChat();
    }

    // Subscribe to state changes for persistence
    this.state.subscribe((newState) => {
      if (this.config.persistState) {
        this.persistState(newState);
      }
    });

    logger.debug('ChatStore initialized', { config: this.config });
  }

  /**
   * Start a new chat session
   */
  startChat(): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      started: true,
      aborted: false,
      sessionStartTime: new Date(),
      messageCount: 0,
    });

    logger.debug('Chat started');
  }

  /**
   * Stop the current chat session
   */
  stopChat(): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      started: false,
      isStreaming: false,
    });

    logger.debug('Chat stopped');
  }

  /**
   * Abort the current chat session
   */
  abortChat(): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      aborted: true,
      isStreaming: false,
    });

    logger.debug('Chat aborted');
  }

  /**
   * Toggle chat visibility
   */
  toggleChat(): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      showChat: !currentState.showChat,
    });

    logger.debug('Chat visibility toggled', { showChat: !currentState.showChat });
  }

  /**
   * Set streaming state
   */
  setStreaming(isStreaming: boolean): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      isStreaming,
    });

    logger.debug('Streaming state updated', { isStreaming });
  }

  /**
   * Add a message to the chat
   */
  addMessage(messageId: string): void {
    const currentState = this.state.get();

    this.state.set({
      ...currentState,
      lastMessageId: messageId,
      messageCount: currentState.messageCount + 1,
    });

    logger.debug('Message added', { messageId, count: currentState.messageCount + 1 });
  }

  /**
   * Reset the chat store to initial state
   */
  reset(): void {
    this.state.set({
      started: false,
      aborted: false,
      showChat: true,
      isStreaming: false,
      messageCount: 0,
    });

    if (this.config.persistState) {
      this.removeFromStorage();
    }

    logger.debug('Chat store reset');
  }

  /**
   * Get current chat state
   */
  getState(): ChatState {
    return this.state.get();
  }

  /**
   * Check if chat is active
   */
  isActive(): boolean {
    const state = this.state.get();
    return state.started && !state.aborted;
  }

  /**
   * Check if chat is streaming
   */
  isStreaming(): boolean {
    return this.state.get().isStreaming;
  }

  /**
   * Get chat session duration
   */
  getSessionDuration(): number | undefined {
    const state = this.state.get();

    if (!state.sessionStartTime) {
      return undefined;
    }

    return Date.now() - state.sessionStartTime.getTime();
  }

  /**
   * Persist state to localStorage
   */
  private persistState(state: ChatState): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const dataToPersist = {
        started: state.started,
        showChat: state.showChat,
        messageCount: state.messageCount,
        lastMessageId: state.lastMessageId,
      };

      localStorage.setItem(this.storageKey, JSON.stringify(dataToPersist));
    } catch (error) {
      logger.error('Failed to persist chat state:', error);
    }
  }

  /**
   * Restore state from localStorage
   */
  private restoreState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);

      if (stored) {
        const parsed = JSON.parse(stored);
        const currentState = this.state.get();

        this.state.set({
          ...currentState,
          started: parsed.started ?? false,
          showChat: parsed.showChat ?? true,
          messageCount: parsed.messageCount ?? 0,
          lastMessageId: parsed.lastMessageId,
        });

        logger.debug('Chat state restored from storage');
      }
    } catch (error) {
      logger.error('Failed to restore chat state:', error);
    }
  }

  /**
   * Remove stored state
   */
  private removeFromStorage(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(this.storageKey);
  }
}

// Create and export the singleton instance
export const chatStore = new ChatStore({
  persistState: true,
  autoStart: false,
});

// Export the state for backward compatibility
export const chatState = chatStore.state;

// Export convenience methods for backward compatibility
export const startChat = () => chatStore.startChat();
export const stopChat = () => chatStore.stopChat();
export const abortChat = () => chatStore.abortChat();
export const toggleChat = () => chatStore.toggleChat();
export const setStreaming = (isStreaming: boolean) => chatStore.setStreaming(isStreaming);
export const addMessage = (messageId: string) => chatStore.addMessage(messageId);
export const reset = () => chatStore.reset();
