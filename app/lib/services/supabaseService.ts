import { toast } from 'react-toastify';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('supabaseService');

export interface SupabaseProject {
  id: string;
  name: string;
  db_host: string;
}

export interface SupabaseCredentials {
  url: string;
  key: string;
  token?: string;
}

export class SupabaseService {
  private static readonly STORAGE_KEYS = {
    URL: 'bolt_supabase_url',
    KEY: 'bolt_supabase_key',
    TOKEN: 'bolt_supabase_token',
  } as const;

  /**
   * Get stored Supabase credentials
   */
  static getCredentials(): SupabaseCredentials {
    return {
      url: localStorage.getItem(this.STORAGE_KEYS.URL) || '',
      key: localStorage.getItem(this.STORAGE_KEYS.KEY) || '',
      token: localStorage.getItem(this.STORAGE_KEYS.TOKEN) || '',
    };
  }

  /**
   * Save Supabase credentials to localStorage
   */
  static saveCredentials(credentials: SupabaseCredentials): void {
    localStorage.setItem(this.STORAGE_KEYS.URL, credentials.url);
    localStorage.setItem(this.STORAGE_KEYS.KEY, credentials.key);
    if (credentials.token) {
      localStorage.setItem(this.STORAGE_KEYS.TOKEN, credentials.token);
    }
  }

  /**
   * Clear stored Supabase credentials
   */
  static clearCredentials(): void {
    localStorage.removeItem(this.STORAGE_KEYS.URL);
    localStorage.removeItem(this.STORAGE_KEYS.KEY);
    localStorage.removeItem(this.STORAGE_KEYS.TOKEN);
  }

  /**
   * Check connection status with Supabase
   */
  static async checkConnectionStatus(credentials: SupabaseCredentials): Promise<{
    status: 'connected' | 'not_connected' | 'error';
    error?: string;
  }> {
    if (!credentials.url || !credentials.key) {
      return { status: 'not_connected' };
    }

    try {
      const res = await fetch(`${credentials.url}/rest/v1/?apikey=${credentials.key}`);
      if (res.ok) {
        return { status: 'connected' };
      } else {
        return { 
          status: 'error', 
          error: 'Invalid Supabase credentials or URL.' 
        };
      }
    } catch (error) {
      logger.error('Failed to check Supabase connection:', error);
      return { 
        status: 'error', 
        error: 'Could not connect to Supabase.' 
      };
    }
  }

  /**
   * Fetch user projects from Supabase
   */
  static async fetchProjects(token: string): Promise<SupabaseProject[]> {
    try {
      const response = await fetch('https://api.supabase.com/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.statusText}`);
      }

      const projects = await response.json();
      return projects.map((project: any) => ({
        id: project.id,
        name: project.name,
        db_host: project.db_host,
      }));
    } catch (error) {
      logger.error('Failed to fetch Supabase projects:', error);
      toast.error('Failed to fetch Supabase projects');
      throw error;
    }
  }

  /**
   * Fetch project API keys
   */
  static async fetchProjectKeys(projectId: string, token: string): Promise<{
    anon: string;
    service_role: string;
  }> {
    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch project keys: ${response.statusText}`);
      }

      const keys = await response.json();
      const anonKey = keys.find((key: any) => key.name === 'anon public');
      const serviceKey = keys.find((key: any) => key.name === 'service_role');

      if (!anonKey || !serviceKey) {
        throw new Error('Required API keys not found');
      }

      return {
        anon: anonKey.api_key,
        service_role: serviceKey.api_key,
      };
    } catch (error) {
      logger.error('Failed to fetch project keys:', error);
      toast.error('Failed to fetch project API keys');
      throw error;
    }
  }

  /**
   * Sync environment variables to Supabase
   */
  static async syncEnvironmentVariables(
    projectId: string, 
    token: string, 
    variables: Record<string, string>
  ): Promise<void> {
    try {
      const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/secrets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          secrets: Object.entries(variables).map(([key, value]) => ({
            name: key,
            value: value,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to sync environment variables: ${response.statusText}`);
      }

      toast.success('Environment variables synced to Supabase');
    } catch (error) {
      logger.error('Failed to sync environment variables:', error);
      toast.error('Failed to sync environment variables to Supabase');
      throw error;
    }
  }

  /**
   * Get project URL from project ID
   */
  static getProjectUrl(projectId: string): string {
    return `https://${projectId}.supabase.co`;
  }

  /**
   * Validate Supabase URL format
   */
  static validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.includes('supabase.co');
    } catch {
      return false;
    }
  }

  /**
   * Extract project ID from Supabase URL
   */
  static extractProjectId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const match = hostname.match(/^([^.]+)\.supabase\.co$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }
} 