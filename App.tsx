import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFileSystem } from './hooks/useFileSystem.ts';
import { FileNode, ModelSettings, RoleModels, Plugin } from './types.ts';

import FileExplorer from './components/FileExplorer.tsx';
import Editor from './components/Editor.tsx';
import Terminal from './components/Terminal.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import AIAgentPanel from './components/AIAgentPanel.tsx';
import ContextPanel from './components/ContextPanel.tsx';
import PluginManagerPanel from './components/PluginManagerPanel.tsx';
import { IntentInferenceEngine } from './services/intentInferenceEngine.ts';
import { CodebaseAnalyzer } from './services/codebaseAnalyzer.ts';
import { PluginService } from './services/pluginService.ts';

interface Message {
    sender: 'user' | 'agent';
    text: string;
    thought?: string;
}

function App() {
    const { files, getFileContent, updateFileContent, createFile, createFolder, renameNode, deleteNode } = useFileSystem();
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [editorContent, setEditorContent] = useState<string>('');
    const [terminalOutput, setTerminalOutput] = useState<string[]>(['QUONX IDE Initialized. AI Agent ready.']);
    const [messages, setMessages] = useState<Message[]>([
        { sender: 'agent', text: 'Hello! I am your AI assistant. How can I help you with your codebase today?' }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    
    // Settings
    const [settings, setSettings] = useState<ModelSettings>({ temperature: 0.5, topP: 0.95, topK: 40 });
    const [roleModels, setRoleModels] = useState<RoleModels>({ chat: 'gemini-2.5-flash', code: 'gemini-2.5-flash', reasoner: 'gemini-2.5-flash' });
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.5-flash']); // Hardcoded for now based on guidelines

    // Plugins
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [enabledPlugins, setEnabledPlugins] = useState<{ [pluginName: string]: boolean }>({});
    
    // Services
    const intentEngine = useMemo(() => new IntentInferenceEngine(roleModels.reasoner), [roleModels.reasoner]);
    const codebaseAnalyzer = useMemo(() => new CodebaseAnalyzer(), []);
    const pluginService = useMemo(() => new PluginService(files, getFileContent), [files, getFileContent]);


    const addToTerminal = useCallback((line: string) => {
        setTerminalOutput(prev => [...prev, line]);
    }, []);

    // Effect to build the initial code graph
    useEffect(() => {
        addToTerminal('Building code knowledge graph...');
        codebaseAnalyzer.buildInitialGraph(files);
        addToTerminal('Code knowledge graph built successfully.');
    }, [files, codebaseAnalyzer, addToTerminal]);
    
    // Effect to load plugins reactively when enabledPlugins state changes
    useEffect(() => {
        const load = async () => {
            addToTerminal('Loading plugins...');
            await pluginService.loadPlugins(enabledPlugins);
            const loadedPlugins = pluginService.getLoadedPlugins();
            setPlugins(loadedPlugins);
            
            // On first load, initialize all discovered plugins to be enabled
            if (Object.keys(enabledPlugins).length === 0 && loadedPlugins.length > 0) {
                 const initialEnabledState = loadedPlugins.reduce((acc, plugin) => {
                    if (!plugin.error) { // Don't enable errored plugins by default
                        acc[plugin.name] = true;
                    }
                    return acc;
                }, {} as { [pluginName: string]: boolean });
                setEnabledPlugins(initialEnabledState);
            }
            
            const tools = pluginService.getRegisteredTools();
            const enabledPluginCount = loadedPlugins.filter(p => enabledPlugins[p.name] !== false).length;
            addToTerminal(`Loaded ${enabledPluginCount} active plugins and registered ${tools.length} tools.`);
        };
        load();
    // This effect should re-run whenever the user toggles a plugin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabledPlugins, files, pluginService, addToTerminal]);

    const handleFileSelect = useCallback((path: string) => {
        const content = getFileContent(path);
        if (content !== null) {
            setSelectedFile(path);
            setEditorContent(content);
        } else {
            addToTerminal(`Error: Could not read file content for ${path}`);
        }
    }, [getFileContent, addToTerminal]);

    const handleContentChange = useCallback((newContent: string) => {
        setEditorContent(newContent);
        if (selectedFile) {
            updateFileContent(selectedFile, newContent);
            // Debounce or throttle this in a real app
            codebaseAnalyzer.updateGraphFromFile(selectedFile, newContent);
        }
    }, [selectedFile, updateFileContent, codebaseAnalyzer]);
    
    const handleTogglePlugin = (pluginName: string, isEnabled: boolean) => {
        setEnabledPlugins(prev => ({ ...prev, [pluginName]: isEnabled }));
    };

    const handleSendMessage = async (prompt: string) => {
        setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
        setIsThinking(true);
        addToTerminal(`User prompt: "${prompt}"`);

        const tools = pluginService.getRegisteredTools();
        const intentResult = await intentEngine.inferIntent(prompt, tools);

        let agentResponse = '';
        let thought = `Intent: ${intentResult.intent}\nDetails: ${intentResult.details}`;
        if (intentResult.toolName) {
            thought += `\nTool: ${intentResult.toolName}\nArgs: ${JSON.stringify(intentResult.toolArgs)}`;
        }

        switch(intentResult.intent) {
            case 'code-search':
                agentResponse = codebaseAnalyzer.searchCodebase(intentResult.details);
                addToTerminal(`Executing code search: "${intentResult.details}"`);
                break;
            // TODO: Implement other intents (file-edit, code-generation, etc.)
            case 'plugin-tool':
                const tool = tools.find(t => t.name === intentResult.toolName);
                if (tool) {
                    addToTerminal(`Executing tool: ${tool.name} with args ${JSON.stringify(intentResult.toolArgs)}`);
                    const result = await tool.handler(intentResult.toolArgs);
                    agentResponse = `Tool '${tool.name}' executed:\n${result}`;
                } else {
                    agentResponse = `Error: Could not find tool '${intentResult.toolName}'.`;
                }
                break;
            default: // general-chat
                agentResponse = "I'm currently optimized for codebase tasks. Could you please rephrase your request to be about file edits, code generation, or searching the codebase?";
                break;
        }

        setMessages(prev => [...prev, { sender: 'agent', text: agentResponse, thought }]);
        addToTerminal('AI Agent responded.');
        setIsThinking(false);
    };

    const handleNewFile = (path: string) => {
        const newPath = createFile(path);
        if (newPath) {
            addToTerminal(`File created: ${newPath}`);
        } else {
            addToTerminal(`Error: Failed to create file at ${path}`);
        }
    };
    
    const handleNewFolder = (path: string) => {
        const newPath = createFolder(path);
        if (newPath) {
            addToTerminal(`Folder created: ${newPath}`);
        } else {
            addToTerminal(`Error: Failed to create folder at ${path}`);
        }
    };

    const handleDeleteNode = (path: string) => {
        const success = deleteNode(path);
        if (success) {
            addToTerminal(`Deleted: ${path}`);
            if (selectedFile && (selectedFile === path || selectedFile.startsWith(path + '/'))) {
                setSelectedFile(null);
                setEditorContent('');
            }
            codebaseAnalyzer.removeGraphNodesForPath(path);
        } else {
            addToTerminal(`Error: Failed to delete ${path}`);
        }
    };
    
    const handleRenameNode = (path: string, newName: string) => {
        const newPath = renameNode(path, newName);
        if (newPath) {
            addToTerminal(`Renamed: ${path} to ${newPath}`);
            // If the renamed node is the selected file, update the selection
            if (selectedFile === path) {
                setSelectedFile(newPath);
            }
            // If the renamed node is a directory containing the selected file, update selection path
            else if (selectedFile && selectedFile.startsWith(path + '/')) {
                const updatedSelectedPath = selectedFile.replace(path, newPath);
                setSelectedFile(updatedSelectedPath);
            }
            // Update knowledge graph for both old and new paths
            codebaseAnalyzer.removeGraphNodesForPath(path);
            const content = getFileContent(newPath);
            if (content !== null) {
                codebaseAnalyzer.updateGraphFromFile(newPath, content);
            }
        } else {
             addToTerminal(`Error: Failed to rename ${path}`);
        }
    };

    return (
        <div className="bg-gray-900 text-green-400 font-mono h-screen flex flex-col p-2">
            <header className="flex-shrink-0 mb-2">
                <h1 className="text-xl border-b-2 border-green-700">QUONX - AI-Powered IDE</h1>
            </header>
            <main className="flex-grow grid grid-cols-12 grid-rows-6 gap-2 min-h-0">
                <div className="col-span-2 row-span-6">
                    <FileExplorer 
                        files={files} 
                        onFileSelect={handleFileSelect} 
                        selectedFile={selectedFile}
                        onNewFile={handleNewFile}
                        onNewFolder={handleNewFolder}
                        onRename={handleRenameNode}
                        onDelete={handleDeleteNode}
                    />
                </div>
                <div className="col-span-7 row-span-4">
                    <Editor filePath={selectedFile} content={editorContent} onContentChange={handleContentChange} />
                </div>
                <div className="col-span-3 row-span-4">
                    <AIAgentPanel messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking} />
                </div>
                <div className="col-span-7 row-span-2">
                    <Terminal output={terminalOutput} />
                </div>
                <div className="col-span-3 row-span-2 grid grid-cols-1 grid-rows-3 gap-2">
                   <div className="row-span-1"><ContextPanel /></div>
                   <div className="row-span-1"><PluginManagerPanel plugins={plugins} enabledPlugins={enabledPlugins} onTogglePlugin={handleTogglePlugin} /></div>
                   <div className="row-span-1"><SettingsPanel settings={settings} onSettingsChange={setSettings} roleModels={roleModels} onRoleModelsChange={setRoleModels} availableModels={availableModels}/></div>
                </div>
            </main>
        </div>
    );
}

export default App;