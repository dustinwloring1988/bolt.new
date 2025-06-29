import { 
  updateDeploymentAlert, 
  createDeploymentSuccessAlert, 
  createDeploymentErrorAlert, 
  type DeploymentAlert 
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
    checkStatusFn: (deploymentId: string) => Promise<DeploymentStatusResponse>
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
            status: 'completed'
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
                status: 'completed'
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
              status: 'deploying'
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
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check Netlify deployment status: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map Netlify status to our standard status
    const statusMap: Record<string, DeploymentStatusResponse['status']> = {
      'new': 'queued',
      'building': 'building',
      'deploying': 'deploying',
      'ready': 'ready',
      'error': 'error',
      'failed': 'error',
    };

    return {
      status: statusMap[data.state] || 'deploying',
      url: data.state === 'ready' ? data.ssl_url || data.deploy_ssl_url : undefined,
      error: data.state === 'error' || data.state === 'failed' ? data.error_message : undefined,
      readyAt: data.published_at,
    };
  }
}

export class VercelStatusChecker {
  constructor(private token: string) {}

  async checkStatus(deploymentId: string): Promise<DeploymentStatusResponse> {
    const response = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check Vercel deployment status: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Map Vercel status to our standard status
    const statusMap: Record<string, DeploymentStatusResponse['status']> = {
      'BUILDING': 'building',
      'DEPLOYING': 'deploying',
      'READY': 'ready',
      'ERROR': 'error',
      'CANCELED': 'error',
      'QUEUED': 'queued',
    };

    return {
      status: statusMap[data.readyState] || 'deploying',
      url: data.readyState === 'READY' ? `https://${data.url}` : undefined,
      error: data.readyState === 'ERROR' ? 'Deployment failed' : undefined,
      readyAt: data.ready ? new Date(data.ready).toISOString() : undefined,
    };
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
