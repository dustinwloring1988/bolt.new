import { map, type MapStore } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';
import { workbenchStore } from './workbench';

const logger = createScopedLogger('SettingsStore');

/**
 * Service tokens interface
 */
export interface ServiceTokens {
  netlify: string;
  vercel: string;
  github: string;
}

/**
 * Shortcut interface
 */
export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
}

/**
 * Shortcuts interface
 */
export interface Shortcuts {
  toggleTerminal: Shortcut;
}

/**
 * Settings state interface
 */
export interface SettingsState {
  serviceTokens: ServiceTokens;
  shortcuts: Shortcuts;
  lastUpdated: Date;
}

/**
 * Settings store configuration
 */
export interface SettingsStoreConfig {
  persistTokens?: boolean;
  storageKey?: string;
  autoSave?: boolean;
}

/**
 * Enhanced Settings Store with better organization and functionality
 */
export class SettingsStore {
  private readonly config: SettingsStoreConfig;
  private readonly storageKey: string;

  // Main store state
  public readonly state: MapStore<SettingsState>;

  // Shortcuts store (kept separate for backward compatibility)
  public readonly shortcutsStore: MapStore<Shortcuts>;

  constructor(config: SettingsStoreConfig = {}) {
    this.config = {
      persistTokens: true,
      storageKey: 'bolt_settings',
      autoSave: true,
      ...config,
    };

    this.storageKey = this.config.storageKey!;

    // Initialize shortcuts store
    this.shortcutsStore = map<Shortcuts>({
      toggleTerminal: {
        key: 'j',
        ctrlOrMetaKey: true,
        action: () => workbenchStore.toggleTerminal(),
      },
    });

    // Initialize main state
    this.state = map<SettingsState>({
      serviceTokens: {
        netlify: '',
        vercel: '',
        github: '',
      },
      shortcuts: this.shortcutsStore.get(),
      lastUpdated: new Date(),
    });

    this.init();
  }

  /**
   * Initialize the store
   */
  private init(): void {
    // Load saved settings
    if (this.config.persistTokens) {
      this.loadSettings();
    }

    // Subscribe to shortcuts changes
    this.shortcutsStore.subscribe((shortcuts) => {
      this.state.set({
        ...this.state.get(),
        shortcuts,
      });
    });

    // Auto-save on changes
    if (this.config.autoSave) {
      this.state.subscribe((newState) => {
        this.saveSettings(newState);
      });
    }

    logger.debug('SettingsStore initialized', { config: this.config });
  }

  /**
   * Update service tokens
   */
  public updateServiceTokens(tokens: Partial<ServiceTokens>): void {
    const currentState = this.state.get();
    
    this.state.set({
      ...currentState,
      serviceTokens: {
        ...currentState.serviceTokens,
        ...tokens,
      },
      lastUpdated: new Date(),
    });

    logger.debug('Service tokens updated', { tokens });
  }

  /**
   * Get a specific service token
   */
  public getServiceToken(service: keyof ServiceTokens): string {
    return this.state.get().serviceTokens[service];
  }

  /**
   * Get all service tokens
   */
  public getServiceTokens(): ServiceTokens {
    return this.state.get().serviceTokens;
  }

  /**
   * Update shortcuts
   */
  public updateShortcuts(shortcuts: Partial<Shortcuts>): void {
    this.shortcutsStore.set({
      ...this.shortcutsStore.get(),
      ...shortcuts,
    });
  }

  /**
   * Get current settings state
   */
  public getState(): SettingsState {
    return this.state.get();
  }

