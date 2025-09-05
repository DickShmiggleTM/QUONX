import { useState, useCallback } from 'react';
import { FileNode } from '../types.ts';

// Helper to deeply find and update a node
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

// Helper to find parent and the node itself
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

const initialFiles: FileNode[] = [
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
        name: 'git-helper',
        children: [
          { name: 'plugin.json', content: JSON.stringify({
              name: "Git Helper",
              version: "0.1.0",
              description: "Provides basic git-related tools for the QUONX agent.",
              author: "QUONX Core",
              main: "index.js"
            }, null, 2)
          },
          { name: 'index.js', content: `
            // Example QUONX Plugin: Git Helper
            console.log("Git Helper Plugin loading...");

            quonx.registerTool(
              'gitStatus',
              'Checks the current git status of the project.',
              (args) => {
                console.log("Executing gitStatus tool with args:", args);
                // In a real app, this would execute a shell command.
                // Here, we simulate the output.
                return "Simulated git status:\\n- modified: src/App.tsx\\n- new file: src/components/Button.tsx";
              }
            );

            console.log("Git Helper Plugin loaded and tool registered.");
          `},
        ]
      },
      {
        name: 'git-tools',
        children: [
          {
            name: 'plugin.json', content: JSON.stringify({
              name: "Git Tools",
              version: "1.0.0",
              description: "Provides tools for committing and pushing code with Git.",
              author: "QUONX Community",
              main: "index.js"
            }, null, 2)
          },
          {
            name: 'index.js', content: `
// QUONX Plugin: Git Tools
console.log("Git Tools Plugin loading...");

quonx.registerTool(
  'gitCommit',
  'Commits staged changes. args: { message: string }',
  (args) => {
    if (!args || !args.message) {
      return "Error: A commit message is required.";
    }
    console.log(\`Executing gitCommit with message: "\${args.message}"\`);
    return \`Simulated git commit with message: '\${args.message}'\`;
  }
);

quonx.registerTool(
  'gitPush',
  'Pushes committed changes to a remote branch. args: { branch: string }',
  (args) => {
    if (!args || !args.branch) {
      return "Error: A branch name is required.";
    }
    console.log(\`Executing gitPush to branch: "\${args.branch}"\`);
    return \`Simulated git push to branch '\${args.branch}'\`;
  }
);

console.log("Git Tools Plugin loaded and tools registered.");
            `
          }
        ]
      }
    ]
  },
  { name: 'package.json', content: '{ "name": "my-app" }' },
];


export const useFileSystem = () => {
  const [files, setFiles] = useState<FileNode[]>(initialFiles);

  const getFileContent = useCallback((path: string): string | null => {
    const node = findNodeByPath(files, path.split('/'));
    return node && node.content !== undefined ? node.content : null;
  }, [files]);

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

  const createFolder = useCallback((path: string): string | null => {
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

  return { files, getFileContent, updateFileContent, createFile, createFolder, renameNode, deleteNode, setFiles };
};