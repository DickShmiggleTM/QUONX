import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FileExplorer } from './components/FileExplorer';
import { Editor } from './components/Editor';
import { AIAgentPanel } from './components/AIAgentPanel';
import { Terminal } from './components/Terminal';
import { SettingsPanel } from './components/SettingsPanel';
import './App.css';

interface ProjectFile {
  path: string;
  name: string;
  isDirectory: boolean;
}

function App() {
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [activePanel, setActivePanel] = useState<'editor' | 'terminal' | 'ai' | 'settings'>('editor');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize the application
      const files = await invoke<string[]>('get_project_files', { path: '.' });
      setProjectFiles(files.map(path => ({
        path,
        name: path.split('/').pop() || path,
        isDirectory: false // This would need to be determined properly
      })));
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to initialize app:', error);
      setIsLoading(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setCurrentFile(filePath);
    setActivePanel('editor');
  };

  const handleAIQuery = async (query: string) => {
    try {
      const response = await invoke<string>('start_ai_inference', {
        prompt: query,
        model: 'default'
      });
      return response;
    } catch (error) {
      console.error('AI inference failed:', error);
      return 'Error: Failed to get AI response';
    }
  };

  if (isLoading) {
    return (
      <div className="app loading">
        <div className="loading-screen">
          <div className="pixel-loader"></div>
          <h1 className="pixel-title">QUONX IDE</h1>
          <p className="pixel-subtitle">Initializing Sentient Development Environment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-left">
          <h1 className="app-title">QUONX IDE</h1>
          <div className="status-indicators">
            <div className="status-indicator active">AI</div>
            <div className="status-indicator">SYNC</div>
            <div className="status-indicator">INDEX</div>
          </div>
        </div>
        <div className="header-right">
          <button 
            className={`nav-button ${activePanel === 'editor' ? 'active' : ''}`}
            onClick={() => setActivePanel('editor')}
          >
            EDITOR
          </button>
          <button 
            className={`nav-button ${activePanel === 'ai' ? 'active' : ''}`}
            onClick={() => setActivePanel('ai')}
          >
            AI AGENT
          </button>
          <button 
            className={`nav-button ${activePanel === 'terminal' ? 'active' : ''}`}
            onClick={() => setActivePanel('terminal')}
          >
            TERMINAL
          </button>
          <button 
            className={`nav-button ${activePanel === 'settings' ? 'active' : ''}`}
            onClick={() => setActivePanel('settings')}
          >
            SETTINGS
          </button>
        </div>
      </div>

      <div className="app-content">
        <div className="sidebar">
          <FileExplorer 
            files={projectFiles}
            onFileSelect={handleFileSelect}
            currentFile={currentFile}
          />
        </div>

        <div className="main-content">
          {activePanel === 'editor' && (
            <Editor 
              filePath={currentFile}
              onFileChange={setCurrentFile}
            />
          )}
          
          {activePanel === 'ai' && (
            <AIAgentPanel 
              onQuery={handleAIQuery}
              currentFile={currentFile}
            />
          )}
          
          {activePanel === 'terminal' && (
            <Terminal />
          )}
          
          {activePanel === 'settings' && (
            <SettingsPanel />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;