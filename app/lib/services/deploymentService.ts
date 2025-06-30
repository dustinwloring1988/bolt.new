import JSZip from 'jszip';
import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';
import { workbenchStore } from '~/lib/stores/workbench';

const logger = createScopedLogger('deploymentService');

export interface DeploymentOptions {
  provider: 'netlify' | 'vercel';
  token: string;
  siteName?: string;
  projectName?: string;
}

export interface DeploymentResult {
  success: boolean;
  url?: string;
  error?: string;
  deploymentId?: string;
}

export class DeploymentService {
  /**
   * Get all files from workbench for deployment
   */
  static async getAllFilesForDeploy(): Promise<{ [key: string]: string }> {
    // Save all files first to ensure latest content
    await workbenchStore.saveAllFiles();
    const fileMap = workbenchStore.files.get();
    const files: { [key: string]: string } = {};
    
    for (const [path, dirent] of Object.entries(fileMap)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        files[path.startsWith('/') ? path.slice(1) : path] = dirent.content;
      }
    }
    
    return files;
  }

  /**
   * Create a ZIP file from project files
   */
  static async createProjectZip(files: { [key: string]: string }): Promise<Blob> {
    const zip = new JSZip();
    
    // Add all files to the ZIP
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    
    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Deploy to Netlify
   */
  static async deployToNetlify(token: string, siteName?: string): Promise<DeploymentResult> {
    try {
      const files = await this.getAllFilesForDeploy();
      const zipBlob = await this.createProjectZip(files);
      
      // Create FormData with the ZIP file
      const formData = new FormData();
      formData.append('file', zipBlob, 'project.zip');
      formData.append('name', siteName || 'bolt-project');
      
      const response = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type header - let the browser set it with boundary for FormData
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error instanceof Error) {
          throw new Error(error.message || `Netlify deployment failed: ${response.statusText}`);
        } else {
          throw new Error(String(error) || `Netlify deployment failed: ${response.statusText}`);
        }
      }
      
      const result = await response.json();
      
      if (typeof result === 'object' && result !== null && ('ssl_url' in result || 'url' in result)) {
        return {
          success: true,
          url: (result as any).ssl_url || (result as any).url,
          deploymentId: (result as any).id,
        };
      } else {
        throw new Error('Invalid response from Netlify');
      }
    } catch (error) {
      logger.error('Netlify deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy to Vercel
   */
  static async deployToVercel(token: string, projectName?: string): Promise<DeploymentResult> {
    try {
      const files = await this.getAllFilesForDeploy();
      const zipBlob = await this.createProjectZip(files);
      
      // Create FormData with the ZIP file
      const formData = new FormData();
      formData.append('file', zipBlob, 'project.zip');
      formData.append('name', projectName || 'bolt-project');
      
      const response = await fetch('https://api.vercel.com/v13/deployments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // Don't set Content-Type header - let the browser set it with boundary for FormData
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        if (error instanceof Error) {
          throw new Error((error as any).error?.message || error.message || `Vercel deployment failed: ${response.statusText}`);
        } else {
          throw new Error(String(error) || `Vercel deployment failed: ${response.statusText}`);
        }
      }
      
      const result = await response.json();
      
      if (typeof result === 'object' && result !== null && 'url' in result && 'id' in result) {
        return {
          success: true,
          url: `https://${(result as any).url}`,
          deploymentId: (result as any).id,
        };
      } else {
        throw new Error('Invalid response from Vercel');
      }
    } catch (error) {
      logger.error('Vercel deployment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deploy to specified provider
   */
  static async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    try {
      switch (options.provider) {
        case 'netlify':
          return await this.deployToNetlify(options.token, options.siteName);
        case 'vercel':
          return await this.deployToVercel(options.token, options.projectName);
        default:
          throw new Error(`Unsupported deployment provider: ${options.provider}`);
      }
    } catch (error) {
      logger.error('Deployment failed:', error);
      toast.error('Deployment failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate deployment token
   */
  static async validateToken(provider: 'netlify' | 'vercel', token: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'netlify':
          const netlifyResponse = await fetch('https://api.netlify.com/api/v1/user', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          return netlifyResponse.ok;
          
        case 'vercel':
          const vercelResponse = await fetch('https://api.vercel.com/v2/user', {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          return vercelResponse.ok;
          
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Failed to validate ${provider} token:`, error);
      return false;
    }
  }

  /**
   * Get deployment status
   */
  static async getDeploymentStatus(
    provider: 'netlify' | 'vercel', 
    deploymentId: string, 
    token: string
  ): Promise<{
    status: 'deploying' | 'ready' | 'error' | 'building' | 'queued';
    url?: string;
    error?: string;
  }> {
    try {
      switch (provider) {
        case 'netlify':
          const netlifyResponse = await fetch(`https://api.netlify.com/api/v1/deployments/${deploymentId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (!netlifyResponse.ok) {
            throw new Error(`Failed to check Netlify deployment status: ${netlifyResponse.statusText}`);
          }
          
          const netlifyData = await netlifyResponse.json();
          const netlifyStatusMap: Record<string, any> = {
            'new': 'queued',
            'building': 'building',
            'deploying': 'deploying',
            'ready': 'ready',
            'error': 'error',
            'failed': 'error',
          };
          
          if (typeof netlifyData === 'object' && netlifyData !== null && 'state' in netlifyData) {
            return {
              status: netlifyStatusMap[(netlifyData as any).state] || 'deploying',
              url: (netlifyData as any).state === 'ready' ? (netlifyData as any).ssl_url || (netlifyData as any).deploy_ssl_url : undefined,
              error: (netlifyData as any).state === 'error' || (netlifyData as any).state === 'failed' ? (netlifyData as any).error_message : undefined,
            };
          } else {
            throw new Error('Invalid response from Netlify');
          }
          
        case 'vercel':
          const vercelResponse = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          
          if (!vercelResponse.ok) {
            throw new Error(`Failed to check Vercel deployment status: ${vercelResponse.statusText}`);
          }
          
          const vercelData = await vercelResponse.json();
          const vercelStatusMap: Record<string, any> = {
            'BUILDING': 'building',
            'DEPLOYING': 'deploying',
            'READY': 'ready',
            'ERROR': 'error',
            'CANCELED': 'error',
            'QUEUED': 'queued',
          };
          
          if (typeof vercelData === 'object' && vercelData !== null && 'readyState' in vercelData) {
            return {
              status: vercelStatusMap[(vercelData as any).readyState] || 'deploying',
              url: (vercelData as any).readyState === 'READY' ? `https://${(vercelData as any).url}` : undefined,
              error: (vercelData as any).readyState === 'ERROR' ? 'Deployment failed' : undefined,
            };
          } else {
            throw new Error('Invalid response from Vercel');
          }
          
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      logger.error(`Failed to get deployment status for ${provider}:`, error);
      throw error;
    }
  }
} 