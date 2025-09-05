import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FileExplorer from './components/FileExplorer.tsx';
import Editor from './components/Editor.tsx';
import Terminal from './components/Terminal.tsx';
import AIAgentPanel from './components/AIAgentPanel.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import { useFileSystem, initialFiles } from './hooks/useFileSystem.ts';
import { generateContent } from './services/geminiService.ts';
import { Message, ModelSettings, RoleModels, FileNode, GitStatus, Commit, CommitDiff, Plugin, SearchResult, IndexStatus, LintingError, SwarmTaskStatus, Agent } from './types.ts';
import { IntentInferenceEngine } from './services/intentInferenceEngine.ts';
import { CodebaseAnalyzer } from './services/codebaseAnalyzer.ts';
import { GitService } from './services/gitService.ts';
import { MemoryService } from './services/memoryService.ts';
import DraggableWindow from './components/DraggableWindow.tsx';
import GitPanel from './components/GitPanel.tsx';
import PluginManagerPanel from './components/PluginManagerPanel.tsx';
import { PluginService } from './services/pluginService.ts';
import IndexingPanel from './components/IndexingPanel.tsx';
import { IndexingService } from './services/indexingService.ts';
import LintingPanel from './components/LintingPanel.tsx';
import { LintingService } from './services/lintingService.ts';
import SwarmPanel from './components/SwarmPanel.tsx';
import { SwarmCoordinator } from './services/swarmService.ts';

