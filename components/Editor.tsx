import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * @interface EditorProps
 * @description Props for the Editor component.
 * @property {string | null} filePath - The path of the file to be edited.
 * @property {(path: string) => void} onFileChange - Function to handle file changes.
 */
interface EditorProps {
  filePath: string | null;
  onFileChange: (path: string) => void;
}

/**
 * @function Editor
 * @description A component that provides a text editor for editing files.
 * @param {EditorProps} props - The props for the component.
 * @returns {JSX.Element} The rendered Editor component.
 */
export const Editor: React.FC<EditorProps> = ({ filePath, onFileChange }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (filePath) {
      loadFileContent(filePath);
    } else {
      setContent('');
    }
  }, [filePath]);

  /**
   * @function loadFileContent
   * @description Loads the content of a file from the backend.
   * @param {string} path - The path of the file to load.
   * @returns {Promise<void>}
   */
  const loadFileContent = async (path: string) => {
    setIsLoading(true);
    try {
      // This would need to be implemented in the Rust backend
      const fileContent = await invoke<string>('read_file', { path });
      setContent(fileContent);
    } catch (error) {
      console.error('Failed to load file:', error);
      setContent(`// Error loading file: ${path}\n// ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * @function handleContentChange
   * @description Handles changes to the content of the editor.
   * @param {string} newContent - The new content of the editor.
   * @returns {void}
   */
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    // Auto-save functionality would go here
  };

  /**
   * @function getLanguageFromPath
   * @description Determines the programming language from a file path.
   * @param {string | null} path - The path of the file.
   * @returns {string} The name of the language.
   */
  const getLanguageFromPath = (path: string | null) => {
    if (!path) return 'text';
    
    const extension = path.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'tsx':
      case 'ts':
        return 'typescript';
      case 'jsx':
      case 'js':
        return 'javascript';
      case 'py':
        return 'python';
      case 'rs':
        return 'rust';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'json':
        return 'json';
      case 'md':
        return 'markdown';
      default:
        return 'text';
    }
  };

  if (!filePath) {
    return (
      <div className="editor-container">
        <div className="editor-header">
          <span>NO FILE SELECTED</span>
        </div>
        <div className="editor-content">
          <div className="welcome-message">
            <h2>Welcome to Quonx IDE</h2>
            <p>Select a file from the explorer to start editing.</p>
            <p>This is a sentient development environment with AI-powered assistance.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-header">
        <span>EDITING: {filePath}</span>
        <span className="language-badge">{getLanguageFromPath(filePath).toUpperCase()}</span>
      </div>
      <div className="editor-content">
        {isLoading ? (
          <div className="loading-indicator">Loading file...</div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            className="code-editor"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        )}
      </div>
    </div>
  );
};