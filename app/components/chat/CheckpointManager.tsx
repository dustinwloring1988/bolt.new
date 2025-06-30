import { motion } from 'framer-motion';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import { Dialog, DialogRoot, DialogTitle, DialogDescription, DialogButton } from '~/components/ui/Dialog';
import { IconButton } from '~/components/ui/IconButton';
import type { Checkpoint } from '~/lib/persistence/types';
import { useChatHistory } from '~/lib/persistence/useChatHistory';

interface CheckpointManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CheckpointManager({ isOpen, onClose }: CheckpointManagerProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [checkpointName, setCheckpointName] = useState('');
  const [checkpointDescription, setCheckpointDescription] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { createCheckpoint, loadCheckpoints, restoreCheckpoint, removeCheckpoint } = useChatHistory();

  const refreshCheckpoints = useCallback(async () => {
    setLoading(true);

    try {
      const loadedCheckpoints = await loadCheckpoints();
      setCheckpoints(loadedCheckpoints);
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
    } finally {
      setLoading(false);
    }
  }, [loadCheckpoints]);

  useEffect(() => {
    if (isOpen) {
      refreshCheckpoints();
    }
  }, [isOpen, refreshCheckpoints]);

  const handleCreateCheckpoint = async () => {
    if (!checkpointName.trim()) {
      toast.error('Please enter a checkpoint name');
      return;
    }

    try {
      await createCheckpoint(checkpointName, checkpointDescription || undefined);
      setCheckpointName('');
      setCheckpointDescription('');
      setShowCreateDialog(false);
      refreshCheckpoints();
    } catch (error) {
      console.error('Failed to create checkpoint:', error);
    }
  };

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    try {
      await restoreCheckpoint(checkpointId);
      onClose();
    } catch (error) {
      console.error('Failed to restore checkpoint:', error);
    }
  };

  const handleDeleteCheckpoint = async (checkpointId: string) => {
    try {
      await removeCheckpoint(checkpointId);
      setDeleteConfirm(null);
      refreshCheckpoints();
    } catch (error) {
      console.error('Failed to delete checkpoint:', error);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-bolt-elements-background-depth-2 rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
          <div>
            <h2 className="text-xl font-semibold text-bolt-elements-textPrimary">Checkpoints & Rewind</h2>
            <p className="text-sm text-bolt-elements-textSecondary mt-1">
              Save and restore chat messages and workbench state
            </p>
          </div>
          <div className="flex gap-2">
            <IconButton
              icon="i-ph:plus"
              title="Create Checkpoint"
              onClick={() => setShowCreateDialog(true)}
              className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover"
            />
            <IconButton icon="i-ph:x" title="Close" onClick={onClose} />
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-bolt-elements-textPrimary"></div>
            </div>
          ) : checkpoints.length === 0 ? (
            <div className="text-center py-8 text-bolt-elements-textSecondary">
              <div className="text-4xl mb-4">📸</div>
              <p>No checkpoints yet</p>
              <p className="text-sm mt-2">Create a checkpoint to save your current progress</p>
            </div>
          ) : (
            <div className="space-y-4">
              {checkpoints.map((checkpoint) => (
                <motion.div
                  key={checkpoint.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-bolt-elements-borderColor rounded-lg p-4 hover:border-bolt-elements-focus transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-bolt-elements-textPrimary">{checkpoint.name}</h3>
                        {checkpoint.isAutoSave && (
                          <span className="text-xs bg-bolt-elements-button-secondary-background text-bolt-elements-button-secondary-text px-2 py-1 rounded">
                            Auto-save
                          </span>
                        )}
                      </div>
                      {checkpoint.description && (
                        <p className="text-sm text-bolt-elements-textSecondary mb-2">{checkpoint.description}</p>
                      )}
                      <div className="text-xs text-bolt-elements-textTertiary">
                        {formatTimestamp(checkpoint.timestamp)} • {checkpoint.messageCount} messages •{' '}
                        {Object.keys(checkpoint.files).length} files
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <IconButton
                        icon="i-ph:clock-counter-clockwise"
                        title="Restore chat and workbench to this checkpoint"
                        size="sm"
                        onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                        className="bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text"
                      />
                      <IconButton
                        icon="i-ph:trash"
                        title="Delete checkpoint"
                        size="sm"
                        onClick={() => setDeleteConfirm(checkpoint.id)}
                        className="text-bolt-elements-button-danger-text hover:bg-bolt-elements-button-danger-background"
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Create Checkpoint Dialog */}
      <DialogRoot open={showCreateDialog}>
        <Dialog onBackdrop={() => setShowCreateDialog(false)} onClose={() => setShowCreateDialog(false)}>
          <DialogTitle>Create Checkpoint</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                  Checkpoint Name *
                </label>
                <input
                  type="text"
                  value={checkpointName}
                  onChange={(e) => setCheckpointName(e.target.value)}
                  placeholder="e.g., Before major refactor"
                  className="w-full px-3 py-2 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-prompt-background text-bolt-elements-textPrimary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={checkpointDescription}
                  onChange={(e) => setCheckpointDescription(e.target.value)}
                  placeholder="Describe what this checkpoint represents..."
                  rows={3}
                  className="w-full px-3 py-2 border border-bolt-elements-borderColor rounded-md bg-bolt-elements-prompt-background text-bolt-elements-textPrimary resize-none"
                />
              </div>
            </div>
          </DialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <DialogButton type="secondary" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </DialogButton>
            <DialogButton type="primary" onClick={handleCreateCheckpoint}>
              Create Checkpoint
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>

      {/* Delete Confirmation Dialog */}
      <DialogRoot open={deleteConfirm !== null}>
        <Dialog onBackdrop={() => setDeleteConfirm(null)} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle>Delete Checkpoint?</DialogTitle>
          <DialogDescription asChild>
            <div>
              <p>Are you sure you want to delete this checkpoint? This action cannot be undone.</p>
            </div>
          </DialogDescription>
          <div className="flex gap-2 justify-end mt-6">
            <DialogButton type="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </DialogButton>
            <DialogButton type="danger" onClick={() => deleteConfirm && handleDeleteCheckpoint(deleteConfirm)}>
              Delete
            </DialogButton>
          </div>
        </Dialog>
      </DialogRoot>
    </div>
  );
}