  /**
   * Reset settings to defaults
   */
  public reset(): void {
    const defaultState: SettingsState = {
      serviceTokens: {
        netlify: '',
        vercel: '',
        github: '',
      },
      shortcuts: {
        toggleTerminal: {
          key: 'j',
          ctrlOrMetaKey: true,
          action: () => workbenchStore.toggleTerminal(),
        },
      },
      lastUpdated: new Date(),
    };

    this.state.set(defaultState);
    this.shortcutsStore.set(defaultState.shortcuts);

    if (this.config.persistTokens) {
      this.clearSettings();
    }

    logger.debug('Settings reset to defaults');
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(state: SettingsState): void {
    if (typeof window === 'undefined') return;
    
    try {
      const dataToPersist = {
        serviceTokens: state.serviceTokens,
        shortcuts: state.shortcuts,
        lastUpdated: state.lastUpdated.toISOString(),
      };
      
      localStorage.setItem(this.storageKey, JSON.stringify(dataToPersist));
      logger.debug('Settings saved to storage');
    } catch (error) {
      logger.error('Failed to save settings:', error);
    }
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        const currentState = this.state.get();
        
        // Migrate from old format if needed
        const serviceTokens = this.migrateFromOldFormat(parsed);
        
        this.state.set({
          ...currentState,
          serviceTokens,
          shortcuts: parsed.shortcuts || currentState.shortcuts,
          lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date(),
        });
        
        // Update shortcuts store
        this.shortcutsStore.set(this.state.get().shortcuts);
        
        logger.debug('Settings loaded from storage');
      }
    } catch (error) {
      logger.error('Failed to load settings:', error);
    }
  }

  /**
   * Migrate from old localStorage format
   */
  private migrateFromOldFormat(parsed: any): ServiceTokens {
    // Check if we have the old individual token format
    const oldTokens = {
      netlify: localStorage.getItem('bolt_token_netlify') || '',
      vercel: localStorage.getItem('bolt_token_vercel') || '',
      github: localStorage.getItem('bolt_token_github') || '',
    };

    // If we have old tokens and no new format, use old tokens
    if (!parsed.serviceTokens && (oldTokens.netlify || oldTokens.vercel || oldTokens.github)) {
      logger.debug('Migrating from old token format');
      
      // Clean up old storage
      localStorage.removeItem('bolt_token_netlify');
      localStorage.removeItem('bolt_token_vercel');
      localStorage.removeItem('bolt_token_github');
      
      return oldTokens;
    }

    return parsed.serviceTokens || {
      netlify: '',
      vercel: '',
      github: '',
    };
  }

  /**
   * Clear stored settings
   */
  private clearSettings(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.storageKey);
    logger.debug('Settings cleared from storage');
  }

  /**
   * Export settings
   */
  public exportSettings(): string {
    const state = this.state.get();
    return JSON.stringify({
      serviceTokens: state.serviceTokens,
      shortcuts: state.shortcuts,
      lastUpdated: state.lastUpdated.toISOString(),
    }, null, 2);
  }

  /**
   * Import settings
   */
  public importSettings(settingsJson: string): boolean {
    try {
      const parsed = JSON.parse(settingsJson);
      const currentState = this.state.get();
      
      this.state.set({
        ...currentState,
        serviceTokens: parsed.serviceTokens || currentState.serviceTokens,
        shortcuts: parsed.shortcuts || currentState.shortcuts,
        lastUpdated: new Date(),
      });
      
      // Update shortcuts store
      this.shortcutsStore.set(this.state.get().shortcuts);
      
      logger.debug('Settings imported successfully');
      return true;
    } catch (error) {
      logger.error('Failed to import settings:', error);
      return false;
    }
  }
}

// Create and export the singleton instance
export const settingsStore = new SettingsStore({
  persistTokens: true,
  autoSave: true,
});

// Export the state for backward compatibility
export const settingsState = settingsStore.state;

// Export convenience methods for backward compatibility
export const updateServiceTokens = (tokens: Partial<ServiceTokens>) => settingsStore.updateServiceTokens(tokens);
export const getServiceToken = (service: keyof ServiceTokens) => settingsStore.getServiceToken(service);
export const getServiceTokens = () => settingsStore.getServiceTokens();
export const updateShortcuts = (shortcuts: Partial<Shortcuts>) => settingsStore.updateShortcuts(shortcuts);
export const reset = () => settingsStore.reset();
export const exportSettings = () => settingsStore.exportSettings();
export const importSettings = (settingsJson: string) => settingsStore.importSettings(settingsJson);

// Legacy exports for backward compatibility
export const shortcutsStore = settingsStore.shortcutsStore;
