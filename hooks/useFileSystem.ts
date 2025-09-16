import { useState, useCallback } from 'react';
import { FileNode } from '../types.ts';

/**
 * @function findNodeByPath
 * @description Recursively finds a node in a file tree by its path.
 * @param {FileNode[]} nodes - The file tree to search.
 * @param {string[]} path - The path to the node to find.
 * @returns {FileNode | null} The found node, or null if not found.
 */
const findNodeByPath = (nodes: FileNode[], path: string[]): FileNode | null => {
  if (path.length === 0) return null;
  const [name, ...rest] = path;
  const node = nodes.find(n => n.name === name);
  if (!node) return null;
  if (rest.length === 0) return node;
  if (node.children) {
    return findNodeByPath(node.children, rest);
  }
  return null;
};

/**
 * @function findParentAndNode
 * @description Finds a node and its parent in a file tree by its path.
 * @param {FileNode[]} nodes - The file tree to search.
 * @param {string[]} path - The path to the node to find.
 * @returns {{ parent: FileNode | null, node: FileNode | null, index: number }} The parent node, the found node, and the index of the node in its parent's children array.
 */
const findParentAndNode = (nodes: FileNode[], path: string[]): { parent: FileNode | null, node: FileNode | null, index: number } => {
    if (path.length === 0) return { parent: null, node: null, index: -1 };
    
    let parent: FileNode | null = null;
    let currentNodes: FileNode[] = nodes;
    
    for (let i = 0; i < path.length; i++) {
        const name = path[i];
        const index = currentNodes.findIndex(n => n.name === name);
        const node = currentNodes[index];

        if (!node) return { parent: null, node: null, index: -1 };

        if (i === path.length - 1) {
            return { parent, node, index };
        }
        
        if (!node.children) return { parent: null, node: null, index: -1 };
        
        parent = node;
        currentNodes = node.children;
    }
    
    return { parent: null, node: null, index: -1 };
};

/**
 * @const initialFiles
 * @description The initial file system structure.
 */
export const initialFiles: FileNode[] = [
  {
    name: 'src',
    children: [
      { name: 'App.tsx', content: 'function App() {\n  return <h1>Hello World</h1>;\n}' },
      { name: 'index.tsx', content: 'import React from "react";' },
      { name: 'api.ts', content: 'export const authUser = (user) => true;' },
    ],
  },
  {
    name: 'models',
    children: [
        { name: 'Mistral-7B-Instruct-v0.2.gguf', content: '' },
        { name: 'CodeLlama-13B-Instruct.gguf', content: '' },
        { name: 'Yi-34B-Chat.gguf', content: '' },
        { name: 'Deepseek-Coder-33B.gguf', content: '' },
    ]
  },
   {
    name: 'plugins',
    children: [
      {
        name: 'Git Tools',
        children: [
          {
            name: 'plugin.json',
            content: '{\n  "name": "Git Tools",\n  "version": "0.1.0",\n  "description": "Provides AI tools for common Git operations like status, committing, branching, and pushing/pulling.",\n  "author": "QUONX Labs",\n  "main": "index.js"\n}'
          },
          {
            name: 'index.js',
            content: "quonx.registerTool('gitStatus', 'Checks the current git status of the project (modified, untracked files).', () => {});\nquonx.registerTool('gitCommit', 'Commits all current changes with a given message. args: { \"message\": \"Your commit message\" }', (args) => {});\nquonx.registerTool('gitPush', 'Pushes committed changes to the remote repository.', () => {});\nquonx.registerTool('gitPull', 'Pulls the latest changes from the remote repository.', () => {});\nquonx.registerTool('gitBranch', 'Creates a new branch. args: { \"name\": \"new-branch-name\" }', (args) => {});"
          }
        ]
      }
    ]
  },
  { name: '.gitignore', content: 'node_modules\nmodels' },
  { name: 'package.json', content: '{ "name": "my-app" }' },
];


