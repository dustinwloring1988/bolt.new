import { useStore } from '@nanostores/react';
import { useState } from 'react';
import { chatStore } from '~/lib/stores/chat';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { CheckpointManager } from '~/components/chat/CheckpointManager';
import { showDeploymentAlertsPanel, deploymentAlerts, showDeploymentAlerts } from '~/lib/stores/deploymentAlerts';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const [showCheckpoints, setShowCheckpoints] = useState(false);
  const alerts = useStore(deploymentAlerts);
  const showAlertsPanel = useStore(showDeploymentAlerts);
  
  const alertCount = Object.keys(alerts).length;
  const canHideChat = showWorkbench || !showChat;

  return (
    <>
      <div className="flex gap-2">
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
          <Button
            active={showChat}
            disabled={!canHideChat}
            onClick={() => {
              if (canHideChat) {
                chatStore.setKey('showChat', !showChat);
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
                chatStore.setKey('showChat', true);
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
        
        {/* Deployment Alerts Button */}
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
