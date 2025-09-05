import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { FileNode } from '../types.ts';
import { FileIcon, FolderIcon } from './icons.tsx';

// --- PROPS & HELPER COMPONENT INTERFACES ---

interface ContextMenuProps {
  menu: { x: number; y: number; path: string; type: 'file' | 'folder' } | null;
  actions: {
    onNewFile: (path: string) => void;
    onNewDirectory: (path: string) => void;
    onRename: (path: string) => void;
    onDelete: (path: string) => void;
  };
  onClose: () => void;
}

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  activeFile: string | null;
  onNewFile: (path: string) => void;
  onNewDirectory: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
}


// --- HELPER COMPONENTS ---

const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);

const ContextMenu: React.FC<ContextMenuProps> = ({ menu, actions, onClose }) => {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    document.addEventListener('click', handleClickOutside, true);
    document.addEventListener('contextmenu', handleClickOutside, true);
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('contextmenu', handleClickOutside, true);
    };
  }, [onClose]);

  if (!menu) return null;

  const menuItems = menu.type === 'folder' 
    ? ['New File', 'New Folder', 'Rename', 'Delete'] 
    : ['Rename', 'Delete'];

  const handleAction = (item: string) => {
    const promptForName = (action: (path: string) => void, type: string) => {
        const name = window.prompt(`Enter new ${type} name:`);
        if (name && name.trim()) {
            const newPath = menu.path ? `${menu.path}/${name.trim()}` : name.trim();
            action(newPath);
        }
    };
    
    switch (item) {
        case 'New File':
            promptForName(actions.onNewFile, 'file');
            break;
        case 'New Folder':
            promptForName(actions.onNewDirectory, 'folder');
            break;
        case 'Rename':
            actions.onRename(menu.path);
            break;
        case 'Delete':
            if (window.confirm(`Are you sure you want to delete ${menu.path}?`)) {
                actions.onDelete(menu.path);
            }
            break;
    }
  };

  return (
    <div
      style={{ top: menu.y, left: menu.x }}
      className="absolute bg-gray-800 border border-green-600 p-1 z-50 text-xs"
    >
      {menuItems.map(item => (
        <button
          key={item}
          onClick={() => {
            handleAction(item);
            onClose();
          }}
          className="block w-full text-left px-2 py-1 hover:bg-green-700"
        >
          {item}
        </button>
      ))}
    </div>
  );
};


// --- MAIN COMPONENT ---

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect, activeFile, onNewFile, onNewDirectory, onRename, onDelete }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [contextMenu, setContextMenu] = useState<ContextMenuProps['menu']>(null);
    const [renamingNode, setRenamingNode] = useState<string | null>(null);
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src']));
    const renameInputRef = useRef<HTMLInputElement>(null);
    
    // File filtering logic
    const filteredFiles = useMemo(() => {
        if (!searchQuery.trim()) {
            return files;
        }
        const lowerCaseQuery = searchQuery.toLowerCase();
        
        function filterNodes(nodes: FileNode[]): FileNode[] {
            const result: FileNode[] = [];
            for (const node of nodes) {
                if (node.children) { // Folder
                    const filteredChildren = filterNodes(node.children);
                    if (filteredChildren.length > 0 || node.name.toLowerCase().includes(lowerCaseQuery)) {
                        result.push({ ...node, children: filteredChildren });
                    }
                } else { // File
                    if (node.name.toLowerCase().includes(lowerCaseQuery)) {
                        result.push(node);
                    }
                }
            }
            return result;
        }
        return filterNodes(files);
    }, [files, searchQuery]);

    // Auto-expand folders on search
    useEffect(() => {
        if (searchQuery.trim()) {
            const allFolderPaths = new Set<string>();
            const findFolders = (nodes: FileNode[], path: string) => {
                for (const node of nodes) {
                    const currentPath = path ? `${path}/${node.name}` : node.name;
                    if (node.children) {
                        allFolderPaths.add(currentPath);
                        findFolders(node.children, currentPath);
                    }
                }
            };
            findFolders(filteredFiles, '');
            setExpandedFolders(allFolderPaths);
        } else {
            setExpandedFolders(new Set(['src'])); // Revert to default
        }
    }, [searchQuery, filteredFiles]);

    useEffect(() => {
        if (renamingNode && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingNode]);

    const handleToggleFolder = (path: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(path)) {
                newSet.delete(path);
            } else {
                newSet.add(path);
            }
            return newSet;
        });
    };
    
    const handleContextMenu = (e: React.MouseEvent, path: string, type: 'file' | 'folder') => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY, path, type });
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (renamingNode && renameInputRef.current) {
            const newName = renameInputRef.current.value;
            if(newName.trim()) {
                onRename(renamingNode, newName.trim());
            }
        }
        setRenamingNode(null);
    };

    const renderTree = (nodes: FileNode[], pathPrefix = ''): React.ReactNode => {
        return nodes.map(node => {
            const currentPath = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
            const isFolder = !!node.children;
            const isExpanded = expandedFolders.has(currentPath);
            const isSelected = activeFile === currentPath;
            const isRenaming = renamingNode === currentPath;

            return (
                <div key={currentPath}>
                    <div 
                        className={`flex items-center cursor-pointer hover:bg-green-900/50 p-0.5 rounded-sm ${isSelected ? 'bg-green-800/70' : ''}`}
                        onClick={() => isFolder ? handleToggleFolder(currentPath) : onFileSelect(currentPath)}
                        onContextMenu={(e) => handleContextMenu(e, currentPath, isFolder ? 'folder' : 'file')}
                        onDoubleClick={() => setRenamingNode(currentPath)}
                    >
                        {isFolder ? <FolderIcon className="w-4 h-4 mr-1 flex-shrink-0" /> : <FileIcon className="w-4 h-4 mr-1 flex-shrink-0" />}
                        {isRenaming ? (
                            <form onSubmit={handleRenameSubmit} className="flex-grow">
                                <input
                                    ref={renameInputRef}
                                    defaultValue={node.name}
                                    onBlur={handleRenameSubmit}
                                    className="bg-black border border-green-500 text-green-300 w-full text-xs p-0 m-0"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </form>
                        ) : (
                            <span>{node.name}</span>
                        )}
                    </div>
                    {isFolder && isExpanded && (
                        <div className="pl-3 border-l border-green-900/50">
                            {renderTree(node.children!, currentPath)}
                        </div>
                    )}
                </div>
            );
        });
    };

    const contextMenuActions = {
        onNewFile,
        onNewDirectory,
        onRename: (path: string) => setRenamingNode(path),
        onDelete,
    };

    return (
        <div className="bg-black/50 border border-green-800 p-2 flex flex-col h-full">
            <h2 className="text-sm mb-2 border-b-2 border-green-800">FILE EXPLORER</h2>
            <div className="relative mb-2 flex-shrink-0">
                <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-black border border-green-700 p-1 pl-7 text-xs placeholder-gray-500"
                />
                <SearchIcon className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-grow overflow-y-auto">
                {renderTree(filteredFiles)}
            </div>
            <ContextMenu menu={contextMenu} actions={contextMenuActions} onClose={() => setContextMenu(null)} />
        </div>
    );
};

export default FileExplorer;