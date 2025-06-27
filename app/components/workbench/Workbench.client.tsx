import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import * as React from 'react';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
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
import JSZip from 'jszip';
import { deployToNetlify, deployToVercel } from '~/components/sidebar/Menu.client';

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
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
              </div>
            </div>
          </div>
        </div>
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
