import { motion, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { HistoryItem } from './HistoryItem';
import { binDates } from './date-binning';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle, SettingsDialog } from '~/components/ui/Dialog';
import { ThemeSwitch } from '~/components/ui/ThemeSwitch';
import { db, deleteById, getAll, chatId, type ChatHistoryItem } from '~/lib/persistence';
import { cubicEasingFn } from '~/utils/easings';
import { logger } from '~/utils/logger';
import { workbenchStore } from '~/lib/stores/workbench';
import JSZip from 'jszip';
import { IconButton } from '~/components/ui/IconButton';

declare global {
  interface Window {
    syncSupabaseEnv?: (url: string, key: string) => Promise<void>;
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
  const [settingsInitial, setSettingsInitial] = useState({ netlify: '', supabase: '', vercel: '', github: '' });
  const [supabaseDialogOpen, setSupabaseDialogOpen] = useState(false);
  const [supabaseUrl, setSupabaseUrl] = useState(localStorage.getItem('bolt_supabase_url') || '');
  const [supabaseKey, setSupabaseKey] = useState(localStorage.getItem('bolt_supabase_key') || '');
  const [supabaseToken, setSupabaseToken] = useState(localStorage.getItem('bolt_supabase_token') || '');
  const [projects, setProjects] = useState<{ id: string; name: string; db_host: string; }[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [status, setStatus] = useState<'connected' | 'not_connected' | 'error'>('not_connected');
  const [error, setError] = useState<string>('');

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
    if (settingsOpen) {
      setSettingsInitial({
        netlify: localStorage.getItem('bolt_token_netlify') || '',
        supabase: localStorage.getItem('bolt_token_supabase') || '',
        vercel: localStorage.getItem('bolt_token_vercel') || '',
        github: localStorage.getItem('bolt_token_github') || '',
      });
    }
  }, [settingsOpen]);

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

  function handleSettingsSave(tokens: { netlify: string; supabase: string; vercel: string; github: string }) {
    localStorage.setItem('bolt_token_netlify', tokens.netlify);
    localStorage.setItem('bolt_token_supabase', tokens.supabase);
    localStorage.setItem('bolt_token_vercel', tokens.vercel);
    localStorage.setItem('bolt_token_github', tokens.github);
    setSettingsOpen(false);
  }

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
        <div className="p-4">
          <a
            href="/"
            className="flex gap-2 items-center bg-bolt-elements-sidebar-buttonBackgroundDefault text-bolt-elements-sidebar-buttonText hover:bg-bolt-elements-sidebar-buttonBackgroundHover rounded-md p-2 transition-theme"
          >
            <span className="inline-block i-bolt:chat scale-110" />
            Start new chat
          </a>
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
            initialValues={settingsInitial}
            onSave={handleSettingsSave}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Utility to get Netlify token from localStorage
export function getNetlifyToken() {
  return localStorage.getItem('bolt_token_netlify') || '';
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
  const files = await getAllFilesForDeploy();
  const zipBlob = await createProjectZip(files);
  toast.info('Deploying to Vercel...');
  try {
    const formData = new FormData();
    formData.append('file', zipBlob, 'project.zip');
    formData.append('name', 'bolt-project');
    // Vercel API expects a JSON file map, but for demo, we send a zip as a file upload (for real use, may need to use their CLI or API with file map)
    const res = await fetch('https://api.vercel.com/v13/deployments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.error?.message || 'Vercel deploy failed');
    toast.success(<span>Deployed to Vercel: <a href={`https://${data.url}`} target="_blank" rel="noopener noreferrer">{data.url}</a></span>, { autoClose: false });
  } catch (e) {
    toast.error('Vercel deploy failed: ' + (e instanceof Error ? e.message : e));
  }
}

export async function deployToNetlify() {
  const token = getNetlifyToken();
  if (!token) {
    toast.error('Netlify token not set. Please add it in settings.');
    return;
  }
  const files = await getAllFilesForDeploy();
  const zipBlob = await createProjectZip(files);
  toast.info('Deploying to Netlify...');
  try {
    const formData = new FormData();
    formData.append('file', zipBlob, 'project.zip');
    formData.append('name', 'bolt-project');
    // Netlify API expects a zip upload for some endpoints; for demo, we send as file upload (for real use, may need to use their CLI or API with file map)
    const res = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
    const data: any = await res.json();
    if (!res.ok) throw new Error(data.message || 'Netlify deploy failed');
    toast.success(<span>Deployed to Netlify: <a href={data.ssl_url} target="_blank" rel="noopener noreferrer">{data.ssl_url}</a></span>, { autoClose: false });
  } catch (e) {
    toast.error('Netlify deploy failed: ' + (e instanceof Error ? e.message : e));
  }
}

// Utility to get Vercel token from localStorage
export function getVercelToken() {
  return localStorage.getItem('bolt_token_vercel') || '';
}
