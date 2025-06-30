import { atom, map } from 'nanostores';

export interface DeploymentAlert {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  deploymentUrl?: string;
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
  provider: 'netlify' | 'vercel' | 'github-pages' | 'other';
  status?: 'deploying' | 'completed' | 'failed';
}

export const deploymentAlerts = map<Record<string, DeploymentAlert>>({});
export const showDeploymentAlerts = atom<boolean>(true);

export function addDeploymentAlert(alert: Omit<DeploymentAlert, 'id' | 'timestamp'>) {
  const id = `deployment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const newAlert: DeploymentAlert = {
    ...alert,
    id,
    timestamp: Date.now(),
  };

  deploymentAlerts.setKey(id, newAlert);

  // auto-remove alert after duration if specified
  if (alert.autoClose && alert.duration) {
    setTimeout(() => {
      removeDeploymentAlert(id);
    }, alert.duration);
  }

  return id;
}

export function removeDeploymentAlert(id: string) {
  const alerts = deploymentAlerts.get();
  const { [id]: removed, ...remaining } = alerts;
  deploymentAlerts.set(remaining);
}

export function updateDeploymentAlert(id: string, updates: Partial<DeploymentAlert>) {
  const alerts = deploymentAlerts.get();
  const alert = alerts[id];

  if (alert) {
    deploymentAlerts.setKey(id, { ...alert, ...updates });
  }
}

export function clearAllDeploymentAlerts() {
  deploymentAlerts.set({});
}

export function hideDeploymentAlerts() {
  showDeploymentAlerts.set(false);
}

export function showDeploymentAlertsPanel() {
  showDeploymentAlerts.set(true);
}

// helper functions for specific deployment scenarios
export function createDeploymentStartAlert(provider: DeploymentAlert['provider']) {
  return addDeploymentAlert({
    type: 'info',
    title: `Deploying to ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
    message: 'Your project is being deployed...',
    provider,
    status: 'deploying',
    autoClose: false,
  });
}

export function createDeploymentSuccessAlert(
  provider: DeploymentAlert['provider'],
  deploymentUrl: string,
  alertId?: string,
) {
  const alert = {
    type: 'success' as const,
    title: `Deployment Successful`,
    message: `Your project has been deployed successfully to ${provider.charAt(0).toUpperCase() + provider.slice(1)}`,
    deploymentUrl,
    provider,
    status: 'completed' as const,
    autoClose: false,
  };

  if (alertId) {
    updateDeploymentAlert(alertId, alert);
  } else {
    addDeploymentAlert(alert);
  }
}

export function createDeploymentErrorAlert(provider: DeploymentAlert['provider'], error: string, alertId?: string) {
  const alert = {
    type: 'error' as const,
    title: `Deployment Failed`,
    message: `Failed to deploy to ${provider.charAt(0).toUpperCase() + provider.slice(1)}: ${error}`,
    provider,
    status: 'failed' as const,
    autoClose: false,
  };

  if (alertId) {
    updateDeploymentAlert(alertId, alert);
  } else {
    addDeploymentAlert(alert);
  }
}
