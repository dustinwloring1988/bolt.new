import * as RadixDialog from '@radix-ui/react-dialog';
import { motion, type Variants } from 'framer-motion';
import React, { memo, type ReactNode, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { IconButton } from './IconButton';
import { db, exportAllChats, deleteAllChats } from '~/lib/persistence';
import { chatStore } from '~/lib/stores/chat';
import { settingsStore, type ServiceTokens } from '~/lib/stores/settings';
import { classNames } from '~/utils/classNames';
import { downloadFile, formatDate } from '~/utils/download';
import { cubicEasingFn } from '~/utils/easings';

export { Close as DialogClose, Root as DialogRoot } from '@radix-ui/react-dialog';

const transition = {
  duration: 0.15,
  ease: cubicEasingFn,
};

export const dialogBackdropVariants = {
  closed: {
    opacity: 0,
    transition,
  },
  open: {
    opacity: 1,
    transition,
  },
} satisfies Variants;

export const dialogVariants = {
  closed: {
    x: '-50%',
    y: '-40%',
    scale: 0.96,
    opacity: 0,
    transition,
  },
  open: {
    x: '-50%',
    y: '-50%',
    scale: 1,
    opacity: 1,
    transition,
  },
} satisfies Variants;

interface DialogButtonProps {
  type: 'primary' | 'secondary' | 'danger';
  children: ReactNode;
  onClick?: (event: React.UIEvent) => void;
  disabled?: boolean;
  className?: string;
}

export const DialogButton = memo(({ type, children, onClick, disabled, className }: DialogButtonProps) => {
  return (
    <button
      className={classNames(
        'inline-flex h-[35px] items-center justify-center rounded-lg px-4 text-sm leading-none focus:outline-none',
        {
          'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover':
            type === 'primary',
          'bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text hover:bg-bolt-elements-button-secondary-backgroundHover':
            type === 'secondary',
          'bg-bolt-elements-button-danger-background text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-backgroundHover':
            type === 'danger',
        },
        className,
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

export const DialogTitle = memo(({ className, children, ...props }: RadixDialog.DialogTitleProps) => {
  return (
    <RadixDialog.Title
      className={classNames(
        'px-5 py-4 flex items-center justify-between border-b border-bolt-elements-borderColor text-lg font-semibold leading-6 text-bolt-elements-textPrimary',
        className,
      )}
      {...props}
    >
      {children}
    </RadixDialog.Title>
  );
});

export const DialogDescription = memo(({ className, children, ...props }: RadixDialog.DialogDescriptionProps) => {
  return (
    <RadixDialog.Description
      className={classNames('px-5 py-4 text-bolt-elements-textPrimary text-md', className)}
      {...props}
    >
      {children}
    </RadixDialog.Description>
  );
});

interface DialogProps {
  children: ReactNode | ReactNode[];
  className?: string;
  onBackdrop?: (event: React.UIEvent) => void;
  onClose?: (event: React.UIEvent) => void;
}

export const Dialog = memo(({ className, children, onBackdrop, onClose }: DialogProps) => {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay onClick={onBackdrop} asChild>
        <motion.div
          className="bg-black/50 fixed inset-0 z-max"
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogBackdropVariants}
        />
      </RadixDialog.Overlay>
      <RadixDialog.Content asChild>
        <motion.div
          className={classNames(
            'fixed top-[50%] left-[50%] z-max max-h-[85vh] w-[90vw] max-w-[450px] translate-x-[-50%] translate-y-[-50%] border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-2 shadow-lg focus:outline-none overflow-hidden',
            className,
          )}
          initial="closed"
          animate="open"
          exit="closed"
          variants={dialogVariants}
        >
          {children}
          <RadixDialog.Close asChild onClick={onClose}>
            <IconButton icon="i-ph:x" className="absolute top-[10px] right-[10px]" />
          </RadixDialog.Close>
        </motion.div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
});

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tokens, setTokens] = useState<ServiceTokens>({
    netlify: '',
    vercel: '',
    github: '',
  });

  const [chatManagementOpen, setChatManagementOpen] = useState(false);

  // load current settings when dialog opens
  useEffect(() => {
    if (open) {
      const currentTokens = settingsStore.getServiceTokens();
      setTokens(currentTokens);
    }
  }, [open]);

  const handleExportAllChats = async () => {
    if (!db) {
      toast.error('Database not available.');
      return;
    }

    try {
      const exportData = await exportAllChats(db);
      const filename = `bolt-chats-export-${formatDate(new Date())}.json`;
      downloadFile(exportData, filename);
      toast.success('All chats exported successfully!');
    } catch (error) {
      console.error('Failed to export chats:', error);
      toast.error('Failed to export chats.');
    }
  };

  const handleDeleteAllChats = async () => {
    if (!db) {
      toast.error('Database not available.');
      return;
    }

    try {
      await deleteAllChats(db);
      // clear current chat state
      chatStore.reset();
      // redirect to home page
      window.location.href = '/';
      toast.success('All chats deleted successfully!');
      setChatManagementOpen(false);
    } catch (error) {
      console.error('Failed to delete all chats:', error);
      toast.error('Failed to delete all chats.');
    }
  };

  const handleSave = () => {
    // save tokens to settings store
    settingsStore.updateServiceTokens(tokens);
    toast.success('Settings saved successfully!');
    onClose();
  };

  return (
    <>
      <RadixDialog.Root open={open}>
        <Dialog onBackdrop={onClose} onClose={onClose}>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-6">
              {/* Service Tokens Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 text-bolt-elements-textPrimary">Service Tokens</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1">Netlify Token</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                      value={tokens.netlify}
                      onChange={(e) => setTokens((t) => ({ ...t, netlify: e.target.value }))}
                      placeholder="Enter Netlify token"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">Vercel Token</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                      value={tokens.vercel}
                      onChange={(e) => setTokens((t) => ({ ...t, vercel: e.target.value }))}
                      placeholder="Enter Vercel token"
                    />
                  </div>
                  <div>
                    <label className="block font-medium mb-1">GitHub Token</label>
                    <input
                      type="text"
                      className="w-full px-2 py-1 rounded border border-bolt-elements-borderColor bg-bolt-elements-background-depth-1"
                      value={tokens.github}
                      onChange={(e) => setTokens((t) => ({ ...t, github: e.target.value }))}
                      placeholder="Enter GitHub token"
                    />
                  </div>
                </div>
              </div>

              {/* Chat Management Section */}
              <div className="border-t border-bolt-elements-borderColor pt-4">
                <h3 className="text-lg font-medium mb-3 text-bolt-elements-textPrimary">Chat Management</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Export All Chats</p>
                      <p className="text-sm text-bolt-elements-textSecondary">
                        Download all your chat history as a JSON file
                      </p>
                    </div>
                    <DialogButton type="secondary" onClick={handleExportAllChats}>
                      Export
                    </DialogButton>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Delete All Chats</p>
                      <p className="text-sm text-bolt-elements-textSecondary">Permanently remove all chat history</p>
                    </div>
                    <DialogButton type="danger" onClick={() => setChatManagementOpen(true)}>
                      Delete All
                    </DialogButton>
                  </div>
                </div>
              </div>
            </div>
          </DialogDescription>
          <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
            <DialogButton type="secondary" onClick={onClose}>
              Cancel
            </DialogButton>
            <DialogButton type="primary" onClick={handleSave}>
              Save
            </DialogButton>
          </div>
        </Dialog>
      </RadixDialog.Root>

      {/* Confirmation Dialog for Delete All Chats */}
      <RadixDialog.Root open={chatManagementOpen}>
        <Dialog onBackdrop={() => setChatManagementOpen(false)} onClose={() => setChatManagementOpen(false)}>
          <DialogTitle>Delete All Chats?</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p className="mb-3">
                <strong>Warning:</strong> This action cannot be undone.
              </p>
              <p>
                You are about to permanently delete all your chat history, including all conversations, snapshots, and
                checkpoints.
              </p>
              <p className="mt-3 text-bolt-elements-textSecondary">
                Consider exporting your chats first if you want to keep a backup.
              </p>
            </div>
          </DialogDescription>
          <div className="px-5 pb-4 bg-bolt-elements-background-depth-2 flex gap-2 justify-end">
            <DialogButton type="secondary" onClick={() => setChatManagementOpen(false)}>
              Cancel
            </DialogButton>
            <DialogButton type="danger" onClick={handleDeleteAllChats}>
              Delete All Chats
            </DialogButton>
          </div>
        </Dialog>
      </RadixDialog.Root>
    </>
  );
}
