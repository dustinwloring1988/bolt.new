import { useCallback, useState } from 'react';
import {
  GitHubService,
  type GitHubRepo,
  type GitHubBranch,
  type GitHubCreateRepoOptions,
} from '~/lib/services/githubService';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('useGitHub');

export interface UseGitHubReturn {
  // state
  dialogOpen: boolean;
  dialogType: 'clone' | 'push' | 'create';
  repoUrl: string;
  commitMessage: string;
  repoName: string;
  repoDescription: string;
  privateRepo: boolean;
  branches: GitHubBranch[];
  selectedBranch: string;
  userRepos: any[];
  loading: boolean;
  error: string;
  tokenValid: boolean | null;

  // actions
  openDialog: (type: 'clone' | 'push' | 'create') => void;
  closeDialog: () => void;
  setRepoUrl: (url: string) => void;
  setCommitMessage: (message: string) => void;
  setRepoName: (name: string) => void;
  setRepoDescription: (description: string) => void;
  setPrivateRepo: (private_: boolean) => void;
  setSelectedBranch: (branch: string) => void;

  // github operations
  validateToken: () => Promise<void>;
  loadUserRepos: () => Promise<void>;
  loadBranches: (repoUrl: string) => Promise<void>;
  cloneRepository: () => Promise<void>;
  pushToRepository: () => Promise<void>;
  createRepository: () => Promise<void>;
}

export function useGitHub(): UseGitHubReturn {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'clone' | 'push' | 'create'>('clone');
  const [repoUrl, setRepoUrl] = useState('');
  const [commitMessage, setCommitMessage] = useState('Update project files');
  const [repoName, setRepoName] = useState('');
  const [repoDescription, setRepoDescription] = useState('');
  const [privateRepo, setPrivateRepo] = useState(false);
  const [branches, setBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  const openDialog = useCallback((type: 'clone' | 'push' | 'create') => {
    setDialogType(type);
    setDialogOpen(true);
    setError('');
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setError('');
  }, []);

  const validateToken = useCallback(async () => {
    try {
      setLoading(true);

      const isValid = await GitHubService.validateToken();
      setTokenValid(isValid);

      if (!isValid) {
        setError('Invalid GitHub token. Please check your settings.');
      }
    } catch (error) {
      logger.error('Failed to validate GitHub token:', error);
      setTokenValid(false);
      setError('Failed to validate GitHub token');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserRepos = useCallback(async () => {
    try {
      setLoading(true);

      const repos = await GitHubService.getUserRepos();
      setUserRepos(repos);
    } catch (error) {
      logger.error('Failed to load user repositories:', error);
      setError('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBranches = useCallback(async (repoUrl: string) => {
    try {
      setLoading(true);

      const repo = GitHubService.parseRepo(repoUrl);
      const branchList = await GitHubService.getBranches(repo);
      setBranches(branchList);
      setSelectedBranch(branchList[0]?.name || 'main');
    } catch (error) {
      logger.error('Failed to load branches:', error);
      setError('Failed to load repository branches');
    } finally {
      setLoading(false);
    }
  }, []);

  const cloneRepository = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const repo = GitHubService.parseRepo(repoUrl);
      const files = await GitHubService.fetchRepoFiles(repo);

      /**
       * Here you would typically add the files to the workbench
       * This depends on your workbench implementation
       */
      logger.info('Repository cloned successfully', { repo, fileCount: Object.keys(files).length });

      closeDialog();
    } catch (error) {
      logger.error('Failed to clone repository:', error);
      setError(error instanceof Error ? error.message : 'Failed to clone repository');
    } finally {
      setLoading(false);
    }
  }, [repoUrl, closeDialog]);

  const pushToRepository = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const repo = GitHubService.parseRepo(repoUrl);

      // get files from workbench (this would need to be implemented based on your workbench)
      const files: { [path: string]: string } = {}; // this should come from workbench

      await GitHubService.pushFiles(repo, files, commitMessage);

      closeDialog();
    } catch (error) {
      logger.error('Failed to push to repository:', error);
      setError(error instanceof Error ? error.message : 'Failed to push to repository');
    } finally {
      setLoading(false);
    }
  }, [repoUrl, commitMessage, closeDialog]);

  const createRepository = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const options: GitHubCreateRepoOptions = {
        name: repoName,
        description: repoDescription,
        private: privateRepo,
        auto_init: true,
      };

      await GitHubService.createRepo(options);

      closeDialog();
    } catch (error) {
      logger.error('Failed to create repository:', error);
      setError(error instanceof Error ? error.message : 'Failed to create repository');
    } finally {
      setLoading(false);
    }
  }, [repoName, repoDescription, privateRepo, closeDialog]);

  return {
    // state
    dialogOpen,
    dialogType,
    repoUrl,
    commitMessage,
    repoName,
    repoDescription,
    privateRepo,
    branches,
    selectedBranch,
    userRepos,
    loading,
    error,
    tokenValid,

    // actions
    openDialog,
    closeDialog,
    setRepoUrl,
    setCommitMessage,
    setRepoName,
    setRepoDescription,
    setPrivateRepo,
    setSelectedBranch,

    // github operations
    validateToken,
    loadUserRepos,
    loadBranches,
    cloneRepository,
    pushToRepository,
    createRepository,
  };
}
