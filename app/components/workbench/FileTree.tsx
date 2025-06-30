import * as ContextMenu from '@radix-ui/react-context-menu';
import { memo, useEffect, useMemo, useState, type ReactNode, useCallback } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  lockedFiles?: Set<string>;
  onLockFile?: (filePath: string) => void;
  onUnlockFile?: (filePath: string) => void;
  searchQuery?: string;
  className?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
    lockedFiles = new Set(),
    onLockFile,
    onUnlockFile,
    searchQuery,
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState(() => {
      return collapsed
        ? new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath))
        : new Set<string>();
    });

    const handleContextMenu = useCallback((_fileOrFolder: any, _e: React.MouseEvent) => {
      // no-op: ContextMenu handles open/position
    }, []);

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
        return;
      }

      setCollapsedFolders((prevCollapsed) => {
        const newCollapsed = new Set<string>();

        for (const folder of fileList) {
          if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
            newCollapsed.add(folder.fullPath);
          }
        }

        return newCollapsed;
      });
    }, [fileList, collapsed]);

    const filteredFileList = useMemo(() => {
      let list = [];
      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileOrFolder of fileList) {
        const depth = fileOrFolder.depth;

        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        if (collapsedFolders.has(fileOrFolder.fullPath)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        if (lastDepth < depth) {
          continue;
        }

        list.push(fileOrFolder);
      }

      // filter by search query (file name only for now)
      if (searchQuery && searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        list = list.filter((item) => item.kind === 'file' && item.name.toLowerCase().includes(q));
      }

      return list;
    }, [fileList, collapsedFolders, searchQuery]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders((prevSet) => {
        const newSet = new Set(prevSet);

        if (newSet.has(fullPath)) {
          newSet.delete(fullPath);
        } else {
          newSet.add(fullPath);
        }

        return newSet;
      });
    };

    return (
      <div className={classNames('text-sm', className)}>
        {filteredFileList.map((fileOrFolder) => {
          switch (fileOrFolder.kind) {
            case 'file': {
              const isLocked = lockedFiles.has(fileOrFolder.fullPath);
              return (
                <ContextMenu.Root>
                  <ContextMenu.Trigger asChild>
                    <div>
                      <File
                        key={fileOrFolder.id}
                        selected={selectedFile === fileOrFolder.fullPath}
                        file={fileOrFolder}
                        unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                        locked={isLocked}
                        onClick={() => {
                          onFileSelect?.(fileOrFolder.fullPath);
                        }}
                        onContextMenu={(e) => handleContextMenu(fileOrFolder, e)}
                      />
                    </div>
                  </ContextMenu.Trigger>
                  <ContextMenu.Content className="bg-bolt-elements-background-depth-2 rounded shadow-lg border border-bolt-elements-borderColor p-1 min-w-[160px]">
                    <ContextMenu.Item
                      onSelect={() => {
                        onFileSelect?.(fileOrFolder.fullPath);
                      }}
                    >
                      Open
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      disabled={isLocked}
                      onSelect={async () => {
                        const newName = prompt('Enter new file name', fileOrFolder.fullPath.split('/').pop());

                        if (newName && newName !== fileOrFolder.fullPath.split('/').pop()) {
                          const newPath = fileOrFolder.fullPath.split('/').slice(0, -1).concat(newName).join('/');

                          try {
                            await workbenchStore.renameFile(fileOrFolder.fullPath, newPath);
                          } catch (e) {
                            alert((e as Error).message);
                          }
                        }
                      }}
                    >
                      Rename
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      disabled={isLocked}
                      onSelect={async () => {
                        if (confirm('Are you sure you want to delete this file?')) {
                          try {
                            await workbenchStore.deleteFile(fileOrFolder.fullPath);
                          } catch (e) {
                            alert((e as Error).message);
                          }
                        }
                      }}
                    >
                      Delete
                    </ContextMenu.Item>
                    <ContextMenu.Separator />
                    {isLocked ? (
                      <ContextMenu.Item
                        onSelect={() => {
                          onUnlockFile?.(fileOrFolder.fullPath);
                        }}
                      >
                        Unlock
                      </ContextMenu.Item>
                    ) : (
                      <ContextMenu.Item
                        onSelect={() => {
                          onLockFile?.(fileOrFolder.fullPath);
                        }}
                      >
                        Lock
                      </ContextMenu.Item>
                    )}
                  </ContextMenu.Content>
                </ContextMenu.Root>
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileOrFolder.id}
                  folder={fileOrFolder}
                  selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                  collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    toggleCollapseState(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            default: {
              return undefined;
            }
          }
        })}
        {filteredFileList.length === 0 && searchQuery && searchQuery.trim() !== '' ? (
          <div className="p-2 text-xs text-bolt-elements-textTertiary">No files found.</div>
        ) : null}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onClick: () => void;
}

function Folder({ folder: { depth, name }, collapsed, selected = false, onClick }: FolderProps) {
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive':
          !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={classNames({
        'i-ph:caret-right scale-98': collapsed,
        'i-ph:caret-down scale-98': !collapsed,
      })}
      onClick={onClick}
    >
      {name}
    </NodeButton>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  locked: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function File({ file: { depth, name }, onClick, selected, unsavedChanges = false, locked }: FileProps) {
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentDefault': !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={classNames('i-ph:file-duotone scale-98', {
        'group-hover:text-bolt-elements-item-contentActive': !selected,
      })}
      onClick={onClick}
    >
      <div
        className={classNames('flex items-center', {
          'group-hover:text-bolt-elements-item-contentActive': !selected,
        })}
      >
        <div className="flex-1 truncate pr-2">{name}</div>
        {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
        {locked && <span className="i-ph:lock-key-duotone scale-68 shrink-0 text-gray-500" />}
      </div>
    </NodeButton>
  );
}

interface ButtonProps {
  depth: number;
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-1.5 w-full pr-2 border-2 border-transparent text-faded py-0.5',
        className,
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={() => onClick?.()}
    >
      <div className={classNames('scale-120 shrink-0', iconClasses)}></div>
      <div className="truncate w-full text-left">{children}</div>
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}
