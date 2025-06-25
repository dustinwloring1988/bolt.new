import * as Dialog from '@radix-ui/react-dialog';
import React, { useEffect, useRef, useState, FormEvent } from 'react';
import { type ChatHistoryItem } from '~/lib/persistence';

interface HistoryItemProps {
  item: ChatHistoryItem;
  onDelete?: (event: React.UIEvent) => void;
  onRename?: (item: ChatHistoryItem, newName: string) => void;
}

export function HistoryItem({ item, onDelete, onRename }: HistoryItemProps) {
  const [hovering, setHovering] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(item.description || "");
  const hoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    function mouseEnter() {
      setHovering(true);

      if (timeout) {
        clearTimeout(timeout);
      }
    }

    function mouseLeave() {
      setHovering(false);
    }

    hoverRef.current?.addEventListener('mouseenter', mouseEnter);
    hoverRef.current?.addEventListener('mouseleave', mouseLeave);

    return () => {
      hoverRef.current?.removeEventListener('mouseenter', mouseEnter);
      hoverRef.current?.removeEventListener('mouseleave', mouseLeave);
    };
  }, []);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [renaming]);

  const handleRename = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (onRename && newName.trim()) {
      onRename(item, newName.trim());
      setRenaming(false);
    }
  };

  return (
    <div
      ref={hoverRef}
      className="group rounded-md text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary hover:bg-bolt-elements-background-depth-3 overflow-hidden flex justify-between items-center px-2 py-1"
    >
      {renaming ? (
        <form onSubmit={handleRename} className="flex w-full items-center gap-2">
          <input
            ref={inputRef}
            className="flex-1 rounded px-2 py-1 border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={() => setRenaming(false)}
            maxLength={100}
          />
          <button type="submit" className="i-ph:check scale-110 text-green-600" title="Save" />
        </form>
      ) : (
        <a href={`/chat/${item.urlId}`} className="flex w-full relative truncate block">
          {item.description}
          <div className="absolute right-0 z-1 top-0 bottom-0 bg-gradient-to-l from-bolt-elements-background-depth-2 group-hover:from-bolt-elements-background-depth-3 to-transparent w-10 flex justify-end group-hover:w-15 group-hover:from-45%">
            {hovering && (
              <div className="flex items-center p-1 text-bolt-elements-textSecondary gap-2">
                <button
                  className="i-ph:pencil-simple scale-110"
                  title="Rename"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    setRenaming(true);
                  }}
                />
                <Dialog.Trigger asChild>
                  <button
                    className="i-ph:trash scale-110"
                    onClick={(event: React.UIEvent) => {
                      event.preventDefault();
                      onDelete?.(event);
                    }}
                  />
                </Dialog.Trigger>
              </div>
            )}
          </div>
        </a>
      )}
    </div>
  );
}
