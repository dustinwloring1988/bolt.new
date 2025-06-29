import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import * as React from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { DiffView } from '~/components/editor/DiffView';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { DialogRoot, Dialog, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { BoltTerminal } from './terminal/BoltTerminal';
import { setGlobalShellOutputHandler } from '~/lib/runtime/action-runner';
import { QRCodeModal } from '~/components/ui/QRCodeModal';
import { detectExpoUrl, showQRCode } from '~/lib/stores/qrCode';
import JSZip from 'jszip';
import { deployToNetlify, deployToVercel } from '~/components/sidebar/Menu.client';
import {
  parseGitHubRepo,
  fetchGitHubRepoFiles,
  pushFilesToGitHub,
  createGitHubRepo,
  getGitHubBranches,
  getUserRepos,
  validateGitHubToken,
  getGitHubToken,
  type GitHubRepo,
  type GitHubBranch,
} from '~/utils/github';

interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  center: {
    value: 'diff',
    text: 'Diff',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

declare global {
  interface Window {
    syncSupabaseEnv?: (url: string, key: string) => Promise<void>;
    webcontainer?: Promise<any>;
  }
}

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);
  const showTerminal = useStore(workbenchStore.showTerminal);
  const [boltOutputBuffer, setBoltOutputBuffer] = useState<string[]>([]);
  const [activeTerminalTab, setActiveTerminalTab] = useState<'bolt' | number>('bolt');
  const [terminalCount, setTerminalCount] = useState(1);

  const [supabaseDialogOpen, setSupabaseDialogOpen] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('bolt_supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('bolt_supabase_key') || '');
  const [supabaseToken, setSupabaseToken] = useState(localStorage.getItem('bolt_supabase_token') || '');
  const [projects, setProjects] = useState<{ id: string; name: string; db_host: string; }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [status, setStatus] = useState<'connected' | 'not_connected' | 'error'>('not_connected');
  const [error, setError] = useState<string>('');

  // GitHub Integration State
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubDialogType, setGithubDialogType] = useState<'clone' | 'push' | 'create'>('clone');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [githubCommitMessage, setGithubCommitMessage] = useState('Update project files');
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubRepoDescription, setGithubRepoDescription] = useState('');
  const [githubPrivateRepo, setGithubPrivateRepo] = useState(false);
  const [githubBranches, setGithubBranches] = useState<GitHubBranch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [userRepos, setUserRepos] = useState<any[]>([]);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');
  const [githubTokenValid, setGithubTokenValid] = useState<boolean | null>(null);

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  useEffect(() => {
    async function checkStatus() {
      setError('');
      if (supabaseUrl && supabaseKey) {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseKey}`);
          if (res.ok) {
            setStatus('connected');
          } else {
            setStatus('error');
            setError('Invalid Supabase credentials or URL.');
          }
        } catch (e) {
          setStatus('error');
          setError('Could not connect to Supabase.');
        }
      } else {
        setStatus('not_connected');
      }
    }
    checkStatus();
  }, [supabaseUrl, supabaseKey]);

  useEffect(() => {
    setGlobalShellOutputHandler((data: string) => {
      setBoltOutputBuffer(prev => [...prev, data]);
      
      // Check for Expo URLs in terminal output
      const expoUrl = detectExpoUrl(data);
      if (expoUrl) {
        // Auto-show QR code when Expo URL is detected
        showQRCode(expoUrl);
      }
    });
    return () => {
      setGlobalShellOutputHandler(null);
    };
  }, []);

  async function fetchProjects(token: string) {
    setError('');
    setProjects([]);
    setSelectedProject('');
    try {
      const res = await fetch('https://api.supabase.com/v1/projects', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch projects.');
      const data = await res.json();
      if (Array.isArray(data) && data.every(p => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.db_host === 'string')) {
        setProjects(data);
      } else {
        setProjects([]);
        setError('Unexpected response from Supabase API.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch projects.');
      setProjects([]);
    }
  }

  async function fetchProjectKeys(projectId: string, token: string) {
    setError('');
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectId}/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch project keys.');
      const data = await res.json();
      if (Array.isArray(data)) {
        // Find anon/public key
        const anonKey = data.find((k: any) => k.name === 'anon' || k.name === 'public');
        if (anonKey && anonKey.api_key) {
          setSupabaseKey(anonKey.api_key);
        } else {
          setError('Could not auto-fetch anon/public key. Please enter it manually.');
        }
      } else {
        setError('Unexpected response when fetching project keys.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch project keys.');
    }
  }

  function handleProjectSelect(id: string) {
    setSelectedProject(id);
    const project = projects.find(p => p.id === id);
    if (project) {
      setSupabaseUrl(`https://${project.db_host}`);
      if (supabaseToken) {
        fetchProjectKeys(project.id, supabaseToken);
      }
    }
  }

  async function handleSupabaseSave() {
    setError('');
    localStorage.setItem('bolt_supabase_url', supabaseUrl);
    localStorage.setItem('bolt_supabase_key', supabaseKey);
    localStorage.setItem('bolt_supabase_token', supabaseToken);
    setSupabaseDialogOpen(false);
    if (window.syncSupabaseEnv) {
      try {
        await window.syncSupabaseEnv(supabaseUrl, supabaseKey);
        setStatus('connected');
      } catch (e: any) {
        setStatus('error');
        setError(e.message || 'Failed to sync with WebContainer.');
      }
    }
  }

  async function handleDisconnect() {
    setSupabaseUrl('');
    setSupabaseKey('');
    setSupabaseToken('');
    setProjects([]);
    setSelectedProject('');
    setStatus('not_connected');
    setError('');
    localStorage.removeItem('bolt_supabase_url');
    localStorage.removeItem('bolt_supabase_key');
    localStorage.removeItem('bolt_supabase_token');
    // Try to remove .env from WebContainer
    if (window.syncSupabaseEnv) {
      try {
        if (window.webcontainer) {
          const container = await window.webcontainer;
          await container.fs.rm('.env');
        }
      } catch {}
    }
  }

  const onEditorChange = useCallback<OnEditorChange>((update) => {
    workbenchStore.setCurrentDocumentContent(update.content);
  }, []);

  const onEditorScroll = useCallback<OnEditorScroll>((position) => {
    workbenchStore.setCurrentDocumentScrollPosition(position);
  }, []);

  const onFileSelect = useCallback((filePath: string | undefined) => {
    workbenchStore.setSelectedFile(filePath);
  }, []);

  const onFileSave = useCallback(() => {
    workbenchStore.saveCurrentDocument().catch(() => {
      toast.error('Failed to update file content');
    });
  }, []);

  const onFileReset = useCallback(() => {
    workbenchStore.resetCurrentDocument();
  }, []);

  // GitHub Integration Functions
  useEffect(() => {
    // Check GitHub token validity on mount
    const checkGitHubToken = async () => {
      const token = getGitHubToken();
      if (token) {
        const isValid = await validateGitHubToken();
        setGithubTokenValid(isValid);
      } else {
        setGithubTokenValid(false);
      }
    };
    checkGitHubToken();
  }, []);

  const openGitHubDialog = (type: 'clone' | 'push' | 'create') => {
    setGithubDialogType(type);
    setGithubError('');
    setGithubDialogOpen(true);
    
    if (type === 'push' && userRepos.length === 0) {
      loadUserRepos();
    }
  };

  const loadUserRepos = async () => {
    try {
      setGithubLoading(true);
      const repos = await getUserRepos();
      setUserRepos(repos);
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Failed to load repositories');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleCloneRepository = async () => {
    if (!githubRepoUrl.trim()) {
      setGithubError('Please enter a repository URL');
      return;
    }

    try {
      setGithubLoading(true);
      setGithubError('');
      
      const repo = parseGitHubRepo(githubRepoUrl);
      repo.branch = selectedBranch;
      
      const files = await fetchGitHubRepoFiles(repo);
      
      // Clear existing files first
      const currentFiles = workbenchStore.files.get();
      for (const filePath of Object.keys(currentFiles)) {
        await workbenchStore.deleteFile(filePath);
      }
      
      // Add new files to the workbench
      for (const [path, content] of Object.entries(files)) {
        await workbenchStore.setCurrentDocumentContent(content);
        await workbenchStore.saveFile(path);
      }
      
      toast.success(`Successfully cloned ${repo.owner}/${repo.name}`);
      setGithubDialogOpen(false);
      setGithubRepoUrl('');
      
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Failed to clone repository');
    } finally {
      setGithubLoading(false);
    }
  };

  const handlePushToRepository = async () => {
    if (!githubRepoUrl.trim()) {
      setGithubError('Please enter a repository URL');
      return;
    }

    try {
      setGithubLoading(true);
      setGithubError('');
      
      const repo = parseGitHubRepo(githubRepoUrl);
      repo.branch = selectedBranch;
      
      const files = await getAllFilesForDeploy();
      
      await pushFilesToGitHub(repo, files, githubCommitMessage);
      
      toast.success(`Successfully pushed to ${repo.owner}/${repo.name}`);
      setGithubDialogOpen(false);
      setGithubRepoUrl('');
      setGithubCommitMessage('Update project files');
      
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Failed to push to repository');
    } finally {
      setGithubLoading(false);
    }
  };

  const handleCreateRepository = async () => {
    if (!githubRepoName.trim()) {
      setGithubError('Please enter a repository name');
      return;
    }

    try {
      setGithubLoading(true);
      setGithubError('');
      
      const repoData = await createGitHubRepo({
        name: githubRepoName,
        description: githubRepoDescription,
        private: githubPrivateRepo,
      });
      
      // After creating, push current files
      const files = await getAllFilesForDeploy();
      const repo: GitHubRepo = {
        owner: repoData.owner.login,
        name: repoData.name,
        branch: 'main',
      };
      
      if (Object.keys(files).length > 0) {
        await pushFilesToGitHub(repo, files, 'Initial commit');
      }
      
      toast.success(
        <span>
          Repository created: <a href={repoData.html_url} target="_blank" rel="noopener noreferrer">{repoData.full_name}</a>
        </span>, 
        { autoClose: false }
      );
      
      setGithubDialogOpen(false);
      setGithubRepoName('');
      setGithubRepoDescription('');
      
    } catch (error) {
      setGithubError(error instanceof Error ? error.message : 'Failed to create repository');
    } finally {
      setGithubLoading(false);
    }
  };

  const loadBranches = async (repoUrl: string) => {
    try {
      const repo = parseGitHubRepo(repoUrl);
      const branches = await getGitHubBranches(repo);
      setGithubBranches(branches);
      if (branches.length > 0) {
        setSelectedBranch(branches[0].name);
      }
    } catch (error) {
      console.warn('Failed to load branches:', error);
      setGithubBranches([]);
    }
  };

  // --- Download as Zip helpers ---
  async function getAllFilesForDeploy() {
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

  async function createProjectZip(files: { [key: string]: string }): Promise<Blob> {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    return await zip.generateAsync({ type: 'blob' });
  }

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
            {
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-6">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <button
                  className={`ml-3 rounded px-3 py-1 text-sm flex items-center ${status === 'connected' ? 'bg-green-600 text-white' : status === 'error' ? 'bg-red-600 text-white' : 'bg-gray-300 text-black'} hover:bg-green-700`}
                  onClick={() => setSupabaseDialogOpen(true)}
                  title="Connect Supabase"
                >
                  Connect Supabase
                  <span className={`ml-2 inline-block w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-400' : status === 'error' ? 'bg-red-400' : 'bg-gray-400'}`}></span>
                </button>
                <button
                  className="ml-2 p-2 rounded hover:bg-green-100 text-green-700 border border-green-200 flex items-center"
                  title="Download Project as Zip"
                  onClick={async () => {
                    try {
                      const files = await getAllFilesForDeploy();
                      const zipBlob = await createProjectZip(files);
                      const url = URL.createObjectURL(zipBlob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'project.zip';
                      document.body.appendChild(a);
                      a.click();
                      setTimeout(() => {
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                      }, 100);
                    } catch (e) {
                      toast.error('Failed to download zip: ' + (e instanceof Error ? e.message : e));
                    }
                  }}
                >
                  <span className="i-ph:download-simple-duotone text-xl mr-1" /> Download as Zip
                </button>
                <button
                  className="ml-2 p-2 rounded hover:bg-green-100 text-green-700 border border-green-200 flex items-center"
                  title="Deploy to Netlify"
                  onClick={deployToNetlify}
                >
                  <span className="i-ph:rocket-launch-duotone text-xl mr-1" /> Deploy to Netlify
                </button>
                <button
                  className="ml-2 p-2 rounded hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center"
                  title="Deploy to Vercel"
                  onClick={deployToVercel}
                >
                  <span className="i-ph:cloud-arrow-up-duotone text-xl mr-1" /> Deploy to Vercel
                </button>
                
                {/* GitHub Integration Buttons */}
                <button
                  className={`ml-2 p-2 rounded flex items-center border ${
                    githubTokenValid === false 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'hover:bg-gray-100 text-gray-700 border-gray-200'
                  }`}
                  title={githubTokenValid === false ? 'GitHub token required (check settings)' : 'Clone from GitHub'}
                  onClick={() => openGitHubDialog('clone')}
                  disabled={githubTokenValid === false}
                >
                  <span className="i-ph:git-branch-duotone text-xl mr-1" /> Clone
                  {githubTokenValid === false && <span className="ml-1 text-xs text-red-500">⚠</span>}
                </button>
                <button
                  className={`ml-2 p-2 rounded flex items-center border ${
                    githubTokenValid === false 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'hover:bg-purple-100 text-purple-700 border-purple-200'
                  }`}
                  title={githubTokenValid === false ? 'GitHub token required (check settings)' : 'Push to GitHub'}
                  onClick={() => openGitHubDialog('push')}
                  disabled={githubTokenValid === false}
                >
                  <span className="i-ph:git-commit-duotone text-xl mr-1" /> Push
                  {githubTokenValid === false && <span className="ml-1 text-xs text-red-500">⚠</span>}
                </button>
                <button
                  className={`ml-2 p-2 rounded flex items-center border ${
                    githubTokenValid === false 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'hover:bg-orange-100 text-orange-700 border-orange-200'
                  }`}
                  title={githubTokenValid === false ? 'GitHub token required (check settings)' : 'Create GitHub Repository'}
                  onClick={() => openGitHubDialog('create')}
                  disabled={githubTokenValid === false}
                >
                  <span className="i-ph:plus-circle-duotone text-xl mr-1" /> Create Repo
                  {githubTokenValid === false && <span className="ml-1 text-xs text-red-500">⚠</span>}
                </button>
                <DialogRoot open={supabaseDialogOpen}>
                  <Dialog onBackdrop={() => setSupabaseDialogOpen(false)} onClose={() => setSupabaseDialogOpen(false)}>
                    <DialogTitle>Connect to Supabase</DialogTitle>
                    <DialogDescription>
                      <div className="space-y-4">
                        <div>
                          <label className="block font-medium mb-1">Supabase Access Token</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                            value={supabaseToken}
                            onChange={e => setSupabaseToken(e.target.value)}
                            placeholder="Personal access token"
                            onBlur={() => supabaseToken && fetchProjects(supabaseToken)}
                          />
                          <button className="mt-1 text-xs underline" onClick={() => fetchProjects(supabaseToken)} disabled={!supabaseToken}>Fetch Projects</button>
                        </div>
                        {projects.length > 0 && (
                          <div>
                            <label className="block font-medium mb-1">Select Project</label>
                            <select
                              className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                              value={selectedProject}
                              onChange={e => handleProjectSelect(e.target.value)}
                            >
                              <option value="">-- Select a project --</option>
                              {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block font-medium mb-1">Supabase URL</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                            value={supabaseUrl}
                            onChange={e => setSupabaseUrl(e.target.value)}
                            placeholder="https://xyzcompany.supabase.co"
                          />
                        </div>
                        <div>
                          <label className="block font-medium mb-1">Supabase Key</label>
                          <input
                            type="text"
                            className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                            value={supabaseKey}
                            onChange={e => setSupabaseKey(e.target.value)}
                            placeholder="Your Supabase anon/public key"
                          />
                        </div>
                        {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
                      </div>
                    </DialogDescription>
                    <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-between">
                      <DialogButton type="danger" onClick={handleDisconnect}>Disconnect</DialogButton>
                      <div className="flex gap-2">
                        <DialogButton type="secondary" onClick={() => setSupabaseDialogOpen(false)}>Cancel</DialogButton>
                        <DialogButton type="primary" onClick={handleSupabaseSave}>Save</DialogButton>
                      </div>
                    </div>
                  </Dialog>
                </DialogRoot>
                
                {/* GitHub Integration Dialog */}
                <DialogRoot open={githubDialogOpen}>
                  <Dialog onBackdrop={() => setGithubDialogOpen(false)} onClose={() => setGithubDialogOpen(false)}>
                    <DialogTitle>
                      {githubDialogType === 'clone' && 'Clone Repository from GitHub'}
                      {githubDialogType === 'push' && 'Push to GitHub Repository'}
                      {githubDialogType === 'create' && 'Create New GitHub Repository'}
                    </DialogTitle>
                    <DialogDescription>
                      <div className="space-y-4">
                        {githubTokenValid === false && (
                          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <p className="text-yellow-800 text-sm">
                              GitHub token not set or invalid. Please add your GitHub token in settings.
                            </p>
                          </div>
                        )}
                        
                        {githubDialogType === 'clone' && (
                          <>
                            <div>
                              <label className="block font-medium mb-1">Repository URL</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                value={githubRepoUrl}
                                onChange={(e) => {
                                  setGithubRepoUrl(e.target.value);
                                  if (e.target.value.trim()) {
                                    loadBranches(e.target.value);
                                  }
                                }}
                                placeholder="owner/repo or https://github.com/owner/repo"
                              />
                            </div>
                            {githubBranches.length > 0 && (
                              <div>
                                <label className="block font-medium mb-1">Branch</label>
                                <select
                                  className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                  value={selectedBranch}
                                  onChange={(e) => setSelectedBranch(e.target.value)}
                                >
                                  {githubBranches.map((branch) => (
                                    <option key={branch.name} value={branch.name}>{branch.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </>
                        )}
                        
                        {githubDialogType === 'push' && (
                          <>
                            <div>
                              <label className="block font-medium mb-1">Repository URL</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                value={githubRepoUrl}
                                onChange={(e) => {
                                  setGithubRepoUrl(e.target.value);
                                  if (e.target.value.trim()) {
                                    loadBranches(e.target.value);
                                  }
                                }}
                                placeholder="owner/repo or https://github.com/owner/repo"
                              />
                              {userRepos.length > 0 && (
                                <div className="mt-2">
                                  <label className="block text-sm text-gray-600 mb-1">Or select from your repositories:</label>
                                  <select
                                    className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        setGithubRepoUrl(e.target.value);
                                        loadBranches(e.target.value);
                                      }
                                    }}
                                    value=""
                                  >
                                    <option value="">-- Select a repository --</option>
                                    {userRepos.map((repo) => (
                                      <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                            {githubBranches.length > 0 && (
                              <div>
                                <label className="block font-medium mb-1">Branch</label>
                                <select
                                  className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                  value={selectedBranch}
                                  onChange={(e) => setSelectedBranch(e.target.value)}
                                >
                                  {githubBranches.map((branch) => (
                                    <option key={branch.name} value={branch.name}>{branch.name}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="block font-medium mb-1">Commit Message</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                value={githubCommitMessage}
                                onChange={(e) => setGithubCommitMessage(e.target.value)}
                                placeholder="Update project files"
                              />
                            </div>
                          </>
                        )}
                        
                        {githubDialogType === 'create' && (
                          <>
                            <div>
                              <label className="block font-medium mb-1">Repository Name</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                value={githubRepoName}
                                onChange={(e) => setGithubRepoName(e.target.value)}
                                placeholder="my-awesome-project"
                              />
                            </div>
                            <div>
                              <label className="block font-medium mb-1">Description (optional)</label>
                              <input
                                type="text"
                                className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                                value={githubRepoDescription}
                                onChange={(e) => setGithubRepoDescription(e.target.value)}
                                placeholder="A brief description of your project"
                              />
                            </div>
                            <div className="flex items-center">
                              <input
                                type="checkbox"
                                id="private-repo"
                                className="mr-2"
                                checked={githubPrivateRepo}
                                onChange={(e) => setGithubPrivateRepo(e.target.checked)}
                              />
                              <label htmlFor="private-repo" className="text-sm">Make repository private</label>
                            </div>
                          </>
                        )}
                        
                        {githubError && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-red-800 text-sm">{githubError}</p>
                          </div>
                        )}
                      </div>
                    </DialogDescription>
                    <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                      <DialogButton type="secondary" onClick={() => setGithubDialogOpen(false)}>
                        Cancel
                      </DialogButton>
                      <DialogButton 
                        type="primary" 
                        onClick={() => {
                          if (githubLoading || githubTokenValid === false) return;
                          if (githubDialogType === 'clone') handleCloneRepository();
                          else if (githubDialogType === 'push') handlePushToRepository();
                          else if (githubDialogType === 'create') handleCreateRepository();
                        }}
                      >
                        {githubLoading ? 'Processing...' : (
                          githubDialogType === 'clone' ? 'Clone' :
                          githubDialogType === 'push' ? 'Push' : 'Create'
                        )}
                      </DialogButton>
                    </div>
                  </Dialog>
                </DialogRoot>
                
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <PanelHeaderButton
                    className="mr-1 text-sm"
                    onClick={() => {
                      workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                    }}
                  >
                    <div className="i-ph:terminal" />
                    Toggle Terminal
                  </PanelHeaderButton>
                )}
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <EditorPanel
                    editorDocument={currentDocument}
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    files={files}
                    unsavedFiles={unsavedFiles}
                    onFileSelect={onFileSelect}
                    onEditorScroll={onEditorScroll}
                    onEditorChange={onEditorChange}
                    onFileSave={onFileSave}
                    onFileReset={onFileReset}
                    terminalTabs={{
                      active: activeTerminalTab,
                      setActive: setActiveTerminalTab,
                      count: terminalCount,
                      setCount: setTerminalCount,
                      boltOutputBuffer,
                    }}
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'diff' ? 0 : selectedView === 'code' ? '100%' : '-100%' }}
                  animate={{ x: selectedView === 'diff' ? 0 : selectedView === 'code' ? '100%' : '-100%' }}
                >
                  <DiffView 
                    modifications={workbenchStore.getFileModifcations()} 
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
              </div>
            </div>
          </div>
        </div>
        {/* QR Code Modal */}
        <QRCodeModal />
      </motion.div>
    )
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: React.ReactElement;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
