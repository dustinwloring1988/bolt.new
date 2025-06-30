import { atom, type WritableAtom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ThemeStore');

/**
 * Theme types
 */
export type Theme = 'dark' | 'light' | 'auto';

/**
 * Theme store state interface
 */
export interface ThemeState {
  current: Theme;
  systemPreference: Theme;
  isDark: boolean;
  lastUpdated: Date;
}

/**
 * Theme store configuration
 */
export interface ThemeStoreConfig {
  defaultTheme?: Theme;
  persistTheme?: boolean;
  storageKey?: string;
  detectSystemPreference?: boolean;
}

/**
 * Enhanced Theme Store with better organization and functionality
 */
export class ThemeStore {
  private readonly config: ThemeStoreConfig;
  private readonly storageKey: string;
  private mediaQuery?: MediaQueryList;

  // Main store state
  public readonly state: WritableAtom<ThemeState>;

  constructor(config: ThemeStoreConfig = {}) {
    this.config = {
      defaultTheme: 'light',
      persistTheme: true,
      storageKey: 'bolt_theme',
      detectSystemPreference: true,
      ...config,
    };

    this.storageKey = this.config.storageKey!;

    // Initialize state
    this.state = atom<ThemeState>({
      current: this.config.defaultTheme!,
      systemPreference: 'light',
      isDark: false,
      lastUpdated: new Date(),
    });

    this.init();
  }

  /**
   * Initialize the store
   */
  private init(): void {
    // Detect system preference
    if (this.config.detectSystemPreference) {
      this.detectSystemPreference();
    }

    // Restore theme from storage
    if (this.config.persistTheme) {
      this.restoreTheme();
    }

    // Set up system preference listener
    this.setupSystemPreferenceListener();

    // Apply initial theme
    this.applyTheme(this.state.get().current);

    logger.debug('ThemeStore initialized', { config: this.config });
  }

  /**
   * Detect system color scheme preference
   */
  private detectSystemPreference(): void {
    if (typeof window === 'undefined') return;

    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const systemPreference: Theme = this.mediaQuery.matches ? 'dark' : 'light';

    this.state.set({
      ...this.state.get(),
      systemPreference,
    });

    logger.debug('System preference detected', { systemPreference });
  }

  /**
   * Set up listener for system preference changes
   */
  private setupSystemPreferenceListener(): void {
    if (!this.mediaQuery || typeof window === 'undefined') return;

    this.mediaQuery.addEventListener('change', (event) => {
      const systemPreference: Theme = event.matches ? 'dark' : 'light';
      
      this.state.set({
        ...this.state.get(),
        systemPreference,
      });

      // If current theme is 'auto', apply the new system preference
      if (this.state.get().current === 'auto') {
        this.applyTheme('auto');
      }

      logger.debug('System preference changed', { systemPreference });
    });
  }

  /**
   * Set the current theme
   */
  public setTheme(theme: Theme): void {
    const currentState = this.state.get();
    
    this.state.set({
      ...currentState,
      current: theme,
      lastUpdated: new Date(),
    });

    this.applyTheme(theme);

    if (this.config.persistTheme) {
      this.persistTheme(theme);
    }

    logger.debug('Theme set', { theme });
  }

  /**
   * Toggle between light and dark themes
   */
  public toggleTheme(): void {
    const currentState = this.state.get();
    const newTheme: Theme = currentState.current === 'dark' ? 'light' : 'dark';
    
    this.setTheme(newTheme);
  }

  /**
   * Get the effective theme (resolves 'auto' to actual theme)
   */
  public getEffectiveTheme(): 'light' | 'dark' {
    const state = this.state.get();
    if (state.current === 'auto') {
      // Ensure systemPreference is not 'auto', fallback to 'light' if it is
      return state.systemPreference === 'dark' ? 'dark' : 'light';
    }
    return state.current === 'dark' ? 'dark' : 'light';
  }

  /**
   * Check if the current theme is dark
   */
  public isDark(): boolean {
    return this.getEffectiveTheme() === 'dark';
  }

  /**
   * Check if the current theme is light
   */
  public isLight(): boolean {
    return this.getEffectiveTheme() === 'light';
  }

  /**
   * Check if the theme is set to auto
   */
  public isAuto(): boolean {
    return this.state.get().current === 'auto';
  }

  /**
   * Get the current theme state
   */
  public getState(): ThemeState {
    return this.state.get();
  }

  /**
   * Reset theme to default
   */
  public reset(): void {
    this.setTheme(this.config.defaultTheme!);
  }

  /**
   * Apply theme to the DOM
   */
  private applyTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;

    const effectiveTheme = theme === 'auto' ? this.state.get().systemPreference : theme;
    const isDark = effectiveTheme === 'dark';

    // Update HTML data attribute
    const html = document.querySelector('html');
    if (html) {
      html.setAttribute('data-theme', effectiveTheme);
    }

    // Update state
    this.state.set({
      ...this.state.get(),
      isDark,
    });

    logger.debug('Theme applied to DOM', { theme, effectiveTheme, isDark });
  }

  /**
   * Persist theme to localStorage
   */
  private persistTheme(theme: Theme): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.storageKey, theme);
    } catch (error) {
      logger.error('Failed to persist theme:', error);
    }
  }

  /**
   * Restore theme from localStorage
   */
  private restoreTheme(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem(this.storageKey) as Theme | null;
      if (stored && ['light', 'dark', 'auto'].includes(stored)) {
        this.setTheme(stored);
        logger.debug('Theme restored from storage', { theme: stored });
      }
    } catch (error) {
      logger.error('Failed to restore theme:', error);
    }
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener('change', () => {});
    }
  }
}

// Create and export the singleton instance
export const themeStore = new ThemeStore({
  defaultTheme: 'light',
  persistTheme: true,
  detectSystemPreference: true,
});

// Export the state for backward compatibility
export const themeState = themeStore.state;

// Export convenience methods for backward compatibility
export const setTheme = (theme: Theme) => themeStore.setTheme(theme);
export const toggleTheme = () => themeStore.toggleTheme();
export const getEffectiveTheme = () => themeStore.getEffectiveTheme();
export const isDark = () => themeStore.isDark();
export const isLight = () => themeStore.isLight();
export const isAuto = () => themeStore.isAuto();
export const reset = () => themeStore.reset();

// Legacy exports for backward compatibility
export const kTheme = 'bolt_theme';
export const DEFAULT_THEME = 'light';

export function themeIsDark() {
  return themeStore.isDark();
}
