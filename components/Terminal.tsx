import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export const Terminal: React.FC = () => {
  const [output, setOutput] = useState<string[]>([
    'Quonx IDE Terminal v1.0.0',
    'Type "help" for available commands.',
    ''
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const addOutput = (line: string) => {
    setOutput(prev => [...prev, line]);
  };

  const executeCommand = async (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to history
    setCommandHistory(prev => [...prev, trimmedCommand]);
    setHistoryIndex(-1);

    // Add command to output
    addOutput(`$ ${trimmedCommand}`);

    try {
      // Handle built-in commands
      switch (trimmedCommand.toLowerCase()) {
        case 'help':
          addOutput('Available commands:');
          addOutput('  help     - Show this help message');
          addOutput('  clear    - Clear the terminal');
          addOutput('  ls       - List files in current directory');
          addOutput('  pwd      - Print working directory');
          addOutput('  models   - List available AI models');
          addOutput('  status   - Show system status');
          break;

        case 'clear':
          setOutput([]);
          break;

        case 'ls':
          try {
            const files = await invoke<string[]>('get_project_files', { path: '.' });
            if (files.length === 0) {
              addOutput('No files found.');
            } else {
              files.forEach(file => addOutput(`  ${file}`));
            }
          } catch (error) {
            addOutput(`Error: ${error}`);
          }
          break;

        case 'pwd':
          addOutput(process.cwd() || '/workspace');
          break;

        case 'models':
          try {
            const models = await invoke<string[]>('get_available_models');
            if (models.length === 0) {
              addOutput('No models available.');
            } else {
              addOutput('Available models:');
              models.forEach(model => addOutput(`  ${model}`));
            }
          } catch (error) {
            addOutput(`Error: ${error}`);
          }
          break;

        case 'status':
          addOutput('Quonx IDE Status:');
          addOutput('  AI Engine: Active');
          addOutput('  File Watcher: Active');
          addOutput('  Model Manager: Active');
          addOutput('  Python Sidecar: Active');
          break;

        default:
          // Try to execute as shell command
          try {
            const result = await invoke<string>('execute_shell', { command: trimmedCommand });
            addOutput(result);
          } catch (error) {
            addOutput(`Command not found: ${trimmedCommand}`);
            addOutput('Type "help" for available commands.');
          }
          break;
      }
    } catch (error) {
      addOutput(`Error executing command: ${error}`);
    }

    addOutput(''); // Add empty line after command
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        executeCommand(currentInput);
        setCurrentInput('');
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (commandHistory.length > 0) {
          const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex !== -1) {
          const newIndex = historyIndex + 1;
          if (newIndex >= commandHistory.length) {
            setHistoryIndex(-1);
            setCurrentInput('');
          } else {
            setHistoryIndex(newIndex);
            setCurrentInput(commandHistory[newIndex]);
          }
        }
        break;

      case 'Tab':
        e.preventDefault();
        // Auto-completion could be implemented here
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentInput(e.target.value);
  };

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span>TERMINAL</span>
        <span className="terminal-status">READY</span>
      </div>
      
      <div className="terminal-output" ref={terminalRef}>
        {output.map((line, index) => (
          <div key={index} className="terminal-line">
            {line}
          </div>
        ))}
      </div>
      
      <div className="terminal-input-line">
        <span className="terminal-prompt">$</span>
        <input
          ref={inputRef}
          type="text"
          value={currentInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="terminal-input"
          autoFocus
          spellCheck={false}
        />
      </div>
    </div>
  );
};