/**
 * @function useFileSystem
 * @description A hook for managing a virtual file system.
 * @returns {{ files: FileNode[], getFileContent: (path: string) => string | null, updateFileContent: (path: string, content: string) => void, createFile: (path: string) => string | null, createDirectory: (path: string) => string | null, renameNode: (path: string, newName: string) => string | null, deleteNode: (path: string) => boolean, setFiles: React.Dispatch<React.SetStateAction<FileNode[]>>, writeFile: (path: string, content: string) => string | null, listFiles: (path: string) => string[] | null }} An object with the file system state and functions to manipulate it.
 */
export const useFileSystem = () => {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);

  /**
   * @function getFileContent
   * @description Gets the content of a file.
   * @param {string} path - The path to the file.
   * @returns {string | null} The content of the file, or null if not found.
   */
  const getFileContent = useCallback((path: string): string | null => {
    const node = findNodeByPath(files, path.split('/'));
    return node && node.content !== undefined ? node.content : null;
  }, [files]);

  /**
   * @function listFiles
   * @description Lists the files and directories in a directory.
   * @param {string} path - The path to the directory.
   * @returns {string[] | null} A list of file and directory names, or null if the path is not a directory.
   */
  const listFiles = useCallback((path: string): string[] | null => {
      if (path === '' || path === '.') {
          return files.map(n => n.name + (n.children ? '/' : ''));
      }
      const pathParts = path.split('/');
      const node = findNodeByPath(files, pathParts);
      if (node && node.children) {
          return node.children.map(n => n.name + (n.children ? '/' : ''));
      }
      return null;
  }, [files]);

  /**
   * @function updateFileContent
   * @description Updates the content of a file.
   * @param {string} path - The path to the file.
   * @param {string} content - The new content of the file.
   * @returns {void}
   */
  const updateFileContent = useCallback((path: string, content: string) => {
    setFiles(currentFiles => {
      const newFiles = JSON.parse(JSON.stringify(currentFiles));
      const node = findNodeByPath(newFiles, path.split('/'));
      if (node && node.content !== undefined) {
        node.content = content;
      }
      return newFiles;
    });
  }, []);

  /**
   * @function writeFile
   * @description Writes content to a file, creating it if it doesn't exist.
   * @param {string} path - The path to the file.
   * @param {string} content - The content to write to the file.
   * @returns {string | null} The path to the file if successful, or null otherwise.
   */
  const writeFile = useCallback((path: string, content: string): string | null => {
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    if (!fileName || fileName.includes('/')) {
        console.error("Invalid file name in path:", path);
        return null;
    }

    let success = false;
    setFiles(currentFiles => {
        const newFiles = JSON.parse(JSON.stringify(currentFiles));
        const parentPath = pathParts.slice(0, -1);
        
        let parentDir = newFiles;
        if (parentPath.length > 0) {
            const parentNode = findNodeByPath(newFiles, parentPath);
            if (!parentNode || !parentNode.children) {
                console.error("Cannot write file, parent path does not exist or is not a folder:", parentPath.join('/'));
                return currentFiles;
            }
            parentDir = parentNode.children;
        }

        const existingFile = parentDir.find(f => f.name === fileName);
        if (existingFile) {
            if (existingFile.content !== undefined) {
                existingFile.content = content;
                success = true;
            } else {
                console.error("Cannot write content to a folder:", path);
            }
        } else {
            parentDir.push({ name: fileName, content: content });
            parentDir.sort((a, b) => a.name.localeCompare(b.name));
            success = true;
        }
        return newFiles;
    });
    return success ? path : null;
  }, []);

  /**
   * @function createFile
   * @description Creates a new file.
   * @param {string} path - The path to the file to create.
   * @returns {string | null} The path to the created file, or null if it already exists.
   */
  const createFile = useCallback((path: string): string | null => {
    const pathParts = path.split('/');
    const fileName = pathParts[pathParts.length - 1];
    if (!fileName || fileName.includes('/')) {
        console.error("Invalid file name.");
        return null;
    }

    let success = false;
    setFiles(currentFiles => {
      const newFiles = JSON.parse(JSON.stringify(currentFiles));
      const parentPath = pathParts.slice(0, -1);
      
      let parentDir = newFiles;
      if (parentPath.length > 0) {
        const parentNode = findNodeByPath(newFiles, parentPath);
        if (!parentNode || !parentNode.children) {
            console.error("Cannot create file, parent path does not exist or is not a folder:", parentPath.join('/'));
            return currentFiles;
        }
        parentDir = parentNode.children;
      }
      
      if (!parentDir.find(f => f.name === fileName)) {
          parentDir.push({ name: fileName, content: '' });
          parentDir.sort((a, b) => a.name.localeCompare(b.name));
          success = true;
      } else {
          console.error("File with the same name already exists.");
      }
      return newFiles;
    });
    return success ? path : null;
  }, []);

  /**
   * @function createDirectory
   * @description Creates a new directory.
   * @param {string} path - The path to the directory to create.
   * @returns {string | null} The path to the created directory, or null if it already exists.
   */
  const createDirectory = useCallback((path: string): string | null => {
    const pathParts = path.split('/');
    const folderName = pathParts[pathParts.length - 1];
    if (!folderName || folderName.includes('/')) {
        console.error("Invalid folder name.");
        return null;
    }

    let success = false;
    setFiles(currentFiles => {
        const newFiles = JSON.parse(JSON.stringify(currentFiles));
        const parentPath = pathParts.slice(0, -1);
        
        let parentDir = newFiles;
        if (parentPath.length > 0) {
            const parentNode = findNodeByPath(newFiles, parentPath);
            if (!parentNode || !parentNode.children) {
                console.error("Cannot create folder, parent path does not exist or is not a folder:", parentPath.join('/'));
                return currentFiles;
            }
            parentDir = parentNode.children;
        }
        
        if (!parentDir.find(f => f.name === folderName)) {
            parentDir.push({ name: folderName, children: [] });
            parentDir.sort((a, b) => a.name.localeCompare(b.name));
            success = true;
        } else {
            console.error("Folder with the same name already exists.");
        }
        return newFiles;
    });
    return success ? path : null;
  }, []);

  /**
   * @function renameNode
   * @description Renames a file or directory.
   * @param {string} path - The path to the node to rename.
   * @param {string} newName - The new name of the node.
   * @returns {string | null} The new path of the node, or null if the rename failed.
   */
  const renameNode = useCallback((path: string, newName: string): string | null => {
    if (!newName || newName.includes('/')) {
      console.error("Invalid name:", newName);
      return null;
    }
    
    let success = false;
    let newPath = '';
    setFiles(currentFiles => {
        const newFiles = JSON.parse(JSON.stringify(currentFiles));
        const pathParts = path.split('/');
        const { parent, node } = findParentAndNode(newFiles, pathParts);

        if (node) {
            const parentChildren = parent ? parent.children : newFiles;
            if (parentChildren && !parentChildren.find(n => n.name === newName)) {
                node.name = newName;
                parentChildren.sort((a, b) => a.name.localeCompare(b.name));
                const newPathParts = path.split('/');
                newPathParts[newPathParts.length - 1] = newName;
                newPath = newPathParts.join('/');
                success = true;
            } else {
                console.error("A node with the new name already exists in this directory.");
            }
        }
        return newFiles;
    });
    return success ? newPath : null;
  }, []);

  /**
   * @function deleteNode
   * @description Deletes a file or directory.
   * @param {string} path - The path to the node to delete.
   * @returns {boolean} Whether the deletion was successful.
   */
  const deleteNode = useCallback((path: string): boolean => {
    let success = false;
    setFiles(currentFiles => {
        const newFiles = JSON.parse(JSON.stringify(currentFiles));
        const pathParts = path.split('/');
        const { parent, node, index } = findParentAndNode(newFiles, pathParts);

        if (node) {
            const parentChildren = parent ? parent.children : newFiles;
            if (parentChildren) {
                parentChildren.splice(index, 1);
                success = true;
            }
        }
        return newFiles;
    });
    return success;
  }, []);

  return { files, getFileContent, updateFileContent, createFile, createDirectory, renameNode, deleteNode, setFiles, writeFile, listFiles };
};