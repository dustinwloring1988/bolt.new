import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle, SettingsDialog } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { db, deleteById, getAll, chatId, type ChatHistoryItem, exportAllChats, deleteAllChats } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import * as nodePath from 'node:path';
import JSZip from 'jszip';
import { IconButton } from '~/components/ui/IconButton';
import { 
  createDeploymentStartAlert,
  createDeploymentSuccessAlert,
  createDeploymentErrorAlert
} from '~/lib/stores/deploymentAlerts';
import { deploymentStatusService, NetlifyStatusChecker, VercelStatusChecker } from '~/lib/services/deploymentStatus';
import { STARTER_TEMPLATES } from '~/utils/templates';
import { generateTemplatePrompt } from '~/utils/github';
import {
  parseGitHubRepo,
  fetchGitHubRepoFiles,
  pushFilesToGitHub,
  createGitHubRepo,
  getGitHubBranches,
  getUserRepos,
  validateGitHubToken,
  type GitHubRepo,
  type GitHubBranch,
} from '~/utils/github';
import { settingsStore } from '~/lib/stores/settings';

declare global {
  interface Window {
    syncSupabaseEnv?: (url: string, key: string) => Promise<void>;
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-150px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ChatHistoryItem } | null;

export function Menu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [list, setList] = useState<ChatHistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  // Template Modal State
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  // Local Folder Modal State
  const [localFolderDialogOpen, setLocalFolderDialogOpen] = useState(false);
  const [localFolderLoading, setLocalFolderLoading] = useState(false);
  const [localFolderError, setLocalFolderError] = useState('');

  const loadEntries = useCallback(() => {
    if (db) {
      getAll(db)
        .then((list) => list.filter((item) => item.urlId && item.description))
        .then(setList)
        .catch((error) => toast.error(error.message));
    }
  }, []);

  const deleteItem = useCallback((event: React.UIEvent, item: ChatHistoryItem) => {
    event.preventDefault();

    if (db) {
      deleteById(db, item.id)
        .then(() => {
          loadEntries();

          if (chatId.get() === item.id) {
            // hard page navigation to clear the stores
            window.location.pathname = '/';
          }
        })
        .catch((error) => {
          toast.error('Failed to delete conversation');
          logger.error(error);
        });
    }
  }, []);

  const closeDialog = () => {
    setDialogContent(null);
  };

  useEffect(() => {
    if (open) {
      loadEntries();
    }
  }, [open]);

  useEffect(() => {
    const enterThreshold = 40;
    const exitThreshold = 40;

    function onMouseMove(event: MouseEvent) {
      if (event.pageX < enterThreshold) {
        setOpen(true);
      }

      if (menuRef.current && event.clientX > menuRef.current.getBoundingClientRect().right + exitThreshold) {
        setOpen(false);
      }
    }

    window.addEventListener('mousemove', onMouseMove);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  useEffect(() => {
    // Check connection status on mount or when credentials change
    async function checkStatus() {
      setError('');
      if (supabaseUrl && supabaseKey) {
        try {
          // Try a simple Supabase API call
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
      
      console.log('Attempting to clone repository:', githubRepoUrl);
      const repo = parseGitHubRepo(githubRepoUrl);
      repo.branch = selectedBranch;
      console.log('Parsed repository:', repo);
      
      const files = await fetchGitHubRepoFiles(repo);
      console.log('Successfully fetched files:', Object.keys(files));
      
      // Store files in localStorage for loading after chat starts
      const fileData = {
        files,
        type: 'github',
        repoName: `${repo.owner}/${repo.name}`,
        timestamp: Date.now()
      };
      localStorage.setItem('bolt_pending_files', JSON.stringify(fileData));
      
      // Create a new chat with the cloned project
      const projectPrompt = `I've cloned the repository ${repo.owner}/${repo.name} from GitHub. The project contains ${Object.keys(files).length} files. Can you help me understand this project and assist with any development tasks?`;
      
      toast.success(`Successfully cloned ${repo.owner}/${repo.name}`);
      setGithubDialogOpen(false);
      setGithubRepoUrl('');
      
      // Navigate to new chat with project prompt and file loading flag
      window.location.href = `/?template=${encodeURIComponent(projectPrompt)}&loadFiles=true`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clone repository';
      console.error('Clone error:', error);
      
      // Provide more specific error messages
      if (errorMessage.includes('404')) {
        setGithubError('Repository not found. Please check the repository URL and ensure it exists and is accessible.');
      } else if (errorMessage.includes('403')) {
        setGithubError('Access denied. The repository may be private or your token may not have the required permissions.');
      } else if (errorMessage.includes('401')) {
        setGithubError('Authentication failed. Please check your GitHub token in settings.');
      } else {
        setGithubError(`Failed to clone repository: ${errorMessage}`);
      }
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
      // Don't show error for branch loading as it's not critical
      // The user can still proceed with the default branch
    }
  };

  const handleTemplateSelect = (template: any) => {
    const prompt = generateTemplatePrompt(template);
    // Navigate to new chat with template prompt
    window.location.href = `/?template=${encodeURIComponent(prompt)}`;
    setTemplateDialogOpen(false);
  };
  
  const handleLocalFolderImport = async () => {
    try {
      setLocalFolderLoading(true);
      setLocalFolderError('');
      
      // Check if File System Access API is supported
      if (!('showDirectoryPicker' in window)) {
        throw new Error('File System Access API is not supported in this browser. Please use Chrome, Edge, or another Chromium-based browser.');
      }
      
      // Open directory picker
      const directoryHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });
      
      console.log('Selected directory:', directoryHandle.name);
      
      // Read files from the directory
      const files: { [path: string]: string } = {};
      await readDirectory(directoryHandle, '', files);
      
      console.log('Read files:', Object.keys(files));
      
      if (Object.keys(files).length === 0) {
        throw new Error('No readable files found in the selected folder.');
      }
      
      // Store files in localStorage for loading after chat starts
      const fileData = {
        files,
        type: 'local',
        folderName: directoryHandle.name,
        timestamp: Date.now()
      };
      localStorage.setItem('bolt_pending_files', JSON.stringify(fileData));
      
      // Create a new chat with the imported project
      const projectPrompt = `I've imported a local project folder named "${directoryHandle.name}" containing ${Object.keys(files).length} files. Can you help me understand this project and assist with any development tasks?`;
      
      toast.success(`Successfully imported ${Object.keys(files).length} files from ${directoryHandle.name}`);
      setLocalFolderDialogOpen(false);
      
      // Navigate to new chat with project prompt and file loading flag
      window.location.href = `/?template=${encodeURIComponent(projectPrompt)}&loadFiles=true`;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import folder';
      console.error('Local folder import error:', error);
      setLocalFolderError(errorMessage);
    } finally {
      setLocalFolderLoading(false);
    }
  };
  
  // Helper function to recursively read directory contents
  const readDirectory = async (dirHandle: any, basePath: string, files: { [path: string]: string }) => {
    for await (const entry of dirHandle.values()) {
      const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;
      
      if (entry.kind === 'file') {
        try {
          // Skip certain file types that we don't want to import
          const skipExtensions = ['.git', '.DS_Store', 'Thumbs.db', '.env', '.env.local', '.env.production'];
          const skipDirectories = ['node_modules', '.git', '.next', 'dist', 'build', '.vercel', '.netlify'];
          
          if (skipExtensions.some(ext => entry.name.endsWith(ext)) || 
              skipDirectories.some(dir => entryPath.includes(`/${dir}/`) || entryPath.startsWith(`${dir}/`))) {
            continue;
          }
          
          const file = await entry.getFile();
          
          // Only read text files (check file size and type)
          if (file.size > 1024 * 1024) { // Skip files larger than 1MB
            console.warn(`Skipping large file: ${entryPath} (${file.size} bytes)`);
            continue;
          }
          
          // Try to read as text
          const content = await file.text();
          
          // Basic check for binary content
          if (content.includes('\0')) {
            console.warn(`Skipping binary file: ${entryPath}`);
            continue;
          }
          
          files[entryPath] = content;
          
        } catch (fileError) {
          console.warn(`Failed to read file ${entryPath}:`, fileError);
        }
      } else if (entry.kind === 'directory') {
        // Skip certain directories
        const skipDirectories = ['node_modules', '.git', '.next', 'dist', 'build', '.vercel', '.netlify'];
        if (skipDirectories.includes(entry.name)) {
          continue;
        }
        
        // Recursively read subdirectory
        await readDirectory(entry, entryPath, files);
      }
    }
  };

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
      // Type guard: ensure data is an array of projects
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

  function handleProjectSelect(id: string) {
    setSelectedProject(id);
    const project = projects.find(p => p.id === id);
    if (project) {
      setSupabaseUrl(`https://${project.db_host}`);
      // Key must be entered manually or fetched via another API if permissions allow
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

  return (
    <motion.div
      ref={menuRef}
      initial="closed"
      animate={open ? 'open' : 'closed'}
      variants={menuVariants}
      className="flex flex-col side-menu fixed top-0 w-[350px] h-full bg-bolt-elements-background-depth-2 border-r rounded-r-3xl border-bolt-elements-borderColor z-sidebar shadow-xl shadow-bolt-elements-sidebar-dropdownShadow text-sm"
    >
      <div className="flex items-center h-[var(--header-height)]">{/* Placeholder */}</div>
      <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
        <div className="p-4 space-y-2">
          <a
            href="/"
            className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
          >
            <span className="inline-block i-bolt:chat scale-110" />
            Start new chat
          </a>
          
          {/* Clone Button */}
          <button
            className={`flex gap-2 items-center w-full rounded-md p-2 transition-theme ${
              githubTokenValid === false 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover'
            }`}
            onClick={() => openGitHubDialog('clone')}
            disabled={githubTokenValid === false}
            title={githubTokenValid === false ? 'GitHub token required (check settings)' : 'Clone from GitHub'}
          >
            <span className="i-ph:git-branch-duotone scale-110" />
            Clone from GitHub
            {githubTokenValid === false && <span className="ml-1 text-xs text-red-500">⚠</span>}
          </button>
          
          {/* Template Button */}
          <button
            className="flex gap-2 items-center w-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
            onClick={() => setTemplateDialogOpen(true)}
            title="Start with a template"
          >
            <span className="i-ph:file-text-duotone scale-110" />
            Start with template
          </button>
          
          {/* Local Folder Button */}
          <button
            className="flex gap-2 items-center w-full bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
            onClick={() => setLocalFolderDialogOpen(true)}
            title="Import from local folder"
          >
            <span className="i-ph:folder-open-duotone scale-110" />
            Import local folder
          </button>
        </div>
        <div className="text-bolt-elements-textPrimary font-medium pl-6 pr-5 my-2">Your Chats</div>
        <div className="flex-1 overflow-scroll pl-4 pr-5 pb-5">
          {list.length === 0 && <div className="pl-2 text-bolt-elements-textTertiary">No previous conversations</div>}
          <DialogRoot open={dialogContent !== null}>
            {binDates(list).map(({ category, items }) => (
              <div key={category} className="mt-4 first:mt-0 space-y-1">
                <div className="text-bolt-elements-textTertiary sticky top-0 z-1 bg-bolt-elements-background-depth-2 pl-2 pt-2 pb-1">
                  {category}
                </div>
                {items.map((item) => (
                  <HistoryItem key={item.id} item={item} onDelete={() => setDialogContent({ type: 'delete', item })} />
                ))}
              </div>
            ))}
            <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
              {dialogContent?.type === 'delete' && (
                <>
                  <DialogTitle>Delete Chat?</DialogTitle>
                  <DialogDescription asChild>
                    <div>
                      <p>
                        You are about to delete <strong>{dialogContent.item.description}</strong>.
                      </p>
                      <p className="mt-1">Are you sure you want to delete this chat?</p>
                    </div>
                  </DialogDescription>
                  <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
                    <DialogButton type="secondary" onClick={closeDialog}>
                      Cancel
                    </DialogButton>
                    <DialogButton
                      type="danger"
                      onClick={(event) => {
                        deleteItem(event, dialogContent.item);
                        closeDialog();
                      }}
                    >
                      Delete
                    </DialogButton>
                  </div>
                </>
              )}
            </Dialog>
          </DialogRoot>
        </div>
        <div className="flex items-center border-t border-bolt-elements-borderColor p-4">
          <IconButton
            className="mr-2"
            icon="i-ph:gear-six-duotone"
            size="xl"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
          />
          <ThemeSwitch className="ml-auto" />
          <SettingsDialog
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      </div>

      {/* GitHub Clone Dialog */}
      <DialogRoot open={githubDialogOpen}>
        <Dialog onBackdrop={() => setGithubDialogOpen(false)} onClose={() => setGithubDialogOpen(false)}>
          <DialogTitle>Clone Repository from GitHub</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                Clone a GitHub repository to start working with its files in the workbench. This will replace any existing files in your current project.
              </p>
              
              {githubTokenValid === false && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-yellow-800 text-sm">
                    GitHub token not set or invalid. Please add your GitHub token in settings.
                  </p>
                </div>
              )}
              
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
                  placeholder="e.g., owner/repo or https://github.com/owner/repo"
                />
                <p className="text-xs text-bolt-elements-textTertiary mt-1">
                  Enter the repository URL in any format: owner/repo, https://github.com/owner/repo, or git@github.com:owner/repo
                </p>
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
                handleCloneRepository();
              }}
            >
              {githubLoading ? 'Processing...' : 'Clone'}
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Template Selection Dialog */}
      <DialogRoot open={templateDialogOpen}>
        <Dialog onBackdrop={() => setTemplateDialogOpen(false)} onClose={() => setTemplateDialogOpen(false)}>
          <DialogTitle>Start with a Template</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                Choose a template to start a new project. This will create a new chat with the template prompt and set up the project structure for you.
              </p>
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {STARTER_TEMPLATES.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => handleTemplateSelect(template)}
                    className="group flex flex-col p-3 border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 transition-all duration-200 text-left"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`${template.icon} text-xl text-bolt-elements-textSecondary`} />
                      <h3 className="font-medium text-bolt-elements-textPrimary">{template.label}</h3>
                    </div>
                    <p className="text-sm text-bolt-elements-textTertiary mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </DialogDescription>
          <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
            <DialogButton type="secondary" onClick={() => setTemplateDialogOpen(false)}>
              Cancel
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Local Folder Import Dialog */}
      <DialogRoot open={localFolderDialogOpen}>
        <Dialog onBackdrop={() => setLocalFolderDialogOpen(false)} onClose={() => setLocalFolderDialogOpen(false)}>
          <DialogTitle>Import Local Folder</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4">
              <p className="text-sm text-bolt-elements-textSecondary mb-4">
                Import files from a local folder on your computer. This will replace any existing files in your current project.
              </p>
              
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2">
                  <div className="i-ph:info text-blue-600 mt-0.5" />
                  <div className="text-blue-800 text-sm">
                    <p className="font-medium mb-1">Browser Support Required</p>
                    <p>This feature requires a modern browser with File System Access API support (Chrome, Edge, or other Chromium-based browsers).</p>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium text-bolt-elements-textPrimary">What files will be imported?</h4>
                <ul className="text-sm text-bolt-elements-textSecondary space-y-1">
                  <li>• Text-based files (code, markdown, config files, etc.)</li>
                  <li>• Files smaller than 1MB</li>
                  <li>• Excludes: node_modules, .git, dist, build folders</li>
                  <li>• Excludes: binary files, .env files, and system files</li>
                </ul>
              </div>
              
              {localFolderError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-red-800 text-sm">{localFolderError}</p>
                </div>
              )}
            </div>
          </DialogDescription>
          <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
            <DialogButton type="secondary" onClick={() => setLocalFolderDialogOpen(false)}>
              Cancel
            </DialogButton>
            <DialogButton 
              type="primary" 
              onClick={handleLocalFolderImport}
              disabled={localFolderLoading}
            >
              {localFolderLoading ? 'Importing...' : 'Select Folder'}
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>
    </motion.div>
  );
}

