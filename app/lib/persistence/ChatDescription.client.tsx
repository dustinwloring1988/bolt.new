import { useStore } from '@nanostores/react';
import { useState, useCallback } from 'react';
import { description } from './useChatHistory';
import { useChatHistory } from './useChatHistory';

export function ChatDescription() {
  const currentDescription = useStore(description);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const { updateDescription } = useChatHistory();

  const handleStartEdit = useCallback(() => {
    setEditValue(currentDescription || '');
    setIsEditing(true);
  }, [currentDescription]);

  const handleSave = useCallback(async () => {
    if (!editValue.trim()) {
      setIsEditing(false);
      return;
    }

    const success = await updateDescription(editValue.trim());
    if (success) {
      setIsEditing(false);
    }
  }, [editValue, updateDescription]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue('');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full max-w-md">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          autoFocus
          maxLength={100}
          className="flex-1 bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary px-3 py-1 rounded-md border border-bolt-elements-borderColor focus:outline-none focus:border-bolt-elements-focus text-sm"
          placeholder="Enter chat title..."
        />
        <button
          onClick={handleSave}
          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          title="Save (Enter)"
        >
          <div className="i-ph:check text-lg" />
        </button>
        <button
          onClick={handleCancel}
          className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          title="Cancel (Escape)"
        >
          <div className="i-ph:x text-lg" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:text-bolt-elements-textSecondary transition-colors group flex items-center gap-2"
      onClick={handleStartEdit}
      title="Click to edit chat title"
    >
      <span className="truncate">{currentDescription || 'Untitled Chat'}</span>
      <div className="i-ph:pencil-simple text-sm opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
