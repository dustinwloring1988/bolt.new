import {
  updateDeploymentAlert,
  createDeploymentSuccessAlert,
  createDeploymentErrorAlert,
  type DeploymentAlert,
} from '~/lib/stores/deploymentAlerts';

export interface DeploymentStatusResponse {
  status: 'deploying' | 'ready' | 'error' | 'building' | 'queued';
  url?: string;
  error?: string;
  readyAt?: string;
}

export class DeploymentStatusService {
  private pollingIntervals = new Map<string, NodeJS.Timeout>();
  private readonly maxPollingDuration = 10 * 60 * 1000; // 10 minutes max polling
  private readonly pollingInterval = 5000; // 5 seconds

  /**
   * Start polling for deployment status
   */
  startPolling(
    alertId: string,
    provider: DeploymentAlert['provider'],
    deploymentId: string,
    checkStatusFn: (deploymentId: string) => Promise<DeploymentStatusResponse>,
  ) {
    // Clear any existing polling for this alert
    this.stopPolling(alertId);

    const startTime = Date.now();

    const pollStatus = async () => {
      try {
        // Check if we've exceeded max polling duration
        if (Date.now() - startTime > this.maxPollingDuration) {
          this.stopPolling(alertId);
          updateDeploymentAlert(alertId, {
            type: 'warning',
            title: 'Deployment Status Unknown',
            message: `Deployment monitoring timed out. Please check ${provider} dashboard for status.`,
            status: 'completed',
          });

          return;
        }

        const status = await checkStatusFn(deploymentId);

        switch (status.status) {
          case 'ready':
            this.stopPolling(alertId);

            if (status.url) {
              createDeploymentSuccessAlert(provider, status.url, alertId);
            } else {
              updateDeploymentAlert(alertId, {
                type: 'success',
                title: 'Deployment Completed',
                message: `Deployment to ${provider} completed successfully`,
                status: 'completed',
              });
            }

            break;

          case 'error':
            this.stopPolling(alertId);
            createDeploymentErrorAlert(provider, status.error || 'Deployment failed', alertId);
            break;

          case 'building':
          case 'deploying':
          case 'queued':
            // Update the alert with current status but continue polling
            updateDeploymentAlert(alertId, {
              message: `Deployment ${status.status}...`,
              status: 'deploying',
            });
            break;
        }
      } catch (error) {
        console.warn('Failed to check deployment status:', error);
        // Don't stop polling on fetch errors, just continue
      }
    };

    // Start polling
    const interval = setInterval(pollStatus, this.pollingInterval);
    this.pollingIntervals.set(alertId, interval);

    // Initial status check
    pollStatus();
  }

  /**
   * Stop polling for a specific deployment
   */
  stopPolling(alertId: string) {
    const interval = this.pollingIntervals.get(alertId);

    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(alertId);
    }
  }

  /**
   * Stop all active polling
   */
  stopAllPolling() {
    this.pollingIntervals.forEach((interval) => clearInterval(interval));
    this.pollingIntervals.clear();
  }

  /**
   * Get active polling count
   */
  getActivePollingCount() {
    return this.pollingIntervals.size;
  }
}

// Specific status checkers for different providers
export class NetlifyStatusChecker {
  constructor(private token: string) {}

  async checkStatus(deploymentId: string): Promise<DeploymentStatusResponse> {
    const response = await fetch(`https://api.netlify.com/api/v1/deployments/${deploymentId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check Netlify deployment status: ${response.statusText}`);
    }

    const data = await response.json();

    // Map Netlify status to our standard status
    const statusMap: Record<string, DeploymentStatusResponse['status']> = {
      new: 'queued',
      building: 'building',
      deploying: 'deploying',
      ready: 'ready',
      error: 'error',
      failed: 'error',
    };

    if (typeof data === 'object' && data !== null && 'state' in data) {
      return {
        status: statusMap[(data as any).state] || 'deploying',
        url: (data as any).state === 'ready' ? (data as any).ssl_url || (data as any).deploy_ssl_url : undefined,
        error:
          (data as any).state === 'error' || (data as any).state === 'failed' ? (data as any).error_message : undefined,
        readyAt: (data as any).published_at,
      };
    } else {
      throw new Error('Invalid response from Netlify');
    }
  }
}

export class VercelStatusChecker {
  constructor(private token: string) {}

  async checkStatus(deploymentId: string): Promise<DeploymentStatusResponse> {
    const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check Vercel deployment status: ${response.statusText}`);
    }

    const data = await response.json();

    // Map Vercel status to our standard status
    const statusMap: Record<string, DeploymentStatusResponse['status']> = {
      BUILDING: 'building',
      DEPLOYING: 'deploying',
      READY: 'ready',
      ERROR: 'error',
      CANCELED: 'error',
      QUEUED: 'queued',
    };

    if (typeof data === 'object' && data !== null && 'readyState' in data) {
      return {
        status: statusMap[(data as any).readyState] || 'deploying',
        url: (data as any).readyState === 'READY' ? `https://${(data as any).url}` : undefined,
        error: (data as any).readyState === 'ERROR' ? 'Deployment failed' : undefined,
        readyAt: (data as any).ready ? new Date((data as any).ready).toISOString() : undefined,
      };
    } else {
      throw new Error('Invalid response from Vercel');
    }
  }
}

// Singleton instance
export const deploymentStatusService = new DeploymentStatusService();

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    deploymentStatusService.stopAllPolling();
  });
}
