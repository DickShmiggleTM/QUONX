import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FileNode } from '../types.ts';
import { FileIcon, FolderIcon } from './icons.tsx';

interface ContextMenuProps {
  menu: { x: number; y: number; path: string; type: 'file' | 'folder' } | null;
  actions: { [key: string]: (path: string) => void };
  onClose: () => void;
}

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

  return (
    <div
      style={{ top: menu.y, left: menu.x }}
      className="absolute z-50 bg-black border-2 border-green-600 text-green-400 p-1"
      onClick={e => e.stopPropagation()}
    >
      {menuItems.map(item => (
        <div
          key={item}
          className="px-2 py-1 hover:bg-green-800 cursor-pointer"
          onClick={() => {
            const actionKey = item.replace(' ', ''); // 'New File' -> 'NewFile'
            if (actions[actionKey]) {
                actions[actionKey](menu.path);
            }
            onClose();
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
};

interface FileExplorerProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  onNewFile: (path: string) => void;
  onNewFolder: (path: string) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
}

const InlineInput: React.FC<{
    defaultValue: string;
    onCommit: (value: string) => void;
    onCancel: () => void;
    type: 'file' | 'folder';
}> = ({ defaultValue, onCommit, onCancel, type }) => {
    const [value, setValue] = useState(defaultValue);
    // FIX: `useRef` was used but not imported. It has been added to the import statement from 'react'.
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (value.trim()) onCommit(value.trim());
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    const handleBlur = () => {
        if (value.trim()) onCommit(value.trim());
        else onCancel();
    };

    return (
        <div className="flex items-center pl-2">
            {type === 'file' ? <FileIcon className="w-4 h-4 mr-1 flex-shrink-0" /> : <FolderIcon className="w-4 h-4 mr-1 flex-shrink-0" />}
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                className="bg-green-900 text-green-200 outline-none w-full"
            />
        </div>
    );
};

const FileNodeComponent: React.FC<{ 
  node: FileNode; 
  path: string; 
  onFileSelect: (path: string) => void; 
  selectedFile: string | null;
  onContextMenu: (event: React.MouseEvent, path: string, type: 'file' | 'folder') => void;
  editingPath: string | null;
  creating: { parentPath: string; type: 'file' | 'folder' } | null;
  onRename: (path: string, newName: string) => void;
  onNewFile: (path: string) => void;
  onNewFolder: (path: string) => void;
  stopEditing: () => void;
}> = ({ node, path, onFileSelect, selectedFile, onContextMenu, editingPath, creating, onRename, onNewFile, onNewFolder, stopEditing }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = path === selectedFile;
  const isEditing = editingPath === path;

  if (isEditing) {
      return (
          <InlineInput 
              defaultValue={node.name}
              onCommit={(newName) => {
                  if (newName !== node.name) {
                      onRename(path, newName);
                  }
                  stopEditing();
              }}
              onCancel={stopEditing}
              type={node.children ? 'folder' : 'file'}
          />
      );
  }

  if (node.children) {
    return (
      <div className="pl-2">
        <div 
          className="flex items-center cursor-pointer hover:bg-green-900/50"
          onClick={() => setIsOpen(!isOpen)}
          onContextMenu={(e) => onContextMenu(e, path, 'folder')}
        >
          <FolderIcon className="w-4 h-4 mr-1 flex-shrink-0" />
          <span>{node.name}</span>
        </div>
        {isOpen && (
          <div>
            {node.children.map(child => (
              <FileNodeComponent 
                key={child.name} 
                node={child} 
                path={`${path}/${child.name}`} 
                {...{ onFileSelect, selectedFile, onContextMenu, editingPath, creating, onRename, onNewFile, onNewFolder, stopEditing }}
              />
            ))}
            {creating && creating.parentPath === path && (
                <InlineInput
                    defaultValue=""
                    onCommit={(name) => {
                        if (creating.type === 'file') onNewFile(`${path}/${name}`);
                        else onNewFolder(`${path}/${name}`);
                        stopEditing();
                    }}
                    onCancel={stopEditing}
                    type={creating.type}
                />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="pl-2">
      <div 
        className={`flex items-center cursor-pointer hover:bg-green-900/50 ${isSelected ? 'bg-green-800' : ''}`}
        onClick={() => onFileSelect(path)}
        onContextMenu={(e) => onContextMenu(e, path, 'file')}
      >
        <FileIcon className="w-4 h-4 mr-1 flex-shrink-0" />
        <span>{node.name}</span>
      </div>
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect, selectedFile, onNewFile, onNewFolder, onRename, onDelete }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string; type: 'file' | 'folder' } | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  
  const handleContextMenu = (event: React.MouseEvent, path: string, type: 'file' | 'folder') => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, path, type });
  };
  
  const closeContextMenu = () => setContextMenu(null);

  const stopEditing = useCallback(() => {
      setEditingPath(null);
      setCreating(null);
  }, []);

  const actions = {
    NewFile: (path: string) => setCreating({ parentPath: path, type: 'file' }),
    NewFolder: (path: string) => setCreating({ parentPath: path, type: 'folder' }),
    Rename: (path: string) => setEditingPath(path),
    Delete: (path: string) => {
      if (confirm(`Are you sure you want to delete '${path.split('/').pop()}'? This action cannot be undone.`)) {
        onDelete(path);
      }
    },
  };

  return (
    <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full" onClick={stopEditing}>
      <h2 className="text-sm mb-2 border-b-2 border-green-800">FILE EXPLORER</h2>
      {files.map(node => (
        <FileNodeComponent 
            key={node.name} 
            node={node} 
            path={node.name} 
            {...{ onFileSelect, selectedFile, onRename, onNewFile, onNewFolder, stopEditing, editingPath, creating }}
            onContextMenu={handleContextMenu} 
        />
      ))}
      <ContextMenu menu={contextMenu} actions={actions} onClose={closeContextMenu} />
    </div>
  );
};

export default FileExplorer;