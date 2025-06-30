import { useCallback, useState } from 'react';
import { SupabaseService, type SupabaseProject, type SupabaseCredentials } from '~/lib/services/supabaseService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useSupabase');

export interface UseSupabaseReturn {
  // State
  dialogOpen: boolean;
  url: string;
  key: string;
  token: string;
  projects: SupabaseProject[];
  selectedProject: string;
  status: 'connected' | 'not_connected' | 'error';
  error: string;
  loading: boolean;

  // Actions
  openDialog: () => void;
  closeDialog: () => void;
  setUrl: (url: string) => void;
  setKey: (key: string) => void;
  setToken: (token: string) => void;
  setSelectedProject: (projectId: string) => void;

  // Supabase operations
  checkConnectionStatus: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  handleProjectSelect: (projectId: string) => Promise<void>;
  saveCredentials: () => Promise<void>;
  disconnect: () => void;
}

export function useSupabase(): UseSupabaseReturn {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [url, setUrl] = useState(localStorage.getItem('bolt_supabase_url') || '');
  const [key, setKey] = useState(localStorage.getItem('bolt_supabase_key') || '');
  const [token, setToken] = useState(localStorage.getItem('bolt_supabase_token') || '');
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [status, setStatus] = useState<'connected' | 'not_connected' | 'error'>('not_connected');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const openDialog = useCallback(() => {
    setDialogOpen(true);
    setError('');
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setError('');
  }, []);

  const checkConnectionStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const credentials: SupabaseCredentials = { url, key, token };
      const result = await SupabaseService.checkConnectionStatus(credentials);

      setStatus(result.status);

      if (result.error) {
        setError(result.error);
      }
    } catch (error) {
      logger.error('Failed to check connection status:', error);
      setStatus('error');
      setError('Failed to check connection status');
    } finally {
      setLoading(false);
    }
  }, [url, key, token]);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (!token) {
        setError('No Supabase token provided');
        return;
      }

      const projectList = await SupabaseService.fetchProjects(token);
      setProjects(projectList);
    } catch (error) {
      logger.error('Failed to fetch projects:', error);
      setError('Failed to fetch Supabase projects');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleProjectSelect = useCallback(
    async (projectId: string) => {
      try {
        setLoading(true);
        setError('');

        if (!token) {
          setError('No Supabase token provided');
          return;
        }

        const keys = await SupabaseService.fetchProjectKeys(projectId, token);

        // Update the URL and key with the selected project's credentials
        const projectUrl = SupabaseService.getProjectUrl(projectId);
        setUrl(projectUrl);
        setKey(keys.anon); // Use the anon key for client-side operations

        setSelectedProject(projectId);

        // Save the updated credentials
        const credentials: SupabaseCredentials = {
          url: projectUrl,
          key: keys.anon,
          token,
        };
        SupabaseService.saveCredentials(credentials);

        // Check connection status with new credentials
        await checkConnectionStatus();
      } catch (error) {
        logger.error('Failed to select project:', error);
        setError('Failed to select project');
      } finally {
        setLoading(false);
      }
    },
    [token, checkConnectionStatus],
  );

  const saveCredentials = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const credentials: SupabaseCredentials = { url, key, token };
      SupabaseService.saveCredentials(credentials);

      // Check connection status
      await checkConnectionStatus();

      // If connected and token is provided, fetch projects
      if (status === 'connected' && token) {
        await fetchProjects();
      }
    } catch (error) {
      logger.error('Failed to save credentials:', error);
      setError('Failed to save credentials');
    } finally {
      setLoading(false);
    }
  }, [url, key, token, status, checkConnectionStatus, fetchProjects]);

  const disconnect = useCallback(() => {
    SupabaseService.clearCredentials();
    setUrl('');
    setKey('');
    setToken('');
    setProjects([]);
    setSelectedProject('');
    setStatus('not_connected');
    setError('');
  }, []);

  return {
    // State
    dialogOpen,
    url,
    key,
    token,
    projects,
    selectedProject,
    status,
    error,
    loading,

    // Actions
    openDialog,
    closeDialog,
    setUrl,
    setKey,
    setToken,
    setSelectedProject,

    // Supabase operations
    checkConnectionStatus,
    fetchProjects,
    handleProjectSelect,
    saveCredentials,
    disconnect,
  };
}