// Main application component
const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const { files, getFileContent, updateFileContent, createFile, createDirectory, renameNode, deleteNode, setFiles, writeFile, listFiles } = useFileSystem();
    const [activeFile, setActiveFile] = useState<string | null>('src/App.tsx');
    const [editorContent, setEditorContent] = useState<string>('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [isThinking, setIsThinking] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState<string[]>(['Welcome to the QUONX AI IDE.']);
    const [settings, setSettings] = useState<ModelSettings>({ temperature: 0.7, topP: 0.95, topK: 40 });
    const [availableModels, setAvailableModels] = useState<string[]>([]);
    const [roleModels, setRoleModels] = useState<RoleModels>({ chat: 'gemini-2.5-flash', code: 'gemini-2.5-flash', reasoner: 'gemini-2.5-flash' });

    // Window/Panel Management
    type WindowName = 'settings' | 'git' | 'plugins' | 'indexing' | 'linting' | 'swarm' | 'memory';
    const [openWindows, setOpenWindows] = useState<Record<WindowName, boolean>>({ settings: false, git: false, plugins: false, indexing: false, linting: false, swarm: false, memory: false });
    const [focusOrder, setFocusOrder] = useState<WindowName[]>([]);

    // --- SERVICES & ENGINES (Memoized) ---
    const intentEngine = useMemo(() => new IntentInferenceEngine(roleModels.reasoner), [roleModels.reasoner]);
    const memoryService = useMemo(() => new MemoryService(), []);
    const analyzer = useMemo(() => new CodebaseAnalyzer(memoryService.getGraphDB()), [memoryService]);
    const gitService = useMemo(() => new GitService(initialFiles), []);
    const pluginService = useMemo(() => new PluginService(files, getFileContent), [files, getFileContent]);
    const indexingService = useMemo(() => new IndexingService(), []);
    const lintingService = useMemo(() => new LintingService(), []);
    
    // --- GIT STATE ---
    const [gitState, setGitState] = useState({ status: { staged: [], modified: [], untracked: [] }, currentBranch: 'main', branches: ['main'], history: [] as Commit[] });

    // --- PLUGIN STATE ---
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [enabledPlugins, setEnabledPlugins] = useState<{ [key: string]: boolean }>({});
    
    // --- INDEXING STATE ---
    const [indexStatus, setIndexStatus] = useState<IndexStatus>({ isIndexed: false, fileCount: 0 });
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isIndexing, setIsIndexing] = useState(false);

    // --- LINTING STATE ---
    const [lintErrors, setLintErrors] = useState<LintingError[]>([]);

    // --- SWARM STATE ---
    const [swarmTask, setSwarmTask] = useState<SwarmTaskStatus>({ goal: '', status: 'idle', plan: [], logs: [] });
    const [agents, setAgents] = useState<Agent[]>([
        { role: 'Planner', description: 'Creates the plan.', model: 'reasoner', isActive: true, isCustom: false },
        { role: 'Designer', description: 'Designs components and APIs.', model: 'reasoner', isActive: true, isCustom: false },
        { role: 'CodeAgent', description: 'Generates API/backend code.', model: 'code', isActive: true, isCustom: false },
        { role: 'UIAgent', description: 'Generates UI/frontend code.', model: 'code', isActive: true, isCustom: false },
        { role: 'TestingAgent', description: 'Generates tests for code.', model: 'code', isActive: true, isCustom: false },
        { role: 'DocumentAgent', description: 'Writes documentation.', model: 'chat', isActive: true, isCustom: false },
        { role: 'ReviewerAgent', description: 'Reviews all generated artifacts for quality.', model: 'reasoner', isActive: true, isCustom: false },
        { role: 'SynthesizerAgent', description: 'Summarizes the results.', model: 'chat', isActive: true, isCustom: false },
    ]);

    // --- HANDLERS ---
    const addToTerminal = useCallback((line: string) => {
        setTerminalOutput(prev => [...prev, line]);
    }, []);

    // Tool executor for Swarm and other services
    const executeTool = async (name: string, args: any): Promise<string> => {
        addToTerminal(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
        switch(name) {
            case 'readFile': return getFileContent(args.path) ?? `Error: File not found at ${args.path}`;
            case 'writeFile': 
                writeFile(args.path, args.content);
                analyzer.updateGraphFromFile(args.path, args.content);
                return `Successfully wrote to ${args.path}`;
            case 'createDirectory':
                return createDirectory(args.path) ? `Created directory ${args.path}` : `Failed to create directory ${args.path}`;
            default: return `Error: Unknown tool '${name}'`;
        }
    }
    
    const swarmCoordinator = useMemo(() => new SwarmCoordinator(
        roleModels, 
        executeTool,
        (update) => setSwarmTask(prev => {
            const newLogs = update.logs ? [...prev.logs, ...update.logs] : prev.logs;
            return {...prev, ...update, logs: newLogs};
        })
    ), [roleModels, files, getFileContent, writeFile, createDirectory, analyzer]);

    // --- EFFECTS ---
    useEffect(() => {
        if (activeFile) {
            const content = getFileContent(activeFile);
            setEditorContent(content ?? '');
        } else {
            setEditorContent('');
        }
    }, [activeFile, getFileContent, files]);
    
    // Automatic debounced linting
    useEffect(() => {
        if (!activeFile) {
            setLintErrors([]);
            return;
        }

        const handler = setTimeout(() => {
            const errors = lintingService.lint(editorContent);
            setLintErrors(errors);
        }, 500); // 500ms debounce delay

        return () => {
            clearTimeout(handler);
        };
    }, [editorContent, activeFile, lintingService]);

    useEffect(() => {
        const modelFiles = listFiles('models');
        setAvailableModels(modelFiles?.map(f => f.replace(/\/$/, '')) ?? []);
    }, [listFiles, files]);

    const updateGitState = useCallback(() => {
        setGitState({
            status: gitService.status(files),
            currentBranch: gitService.getCurrentBranch(),
            branches: gitService.listBranches(),
            history: gitService.getCommitHistory()
        });
    }, [gitService, files]);

    useEffect(() => {
        updateGitState();
    }, [files, updateGitState]);

    useEffect(() => {
        memoryService.load();
        analyzer.buildInitialGraph(files);
        pluginService.loadPlugins(enabledPlugins).then(() => setPlugins(pluginService.getLoadedPlugins()));
        updateGitState();
    }, []); // Run once on mount

    const handleFileSelect = (path: string) => {
        setActiveFile(path);
    };

    const handleEditorChange = (content: string) => {
        setEditorContent(content);
        if (activeFile) {
            updateFileContent(activeFile, content);
            analyzer.updateGraphFromFile(activeFile, content);
        }
    };
    
    const toggleWindow = (name: WindowName) => {
        setOpenWindows(prev => ({...prev, [name]: !prev[name]}));
        if(!openWindows[name]) {
            bringToFront(name);
        }
    };

    const bringToFront = (name: WindowName) => {
        setFocusOrder(prev => [name, ...prev.filter(w => w !== name)]);
    };

    const handleCommit = (message: string) => {
        const success = gitService.commit(files, message);
        if(success) {
            addToTerminal(`Committed changes with message: "${message}"`);
            updateGitState();
        } else {
            addToTerminal(`No changes to commit.`);
        }
    };

    const handleSwitchBranch = (name: string) => {
        const newFiles = gitService.switchBranch(name);
        if (newFiles) {
            setFiles(newFiles);
            setActiveFile(null);
            addToTerminal(`Switched to branch '${name}'.`);
            updateGitState();
        }
    };

    const handleSendMessage = async (prompt: string) => {
        setIsThinking(true);
        const userMessage: Message = { sender: 'user', text: prompt };
        setMessages(prev => [...prev, userMessage]);

        const intentResult = await intentEngine.inferIntent(prompt, pluginService.getRegisteredTools());
        let thought = `Intent: ${intentResult.intent}\nDetails: ${intentResult.details}`;
        let responseText = '';

        try {
            switch (intentResult.intent) {
                case 'code-search':
                    responseText = analyzer.searchCodebase(intentResult.details);
                    break;
                case 'code-generation':
                    if(activeFile) {
                        const fileContent = getFileContent(activeFile);
                        const context = `Current file: ${activeFile}\n\n\`\`\`\n${fileContent}\n\`\`\`\n\nGenerate code for: ${intentResult.details}`;
                        const generatedCode = await generateContent({ model: roleModels.code, prompt: context });
                        handleEditorChange(editorContent + '\n\n' + generatedCode);
                        responseText = "I've added the generated code to the end of the current file.";
                    } else {
                        responseText = "Please open a file first to generate code.";
                    }
                    break;
                case 'swarm-task':
                    if (!openWindows.swarm) toggleWindow('swarm');
                    setIsThinking(false);
                    await swarmCoordinator.run(intentResult.details, agents.filter(a => a.isActive));
                    return; 
                case 'general-chat':
                    responseText = await generateContent({ model: roleModels.chat, prompt: intentResult.details });
                    break;
                default:
                    responseText = `Intent '${intentResult.intent}' not implemented yet.`;
            }
        } catch (e: any) {
            responseText = `An error occurred: ${e.message}`;
            thought += `\nError: ${e.stack}`;
        }
        
        const agentMessage: Message = { sender: 'agent', text: responseText, thought };
        setMessages(prev => [...prev, agentMessage]);
        setIsThinking(false);
        addToTerminal(`Agent responded to: "${prompt.substring(0, 50)}..."`);
    };
    
    return (
        <div className="bg-gray-900 text-green-400 font-mono h-screen flex flex-col p-2 space-y-2 text-xs">
            <header className="flex-shrink-0 flex justify-between items-center border-b-2 border-green-800 pb-2">
                <h1 className="text-lg font-bold">QUONX AI IDE</h1>
                <div className="flex space-x-2">
                    <button onClick={() => toggleWindow('git')}>Git</button>
                    <button onClick={() => toggleWindow('indexing')}>Indexing</button>
                    <button onClick={() => toggleWindow('linting')}>Linting</button>
                    <button onClick={() => toggleWindow('swarm')}>Swarm</button>
                    <button onClick={() => toggleWindow('plugins')}>Plugins</button>
                    <button onClick={() => toggleWindow('settings')}>Settings</button>
                </div>
            </header>

            <main className="flex-grow flex space-x-2 overflow-hidden">
                <div className="w-1/5"><FileExplorer files={files} onFileSelect={handleFileSelect} activeFile={activeFile} onNewFile={(path) => createFile(path)} onNewDirectory={(path) => createDirectory(path)} onRename={(path, newName) => renameNode(path, newName)} onDelete={(path) => deleteNode(path)} /></div>
                <div className="w-3/5 flex flex-col space-y-2"><div className="h-3/5"><Editor content={editorContent} onContentChange={handleEditorChange} activeFile={activeFile} lintErrors={lintErrors} /></div><div className="h-2/5"><Terminal output={terminalOutput} /></div></div>
                <div className="w-1/5"><AIAgentPanel messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking} /></div>
            </main>

            <DraggableWindow title="SETTINGS" isOpen={openWindows.settings} onClose={() => toggleWindow('settings')} zIndex={10 + focusOrder.indexOf('settings')} onFocus={() => bringToFront('settings')}><SettingsPanel settings={settings} onSettingsChange={setSettings} roleModels={roleModels} onRoleModelsChange={setRoleModels} availableModels={availableModels} /></DraggableWindow>
            <DraggableWindow title="GIT SOURCE CONTROL" isOpen={openWindows.git} onClose={() => toggleWindow('git')} zIndex={10 + focusOrder.indexOf('git')} onFocus={() => bringToFront('git')}><GitPanel gitState={gitState} onCommit={handleCommit} onCreateBranch={(name) => { gitService.createBranch(name); updateGitState(); }} onSwitchBranch={handleSwitchBranch} onPush={() => { const res = gitService.push(); addToTerminal(res.message); }} onPull={() => { const res = gitService.pull(); addToTerminal(res.message); if(res.newFiles) setFiles(res.newFiles); updateGitState(); }} getCommitDiff={(id) => gitService.getCommitDiff(id)} onRevertCommit={(id) => { const res = gitService.revertCommit(id); addToTerminal(res.message); if(res.newFiles) setFiles(res.newFiles); updateGitState(); }} /></DraggableWindow>
            <DraggableWindow title="PLUGIN MANAGER" isOpen={openWindows.plugins} onClose={() => toggleWindow('plugins')} zIndex={10 + focusOrder.indexOf('plugins')} onFocus={() => bringToFront('plugins')}><PluginManagerPanel plugins={plugins} enabledPlugins={enabledPlugins} onTogglePlugin={(name, isEnabled) => { const newEnabled = {...enabledPlugins, [name]: isEnabled}; setEnabledPlugins(newEnabled); pluginService.loadPlugins(newEnabled).then(() => setPlugins(pluginService.getLoadedPlugins())); }} /></DraggableWindow>
            <DraggableWindow title="CONTEXT INDEXING" isOpen={openWindows.indexing} onClose={() => toggleWindow('indexing')} zIndex={10 + focusOrder.indexOf('indexing')} onFocus={() => bringToFront('indexing')}><IndexingPanel indexStatus={indexStatus} searchResults={searchResults} isIndexing={isIndexing} onStartIndexing={() => { setIsIndexing(true); indexingService.buildIndex(files).then(count => { setIndexStatus({ isIndexed: true, fileCount: count }); setIsIndexing(false); }); }} onSearch={(query) => setSearchResults(indexingService.search(query))} onResultClick={(result) => setActiveFile(result.path)} /></DraggableWindow>
            <DraggableWindow title="LINTING" isOpen={openWindows.linting} onClose={() => toggleWindow('linting')} zIndex={10 + focusOrder.indexOf('linting')} onFocus={() => bringToFront('linting')}><LintingPanel errors={lintErrors} onClearErrors={() => setLintErrors([])} onRunLint={() => { if (activeFile) { setLintErrors(lintingService.lint(editorContent)); } }} /></DraggableWindow>
            <DraggableWindow title="SWARM ACTIVITY" isOpen={openWindows.swarm} onClose={() => toggleWindow('swarm')} zIndex={10 + focusOrder.indexOf('swarm')} onFocus={() => bringToFront('swarm')}><SwarmPanel task={swarmTask} agents={agents} onToggleAgent={(role) => setAgents(prev => prev.map(a => a.role === role ? {...a, isActive: !a.isActive} : a))} onCreateAgent={(role, desc, model) => { if (!agents.find(a => a.role === role)) { setAgents(prev => [...prev, { role, description: desc, model, isActive: true, isCustom: true }]); } }} /></DraggableWindow>
        </div>
    );
};

export default App;