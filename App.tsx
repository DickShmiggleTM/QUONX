import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FileExplorer from './components/FileExplorer.tsx';
import Editor from './components/Editor.tsx';
import Terminal from './components/Terminal.tsx';
import AIAgentPanel from './components/AIAgentPanel.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import { useFileSystem, initialFiles } from './hooks/useFileSystem.ts';
import { generateContent } from './services/geminiService.ts';
import { Message, ModelSettings, RoleModels, FileNode, GitStatus, Commit, CommitDiff, Plugin, SearchResult, IndexStatus, LintingError, SwarmTaskStatus, Agent, DebuggerState, GraphNode } from './types.ts';
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
import DebuggerPanel from './components/DebuggerPanel.tsx';
import { DebuggerService } from './services/debuggerService.ts';
import MemoryPanel from './components/MemoryPanel.tsx';


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
    type WindowName = 'settings' | 'git' | 'plugins' | 'indexing' | 'linting' | 'swarm' | 'memory' | 'debugger';
    const [openWindows, setOpenWindows] = useState<Record<WindowName, boolean>>({ settings: false, git: false, plugins: false, indexing: false, linting: false, swarm: false, memory: false, debugger: false });
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
    // FIX: Initialize gitState.status with the 'conflicts' property to match the GitStatus type.
    const [gitState, setGitState] = useState({ status: { staged: [], modified: [], untracked: [], conflicts: [] }, currentBranch: 'main', branches: ['main'], history: [] as Commit[] });

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
    
    // --- DEBUGGER STATE ---
    const [debuggerState, setDebuggerState] = useState<DebuggerState>({
        isActive: false,
        isPaused: false,
        currentLine: null,
        breakpoints: new Map(),
        callStack: [],
        scope: {},
    });
    
    // --- MEMORY STATE ---
    const [isMemoryEnabled, setIsMemoryEnabled] = useState(true);
    const [graphData, setGraphData] = useState<{ nodes: GraphNode[], edges: any[] }>({ nodes: [], edges: [] });
    
    const debuggerService = useMemo(() => new DebuggerService(setDebuggerState), []);


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
        if (memoryService.load()) {
            addToTerminal("Loaded knowledge graph from memory.");
        }
        analyzer.buildInitialGraph(files);
        setGraphData(memoryService.getGraphData());
        pluginService.loadPlugins(enabledPlugins).then(() => setPlugins(pluginService.getLoadedPlugins()));
        updateGitState();
    }, []); // Run once on mount

    const handleFileSelect = (path: string) => {
        setActiveFile(path);
    };
    
    const handleDeleteNode = (path: string) => {
        analyzer.removeGraphNodesForPath(path);
        const success = deleteNode(path);
        if (success) {
            if(activeFile === path) setActiveFile(null);
            setGraphData(memoryService.getGraphData());
            memoryService.save();
            addToTerminal(`Deleted ${path}`);
        }
    };


    const handleEditorChange = (content: string) => {
        setEditorContent(content);
        if (activeFile) {
            updateFileContent(activeFile, content);
            analyzer.updateGraphFromFile(activeFile, content);
            setGraphData(memoryService.getGraphData());
            memoryService.save();
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
    
    const handleSetBreakpoint = useCallback((line: number, condition: string | null) => {
        setDebuggerState(prev => {
            const newBreakpoints = new Map(prev.breakpoints);
            if (condition === null) {
                newBreakpoints.delete(line);
            } else {
                newBreakpoints.set(line, condition);
            }
            debuggerService.updateBreakpoints(newBreakpoints);
            return { ...prev, breakpoints: newBreakpoints };
        });
    }, [debuggerService]);
    
    const pluginToolImplementations = useMemo(() => ({
        gitStatus: () => {
            const status = gitService.status(files);
            return `Current Branch: ${gitService.getCurrentBranch()}\n\nModified:\n${status.modified.length > 0 ? status.modified.map(f => `  - ${f}`).join('\n') : '  (none)'}\n\nUntracked:\n${status.untracked.length > 0 ? status.untracked.map(f => `  - ${f}`).join('\n') : '  (none)'}`;
        },
        gitCommit: (args: { message: string }) => {
            if (!args?.message) return "Error: Commit message is required.";
            const success = gitService.commit(files, args.message);
            if (success) {
                updateGitState();
                return `Committed changes with message: "${args.message}"`;
            }
            return "No changes to commit.";
        },
        gitPush: () => {
            const res = gitService.push();
            addToTerminal(res.message);
            updateGitState();
            return res.message;
        },
        gitPull: () => {
            const res = gitService.pull();
            addToTerminal(res.message);
            if(res.newFiles) {
                setFiles(res.newFiles);
                setActiveFile(null);
                addToTerminal("File tree updated from pull. Select a file to view.");
            }
            return res.message;
        },
        gitBranch: (args: { name: string }) => {
            if (!args?.name) return "Error: Branch name is required.";
            const success = gitService.createBranch(args.name);
            if (success) {
                updateGitState();
                return `Created new branch '${args.name}'.`;
            }
            return `Error: Branch '${args.name}' already exists.`;
        }
    }), [gitService, files, updateGitState, setFiles, addToTerminal]);

    const handleSendMessage = async (prompt: string) => {
        setIsThinking(true);
        const userMessage: Message = { sender: 'user', text: prompt };
        setMessages(prev => [...prev, userMessage]);

        const intentResult = await intentEngine.inferIntent(prompt, pluginService.getRegisteredTools());
        let thought = `Intent: ${intentResult.intent}\nTool: ${intentResult.toolName || 'N/A'}\nArgs: ${JSON.stringify(intentResult.toolArgs) || 'N/A'}`;
        let responseText = '';

        if (isMemoryEnabled) {
            const memories = memoryService.findRelevantMemories(prompt, activeFile);
            if (memories.length > 0) {
                const context = memories.map(m => `- ${m.type} '${m.name}' in ${m.path || 'global'}`).join('\n');
                thought += `\n\n[Memory Context]\nFound ${memories.length} relevant memories:\n${context}`;
            }
        }

        try {
            switch (intentResult.intent) {
                case 'plugin-tool':
                    if (intentResult.toolName && intentResult.toolName in pluginToolImplementations) {
                        const toolFn = pluginToolImplementations[intentResult.toolName as keyof typeof pluginToolImplementations];
                        // @ts-ignore
                        responseText = await Promise.resolve(toolFn(intentResult.toolArgs));
                    } else {
                        responseText = `Error: Plugin tool '${intentResult.toolName}' is not implemented.`;
                    }
                    break;
                case 'code-search':
                    responseText = analyzer.searchCodebase(intentResult.details);
                    break;
                case 'project-refactor': {
                    const refactorMatch = intentResult.details.match(/rename\s+'?(\w+)'?\s+to\s+'?(\w+)'?/i);
                    if (!refactorMatch) {
                        responseText = "I couldn't understand the rename request. Please use the format: 'rename oldName to newName'.";
                        break;
                    }
                    const [, oldName, newName] = refactorMatch;
                    thought += `\nRefactoring: ${oldName} -> ${newName}`;
            
                    const definitionNode = analyzer.findDefinition(oldName);
                    if (!definitionNode) {
                        responseText = `Could not find a definition for '${oldName}'.`;
                        break;
                    }
            
                    const usageNodes = analyzer.findUsages(definitionNode.id);
                    const affectedNodes = [definitionNode, ...usageNodes];
                    const changesByFile = new Map<string, { path: string; linesToChange: number[] }>();
            
                    for (const node of affectedNodes) {
                        if (!node.path) continue;
                        if (!changesByFile.has(node.path)) {
                            changesByFile.set(node.path, { path: node.path, linesToChange: [] });
                        }
                        changesByFile.get(node.path)!.linesToChange.push(node.properties.line);
                    }
                    
                    const updatedFiles: string[] = [];
                    const renameRegex = new RegExp(`\\b${oldName}\\b`, 'g');
            
                    for (const [, change] of changesByFile) {
                        const originalContent = getFileContent(change.path);
                        if (originalContent === null) continue;
            
                        const lines = originalContent.split('\n');
                        const uniqueLinesToChange = new Set(change.linesToChange); 
            
                        uniqueLinesToChange.forEach(lineNumber => {
                            const lineIndex = lineNumber - 1;
                            if (lines[lineIndex]) {
                                lines[lineIndex] = lines[lineIndex].replace(renameRegex, newName);
                            }
                        });
                        
                        const newContent = lines.join('\n');
                        writeFile(change.path, newContent);
                        analyzer.updateGraphFromFile(change.path, newContent);
                        updatedFiles.push(change.path);
                    }
            
                    responseText = `Successfully renamed '${oldName}' to '${newName}'.\nUpdated ${affectedNodes.length} occurrence(s) in ${updatedFiles.length} file(s):\n- ${[...new Set(updatedFiles)].join('\n- ')}`;
                    break;
                }
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
        
        memoryService.addInteractionMemory(prompt, responseText, activeFile);
        setGraphData(memoryService.getGraphData());
        memoryService.save();

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
                    <button onClick={() => toggleWindow('debugger')}>Debugger</button>
                    <button onClick={() => toggleWindow('swarm')}>Swarm</button>
                    <button onClick={() => toggleWindow('memory')}>Memory</button>
                    <button onClick={() => toggleWindow('plugins')}>Plugins</button>
                    <button onClick={() => toggleWindow('settings')}>Settings</button>
                </div>
            </header>

            <main className="flex-grow flex space-x-2 overflow-hidden">
                <div className="w-1/5"><FileExplorer files={files} onFileSelect={handleFileSelect} activeFile={activeFile} onNewFile={(path) => createFile(path)} onNewDirectory={(path) => createDirectory(path)} onRename={(path, newName) => renameNode(path, newName)} onDelete={handleDeleteNode} /></div>
                <div className="w-3/5 flex flex-col space-y-2"><div className="h-3/5"><Editor content={editorContent} onContentChange={handleEditorChange} activeFile={activeFile} lintErrors={lintErrors} breakpoints={debuggerState.breakpoints} onSetBreakpoint={handleSetBreakpoint} debuggerLine={debuggerState.currentLine} /></div><div className="h-2/5"><Terminal output={terminalOutput} /></div></div>
                <div className="w-1/5"><AIAgentPanel messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking} /></div>
            </main>

            <DraggableWindow title="SETTINGS" isOpen={openWindows.settings} onClose={() => toggleWindow('settings')} zIndex={10 + focusOrder.indexOf('settings')} onFocus={() => bringToFront('settings')}><SettingsPanel settings={settings} onSettingsChange={setSettings} roleModels={roleModels} onRoleModelsChange={setRoleModels} availableModels={availableModels} /></DraggableWindow>
            <DraggableWindow title="GIT SOURCE CONTROL" isOpen={openWindows.git} onClose={() => toggleWindow('git')} zIndex={10 + focusOrder.indexOf('git')} onFocus={() => bringToFront('git')}>
                <GitPanel 
                    gitState={gitState} 
                    onCommit={handleCommit} 
                    onCreateBranch={(name) => { gitService.createBranch(name); updateGitState(); }} 
                    onSwitchBranch={handleSwitchBranch} 
                    onPush={() => { 
                        const res = gitService.push(); 
                        addToTerminal(res.message);
                        updateGitState(); 
                    }} 
                    onPull={() => { 
                        const res = gitService.pull(); 
                        addToTerminal(res.message); 
                        if(res.newFiles) {
                            setFiles(res.newFiles);
                            setActiveFile(null);
                            addToTerminal("File tree updated from pull. Select a file to view.");
                        }
                    }} 
                    getCommitDiff={(id) => gitService.getCommitDiff(id)} 
                    onRevertCommit={(id) => { const res = gitService.revertCommit(id); addToTerminal(res.message); if(res.newFiles) setFiles(res.newFiles); updateGitState(); }} />
            </DraggableWindow>
            <DraggableWindow title="PLUGIN MANAGER" isOpen={openWindows.plugins} onClose={() => toggleWindow('plugins')} zIndex={10 + focusOrder.indexOf('plugins')} onFocus={() => bringToFront('plugins')}><PluginManagerPanel plugins={plugins} enabledPlugins={enabledPlugins} onTogglePlugin={(name, isEnabled) => { const newEnabled = {...enabledPlugins, [name]: isEnabled}; setEnabledPlugins(newEnabled); pluginService.loadPlugins(newEnabled).then(() => setPlugins(pluginService.getLoadedPlugins())); }} /></DraggableWindow>
            <DraggableWindow title="CONTEXT INDEXING" isOpen={openWindows.indexing} onClose={() => toggleWindow('indexing')} zIndex={10 + focusOrder.indexOf('indexing')} onFocus={() => bringToFront('indexing')}><IndexingPanel indexStatus={indexStatus} searchResults={searchResults} isIndexing={isIndexing} onStartIndexing={() => { setIsIndexing(true); indexingService.buildIndex(files).then(count => { setIndexStatus({ isIndexed: true, fileCount: count }); setIsIndexing(false); }); }} onSearch={(query) => setSearchResults(indexingService.search(query))} onResultClick={(result) => setActiveFile(result.path)} /></DraggableWindow>
            <DraggableWindow title="LINTING" isOpen={openWindows.linting} onClose={() => toggleWindow('linting')} zIndex={10 + focusOrder.indexOf('linting')} onFocus={() => bringToFront('linting')}><LintingPanel errors={lintErrors} onClearErrors={() => setLintErrors([])} onRunLint={() => { if (activeFile) { setLintErrors(lintingService.lint(editorContent)); } }} /></DraggableWindow>
            <DraggableWindow title="DEBUGGER" isOpen={openWindows.debugger} onClose={() => toggleWindow('debugger')} zIndex={10 + focusOrder.indexOf('debugger')} onFocus={() => bringToFront('debugger')}><DebuggerPanel debuggerState={debuggerState} onStart={() => activeFile && debuggerService.start(editorContent, debuggerState.breakpoints, activeFile)} onStop={() => debuggerService.stop()} onStep={(action) => debuggerService.stepOver()} /></DraggableWindow>
            <DraggableWindow title="SWARM ACTIVITY" isOpen={openWindows.swarm} onClose={() => toggleWindow('swarm')} zIndex={10 + focusOrder.indexOf('swarm')} onFocus={() => bringToFront('swarm')}><SwarmPanel task={swarmTask} agents={agents} onToggleAgent={(role) => setAgents(prev => prev.map(a => a.role === role ? {...a, isActive: !a.isActive} : a))} onCreateAgent={(role, desc, model) => { if (!agents.find(a => a.role === role)) { setAgents(prev => [...prev, { role, description: desc, model, isActive: true, isCustom: true }]); } }} /></DraggableWindow>
            <DraggableWindow title="KNOWLEDGE GRAPH MEMORY" isOpen={openWindows.memory} onClose={() => toggleWindow('memory')} zIndex={10 + focusOrder.indexOf('memory')} onFocus={() => bringToFront('memory')}><MemoryPanel isMemoryEnabled={isMemoryEnabled} onToggleMemory={setIsMemoryEnabled} onSearch={(query) => memoryService.search(query)} graphData={graphData} /></DraggableWindow>
        </div>
    );
};

export default App;