export function getNetlifyToken() {
  return settingsStore.getServiceToken('netlify');
}

export function getVercelToken() {
  return settingsStore.getServiceToken('vercel');
}

export function getGitHubToken() {
  return settingsStore.getServiceToken('github');
}

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

export async function deployToVercel() {
  const token = getVercelToken();
  if (!token) {
    toast.error('Vercel token not set. Please add it in settings.');
    return;
  }
  
  const alertId = createDeploymentStartAlert('vercel');
  
  try {
    const files = await getAllFilesForDeploy();
    const zipBlob = await createProjectZip(files);
    
    const formData = new FormData();
    formData.append('file', zipBlob, 'project.zip');
    formData.append('name', 'bolt-project');
    
    const res = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    
    const data: any = await res.json();
    
    if (!res.ok) {
      throw new Error(data.error?.message || 'Vercel deploy failed');
    }
    
    const deploymentUrl = `https://${data.url}`;
    createDeploymentSuccessAlert('vercel', deploymentUrl, alertId);
    toast.success(<span>Deployed to Vercel: <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">{data.url}</a></span>, { autoClose: false });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    createDeploymentErrorAlert('vercel', errorMessage, alertId);
    toast.error('Vercel deploy failed: ' + errorMessage);
  }
}

export async function deployToNetlify() {
  const token = getNetlifyToken();
  if (!token) {
    toast.error('Netlify token not set. Please add it in settings.');
    return;
  }
  
  const alertId = createDeploymentStartAlert('netlify');
  
  try {
    const files = await getAllFilesForDeploy();
    const zipBlob = await createProjectZip(files);
    
    const formData = new FormData();
    formData.append('file', zipBlob, 'project.zip');
    formData.append('name', 'bolt-project');
    
    const res = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    
    const data: any = await res.json();
    
    if (!res.ok) {
      throw new Error(data.message || 'Netlify deploy failed');
    }
    
    const deploymentUrl = data.ssl_url || data.url;
    createDeploymentSuccessAlert('netlify', deploymentUrl, alertId);
    toast.success(<span>Deployed to Netlify: <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">{deploymentUrl}</a></span>, { autoClose: false });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    createDeploymentErrorAlert('netlify', errorMessage, alertId);
    toast.error('Netlify deploy failed: ' + errorMessage);
  }
}
