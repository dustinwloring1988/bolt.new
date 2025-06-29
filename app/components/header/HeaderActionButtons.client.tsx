import { useStore } from '@nanostores/react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { CheckpointManager } from '~/components/chat/CheckpointManager';
import { showDeploymentAlertsPanel, deploymentAlerts, showDeploymentAlerts } from '~/lib/stores/deploymentAlerts';
import { deployToNetlify, deployToVercel } from '~/components/sidebar/Menu.client';
import { validateGitHubToken, getGitHubToken } from '~/utils/github';
import JSZip from 'jszip';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const chatState = useStore(chatStore.state);
  const { showChat } = chatState;
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const [showDeployDropdown, setShowDeployDropdown] = useState(false);
  const [showIntegrationsDropdown, setShowIntegrationsDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'not_connected' | 'error'>('not_connected');
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const alerts = useStore(deploymentAlerts);
  const showAlertsPanel = useStore(showDeploymentAlerts);
  
  const deployDropdownRef = useRef<HTMLDivElement>(null);
  const integrationsDropdownRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  
  const alertCount = Object.keys(alerts).length;
  const canHideChat = showWorkbench || !showChat;

  // Handle clicking outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (deployDropdownRef.current && !deployDropdownRef.current.contains(event.target as Node)) {
        setShowDeployDropdown(false);
      }
      if (integrationsDropdownRef.current && !integrationsDropdownRef.current.contains(event.target as Node)) {
        setShowIntegrationsDropdown(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check integration statuses
  useEffect(() => {
    // Check Supabase connection
    const checkSupabaseStatus = async () => {
      const url = localStorage.getItem('bolt_supabase_url');
      const key = localStorage.getItem('bolt_supabase_key');
      
      if (url && key) {
        try {
          const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
          setSupabaseStatus(res.ok ? 'connected' : 'error');
        } catch {
          setSupabaseStatus('error');
        }
      } else {
        setSupabaseStatus('not_connected');
      }
    };

    // Check GitHub connection
    const checkGitHubStatus = async () => {
      const token = getGitHubToken();
      if (token) {
        const isValid = await validateGitHubToken();
        setGithubConnected(isValid);
      } else {
        setGithubConnected(false);
      }
    };

    checkSupabaseStatus();
    checkGitHubStatus();
  }, []);

  // Export functions
  const getAllFilesForExport = async () => {
    await workbenchStore.saveAllFiles();
    const fileMap = workbenchStore.files.get();
    const files: { [key: string]: string } = {};
    for (const [path, dirent] of Object.entries(fileMap)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        files[path.startsWith('/') ? path.slice(1) : path] = dirent.content;
      }
    }
    return files;
  };

  const createProjectZip = async (files: { [key: string]: string }): Promise<Blob> => {
    const zip = new JSZip();
    for (const [path, content] of Object.entries(files)) {
      zip.file(path, content);
    }
    return await zip.generateAsync({ type: 'blob' });
  };

  const handleDownloadZip = async () => {
    try {
      const files = await getAllFilesForExport();
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
      setShowExportDropdown(false);
    } catch (e) {
      toast.error('Failed to download zip: ' + (e instanceof Error ? e.message : e));
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            active={showChat}
            disabled={!canHideChat}
            onClick={() => {
              if (canHideChat) {
                chatStore.toggleChat();
              }
            }}
          >
            <div className="i-ph:chat-text-bold" />
          </Button>
          <div className="w-[1px] bg-bolt-elements-borderColor" />
          <Button
            active={showWorkbench}
            onClick={() => {
              if (showWorkbench && !showChat) {
                chatStore.toggleChat();
              }

              workbenchStore.showWorkbench.set(!showWorkbench);
            }}
          >
            <div className="i-ph:code-bold" />
          </Button>
        </div>
        
        {/* Checkpoint Button */}
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            active={showCheckpoints}
            onClick={() => setShowCheckpoints(!showCheckpoints)}
            title="Checkpoints & Rewind"
          >
            <div className="i-ph:clock-counter-clockwise-bold" />
          </Button>
        </div>
        
      {/* Deploy Dropdown */}
      <div className="relative" ref={deployDropdownRef}>
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            title="Deploy"
            onClick={() => setShowDeployDropdown(!showDeployDropdown)}
          >
            <span className="i-ph:rocket-launch-duotone mr-1" />
            Deploy <span className="ml-1 i-ph:caret-down-bold" />
          </Button>
        </div>
        {showDeployDropdown && (
          <div className="absolute top-full right-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md shadow-lg z-50 min-w-48">
            <button
              className="w-full text-left px-3 py-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary flex items-center"
              onClick={() => {
                deployToNetlify();
                setShowDeployDropdown(false);
              }}
            >
              <span className="i-ph:rocket-launch-duotone text-green-600 mr-2" />
              Deploy to Netlify
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary flex items-center"
              onClick={() => {
                deployToVercel();
                setShowDeployDropdown(false);
              }}
            >
              <span className="i-ph:cloud-arrow-up-duotone text-blue-600 mr-2" />
              Deploy to Vercel
            </button>
          </div>
        )}
      </div>

      {/* Integrations Dropdown */}
      <div className="relative" ref={integrationsDropdownRef}>
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            title="Integrations"
            onClick={() => setShowIntegrationsDropdown(!showIntegrationsDropdown)}
          >
            <span className="i-ph:plug-duotone mr-1" />
            Integrations <span className="ml-1 i-ph:caret-down-bold" />
          </Button>
        </div>
        {showIntegrationsDropdown && (
          <div className="absolute top-full right-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md shadow-lg z-50 min-w-48">
            <button
              className="w-full text-left px-3 py-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary flex items-center justify-between"
              onClick={() => {
                // Open Supabase integration modal in workbench
                workbenchStore.showWorkbench.set(true);
                // Dispatch custom event to open Supabase dialog
                window.dispatchEvent(new CustomEvent('openSupabaseDialog'));
                setShowIntegrationsDropdown(false);
              }}
            >
              <div className="flex items-center">
                <span className="i-ph:database-duotone text-green-600 mr-2" />
                Connect Supabase
              </div>
              <div className={`w-2 h-2 rounded-full ${
                supabaseStatus === 'connected' ? 'bg-green-500' : 
                supabaseStatus === 'error' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
            </button>
            <button
              className="w-full text-left px-3 py-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary flex items-center justify-between"
              onClick={() => {
                // Open GitHub integration modal in workbench  
                workbenchStore.showWorkbench.set(true);
                // Dispatch custom event to open GitHub dialog
                window.dispatchEvent(new CustomEvent('openGitHubDialog', { detail: { type: 'clone' } }));
                setShowIntegrationsDropdown(false);
              }}
            >
              <div className="flex items-center">
                <span className="i-ph:git-branch-duotone text-purple-600 mr-2" />
                Connect GitHub
              </div>
              <div className={`w-2 h-2 rounded-full ${
                githubConnected === true ? 'bg-green-500' : 
                githubConnected === false ? 'bg-red-500' : 'bg-gray-400'
              }`} />
            </button>
          </div>
        )}
      </div>

      {/* Export Dropdown */}
      <div className="relative" ref={exportDropdownRef}>
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            title="Export"
            onClick={() => setShowExportDropdown(!showExportDropdown)}
          >
            <span className="i-ph:download-simple-duotone mr-1" />
            Export <span className="ml-1 i-ph:caret-down-bold" />
          </Button>
        </div>
        {showExportDropdown && (
          <div className="absolute top-full right-0 mt-1 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-md shadow-lg z-50 min-w-48">
            <button
              className="w-full text-left px-3 py-2 hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textPrimary hover:text-bolt-elements-textPrimary flex items-center"
              onClick={handleDownloadZip}
            >
              <span className="i-ph:file-zip-duotone text-orange-600 mr-2" />
              Download as ZIP
            </button>
          </div>
        )}
      </div>

      {/* Deployment Alerts Button (remains unchanged) */}
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showAlertsPanel}
          onClick={() => showDeploymentAlertsPanel()}
          title={`Deployment Alerts${alertCount > 0 ? ` (${alertCount})` : ''}`}
        >
          <div className="relative">
            <div className="i-ph:bell-bold" />
            {alertCount > 0 && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {alertCount > 9 ? '9+' : alertCount}
              </div>
            )}
          </div>
        </Button>
      </div>
      </div>
      
      {/* Checkpoint Manager Modal */}
      <CheckpointManager 
        isOpen={showCheckpoints} 
        onClose={() => setShowCheckpoints(false)} 
      />
    </>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  title?: string;
}

function Button({ active = false, disabled = false, children, onClick, title }: ButtonProps) {
  return (
    <button
      className={classNames('flex items-center p-1.5', {
        'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
          !active,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
        'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
          disabled,
      })}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
