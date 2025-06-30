// Export all store types and interfaces
export * from './types';

// Export base store class
export * from './base/BaseStore';

// Export store registry with explicit re-export to avoid conflicts
export {
  StoreRegistry as StoreRegistryImpl,
  storeRegistry,
  registerStore,
  getStore,
  unregisterStore,
  listStores,
  resetAllStores as resetRegistry,
  destroyRegistry,
} from './registry';

// Export middleware system
export * from './middleware';

// Export store utilities
export * from './utils';

// Export individual stores with explicit re-exports to avoid conflicts
export {
  ChatStore,
  chatStore,
  chatState,
  startChat,
  stopChat,
  abortChat,
  toggleChat,
  setStreaming,
  addMessage,
  reset as resetChat,
} from './chat';
export {
  ThemeStore,
  themeStore,
  themeState,
  setTheme,
  toggleTheme,
  getEffectiveTheme,
  isDark,
  isLight,
  isAuto,
  reset as resetTheme,
  kTheme,
  DEFAULT_THEME,
  themeIsDark,
} from './theme';
export {
  SettingsStore,
  settingsStore,
  settingsState,
  updateServiceTokens,
  getServiceToken,
  getServiceTokens,
  updateShortcuts,
  reset as resetSettings,
  exportSettings,
  importSettings,
  shortcutsStore,
} from './settings';
export { WorkbenchStore, workbenchStore } from './workbench';
export { FilesStore } from './files';
export { EditorStore } from './editor';
export { TerminalStore } from './terminal';
export { PreviewsStore } from './previews';
export { qrCodeStore } from './qrCode';
export {
  deploymentAlerts,
  showDeploymentAlerts,
  addDeploymentAlert,
  removeDeploymentAlert,
  updateDeploymentAlert,
  clearAllDeploymentAlerts,
  hideDeploymentAlerts,
  showDeploymentAlertsPanel,
  createDeploymentStartAlert,
  createDeploymentSuccessAlert,
  createDeploymentErrorAlert,
} from './deploymentAlerts';

// Re-export store instances for convenience
import { chatStore } from './chat';
import { storeRegistry } from './registry';
import { settingsStore } from './settings';
import { themeStore } from './theme';
import { workbenchStore } from './workbench';

// Register all stores with the registry
export function initializeStores() {
  storeRegistry.register('chat', chatStore);
  storeRegistry.register('theme', themeStore);
  storeRegistry.register('settings', settingsStore);
  storeRegistry.register('workbench', workbenchStore);
}

// Export a function to get all stores
export function getAllStores() {
  return {
    chat: chatStore,
    theme: themeStore,
    settings: settingsStore,
    workbench: workbenchStore,
  };
}

// Export store utilities
export function resetAllStores() {
  storeRegistry.reset();
}

export function destroyAllStores() {
  storeRegistry.destroy();
}

// Export store statistics
export function getStoreStats() {
  return storeRegistry.getStats();
}

// Auto-initialize stores when this module is imported
if (typeof window !== 'undefined') {
  initializeStores();
}
