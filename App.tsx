import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFileSystem, initialFiles } from './hooks/useFileSystem.ts';
import { FileNode, ModelSettings, RoleModels, Plugin, GitStatus, PluginTool, Commit, IndexStatus, SearchResult, SwarmTaskStatus, Agent } from './types.ts';
import { GitIcon, PluginsIcon, SettingsIcon, BugIcon, CloseIcon, FileIcon, SearchIndexIcon, SwarmIcon } from './components/icons.tsx';

import FileExplorer from './components/FileExplorer.tsx';
import Editor from './components/Editor.tsx';
import Terminal from './components/Terminal.tsx';
import SettingsPanel from './components/SettingsPanel.tsx';
import AIAgentPanel from './components/AIAgentPanel.tsx';
import GitPanel from './components/GitPanel.tsx';
import PluginManagerPanel from './components/PluginManagerPanel.tsx';
import DraggableWindow from './components/DraggableWindow.tsx';
import DebuggerPanel from './components/DebuggerPanel.tsx';
import IndexingPanel from './components/IndexingPanel.tsx';
import SwarmPanel from './components/SwarmPanel.tsx';
import { IntentInferenceEngine } from './services/intentInferenceEngine.ts';
import { CodebaseAnalyzer } from './services/codebaseAnalyzer.ts';
import { PluginService } from './services/pluginService.ts';
import { GitService } from './services/gitService.ts';
import { IndexingService } from './services/indexingService.ts';
import { SwarmCoordinator } from './services/swarmService.ts';
import { generateContent } from './services/geminiService.ts';

interface Message {
    sender: 'user' | 'agent';
    text: string;
    thought?: string;
}

interface WindowState {
    isOpen: boolean;
    zIndex: number;
    position?: { x: number, y: number };
}

interface GitState {
    status: GitStatus;
    currentBranch: string;
    branches: string[];
    history: Commit[];
}

interface DebuggerState {
    isActive: boolean;
    isPaused: boolean;
    currentLine: number | null;
    breakpoints: Set<number>;
    callStack: { function: string; file: string; line: number }[];
    scope: Record<string, any>;
}

const initialSwarmTask: SwarmTaskStatus = {
    goal: '',
    status: 'idle',
    plan: [],
    logs: [],
};

const initialAgents: Agent[] = [
    { role: 'Planner', description: 'Creates a step-by-step plan from a high-level goal.', isActive: true, isCustom: false, model: 'reasoner' },
    { role: 'Designer', description: 'Creates detailed technical specifications for features.', isActive: true, isCustom: false, model: 'reasoner' },
    { role: 'CodeAgent', description: 'Writes backend or general-purpose code.', isActive: true, isCustom: false, model: 'code' },
    { role: 'UIAgent', description: 'Writes frontend UI component code (React).', isActive: true, isCustom: false, model: 'code' },
    { role: 'ReviewerAgent', description: 'Reviews generated artifacts for quality and correctness.', isActive: true, isCustom: false, model: 'reasoner' },
    { role: 'TestingAgent', description: 'Generates unit and component tests.', isActive: true, isCustom: false, model: 'code' },
    { role: 'DocumentAgent', description: 'Writes documentation for features and code.', isActive: true, isCustom: false, model: 'chat' },
    { role: 'SynthesizerAgent', description: 'Summarizes the results of the swarm task for the user.', isActive: true, isCustom: false, model: 'chat' },
];


function App() {
    const { files, getFileContent, updateFileContent, createFile, createDirectory, renameNode, deleteNode, writeFile, listFiles, setFiles } = useFileSystem();
    
    // State for tabbed editor
    const [openFiles, setOpenFiles] = useState<string[]>([]);
    const [activeFile, setActiveFile] = useState<string | null>(null);

    const [editorContent, setEditorContent] = useState<string>('');
    const [terminalOutput, setTerminalOutput] = useState<string[]>(['QUONX IDE Initialized. AI Agent ready.']);
    
    // Chat history is now loaded from localStorage on initial render.
    const [messages, setMessages] = useState<Message[]>(() => {
        try {
            const savedHistory = localStorage.getItem('quonx_chat_history');
            if (savedHistory) {
                const parsedHistory = JSON.parse(savedHistory);
                if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
                    return parsedHistory;
                }
            }
        } catch (error) {
            console.error("Could not load chat history from localStorage:", error);
        }
        // Default message if no history or on error
        return [{ sender: 'agent', text: 'Hello! I am your AI assistant. How can I help you with your codebase today?' }];
    });
    
    const [isThinking, setIsThinking] = useState(false);
    
    // Settings
    const [settings, setSettings] = useState<ModelSettings>({ temperature: 0.5, topP: 0.95, topK: 40 });
    const [roleModels, setRoleModels] = useState<RoleModels>({ chat: 'gemini-2.5-flash', code: 'gemini-2.5-flash', reasoner: 'gemini-2.5-flash' });
    const [availableModels, setAvailableModels] = useState<string[]>(['gemini-2.5-flash']);

    // Plugins
    const [plugins, setPlugins] = useState<Plugin[]>([]);
    const [enabledPlugins, setEnabledPlugins] = useState<{ [pluginName: string]: boolean }>({});
    
    // Git Service and State
    const gitService = useMemo(() => new GitService(initialFiles), []);
    const [gitState, setGitState] = useState<GitState>({
        status: { staged: [], modified: [], untracked: [] },
        currentBranch: 'main',
        branches: ['main'],
        history: [],
    });

    // Debugger State
    const [debuggerState, setDebuggerState] = useState<DebuggerState>({
        isActive: false, isPaused: false, currentLine: null,
        breakpoints: new Set(),
        callStack: [], scope: {},
    });
    
    // Indexing State
    const indexingService = useMemo(() => new IndexingService(), []);
    const [indexStatus, setIndexStatus] = useState<IndexStatus>({ isIndexed: false, fileCount: 0 });
    const [isIndexing, setIsIndexing] = useState(false);
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    
    // Swarm State
    const [swarmTask, setSwarmTask] = useState<SwarmTaskStatus>(initialSwarmTask);
    const [agents, setAgents] = useState<Agent[]>(initialAgents);


    // Services
    const intentEngine = useMemo(() => new IntentInferenceEngine(roleModels.reasoner), [roleModels.reasoner]);
    const codebaseAnalyzer = useMemo(() => new CodebaseAnalyzer(), []);
    const pluginService = useMemo(() => new PluginService(files, getFileContent), [files, getFileContent]);

    // Window Management State
    const [windowStates, setWindowStates] = useState<{ [key: string]: WindowState }>({
        git: { isOpen: false, zIndex: 10, position: { x: 50, y: 70 } },
        plugins: { isOpen: false, zIndex: 10, position: { x: 100, y: 120 } },
        settings: { isOpen: false, zIndex: 10, position: { x: 150, y: 170 } },
        debugger: { isOpen: false, zIndex: 10, position: { x: 200, y: 220 } },
        indexing: { isOpen: false, zIndex: 10, position: { x: 250, y: 270 } },
        swarm: { isOpen: false, zIndex: 10, position: { x: 300, y: 320 } },
    });
    const [zCounter, setZCounter] = useState(10);

    const bringToFront = (windowName: string) => {
        if (windowStates[windowName].zIndex >= zCounter) return;
        const newZ = zCounter + 1;
        setZCounter(newZ);
        setWindowStates(prev => ({
            ...prev,
            [windowName]: { ...prev[windowName], zIndex: newZ }
        }));
    };

    const toggleWindow = (windowName: string) => {
        setWindowStates(prev => {
            const isOpen = !prev[windowName].isOpen;
            if (isOpen) {
                 const newZ = zCounter + 1;
                 setZCounter(newZ);
                 return {
                     ...prev,
                     [windowName]: { ...prev[windowName], isOpen: true, zIndex: newZ }
                 };
            }
            return {
                ...prev,
                [windowName]: { ...prev[windowName], isOpen: false }
            };
        });
    };


    const addToTerminal = useCallback((line: string) => {
        setTerminalOutput(prev => [...prev, line]);
    }, []);

    const refreshGitState = useCallback(() => {
        setGitState({
            status: gitService.status(files),
            currentBranch: gitService.getCurrentBranch(),
            branches: gitService.listBranches(),
            history: gitService.getCommitHistory(),
        });
    }, [gitService, files]);

    // Effect to persist chat history to localStorage
    useEffect(() => {
        try {
            localStorage.setItem('quonx_chat_history', JSON.stringify(messages));
        } catch (error) {
            console.error("Could not save chat history to localStorage:", error);
        }
    }, [messages]);

    // Effect to update git status when files change
    useEffect(() => {
        refreshGitState();
    }, [files, refreshGitState]);

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
            
            if (Object.keys(enabledPlugins).length === 0 && loadedPlugins.length > 0) {
                 const initialEnabledState = loadedPlugins.reduce((acc, plugin) => {
                    if (!plugin.error) {
                        acc[plugin.name] = true;
                    }
                    return acc;
                }, {} as { [pluginName: string]: boolean });
                setEnabledPlugins(initialEnabledState);
            }
            
            const tools = pluginService.getRegisteredTools();
            const enabledPluginCount = loadedPlugins.filter(p => enabledPlugins[p.name] !== false && !p.error).length;
            if(enabledPluginCount > 0) {
                addToTerminal(`Loaded ${enabledPluginCount} active plugins and registered ${tools.length} tools.`);
            }
        };
        load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabledPlugins, files, pluginService, addToTerminal]);
    
    const handleOpenMultipleFiles = useCallback((paths: string[]) => {
        const newFilesToOpen = paths.filter(p => !openFiles.includes(p));
        if (newFilesToOpen.length > 0) {
            setOpenFiles(prev => [...prev, ...newFilesToOpen]);
        }
        // Set the last modified file as the active one for immediate review.
        if (paths.length > 0) {
            setActiveFile(paths[paths.length - 1]);
        }
    }, [openFiles]);

    // --- Editor and Tab Management ---
    const handleFileSelect = useCallback((path: string) => {
        const content = getFileContent(path);
        if (content !== null) {
            if (!openFiles.includes(path)) {
                setOpenFiles(prev => [...prev, path]);
            }
            setActiveFile(path);
        } else {
            addToTerminal(`Error: Could not read file content for ${path}`);
        }
    }, [getFileContent, openFiles, addToTerminal]);

    const handleTabClose = (path: string) => {
        const index = openFiles.indexOf(path);
        const newOpenFiles = openFiles.filter(f => f !== path);
        setOpenFiles(newOpenFiles);

        if (path === activeFile) {
            if (newOpenFiles.length > 0) {
                const newActiveIndex = Math.max(0, index - 1);
                setActiveFile(newOpenFiles[newActiveIndex]);
            } else {
                setActiveFile(null);
            }
        }
    };
    
    // Effect to load content when active file changes
    useEffect(() => {
        if (activeFile) {
            const content = getFileContent(activeFile);
            if (content !== null) {
                setEditorContent(content);
            } else {
                addToTerminal(`Error: File '${activeFile}' not found. It may have been deleted.`);
                handleTabClose(activeFile);
            }
        } else {
            setEditorContent('');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile, files]); // Depends on `files` in case a file is renamed/deleted

    const handleContentChange = useCallback((newContent: string) => {
        setEditorContent(newContent);
        if (activeFile) {
            updateFileContent(activeFile, newContent);
            codebaseAnalyzer.updateGraphFromFile(activeFile, newContent);
        }
    }, [activeFile, updateFileContent, codebaseAnalyzer]);
    
    const handleTogglePlugin = (pluginName: string, isEnabled: boolean) => {
        setEnabledPlugins(prev => ({ ...prev, [pluginName]: isEnabled }));
    };

    // --- Git Action Handlers ---
    const handleGitCommit = useCallback((message: string) => {
        const success = gitService.commit(files, message);
        if (success) {
            addToTerminal(`Committed changes with message: "${message}"`);
            refreshGitState();
        } else {
            addToTerminal('No changes to commit.');
        }
    }, [gitService, files, addToTerminal, refreshGitState]);

    const handleCreateBranch = useCallback((branchName: string) => {
        if (!branchName) return;
        const success = gitService.createBranch(branchName);
        if (success) {
            addToTerminal(`Branch '${branchName}' created.`);
            refreshGitState();
        } else {
            addToTerminal(`Error: Branch '${branchName}' already exists.`);
        }
    }, [gitService, addToTerminal, refreshGitState]);

    const handleSwitchBranch = useCallback((branchName: string) => {
        const newFileTree = gitService.switchBranch(branchName);
        if (newFileTree) {
            setFiles(newFileTree);
            setOpenFiles([]);
            setActiveFile(null);
            setEditorContent('');
            addToTerminal(`Switched to branch '${branchName}'.`);
        } else {
            addToTerminal(`Error: Could not switch to branch '${branchName}'.`);
        }
    }, [gitService, setFiles, addToTerminal]);

    const handleGitPush = useCallback(async () => {
        addToTerminal("Pushing to remote origin...");
        const result = gitService.push();
        addToTerminal(result.message);
        refreshGitState();
    }, [gitService, addToTerminal, refreshGitState]);

    const handleGitPull = useCallback(async () => {
        addToTerminal("Pulling from remote origin...");
        const result = gitService.pull();
        addToTerminal(result.message);
        if (result.success && result.newFiles) {
            setFiles(result.newFiles);
            setOpenFiles([]);
            setActiveFile(null);
            setEditorContent('');
        }
        refreshGitState();
    }, [gitService, setFiles, addToTerminal, refreshGitState]);

    // --- Debugger Handlers ---
    const handleToggleBreakpoint = (lineNumber: number) => {
        if (!activeFile) return;
        setDebuggerState(prev => {
            const newBreakpoints = new Set(prev.breakpoints);
            if (newBreakpoints.has(lineNumber)) {
                newBreakpoints.delete(lineNumber);
                addToTerminal(`Breakpoint removed from ${activeFile}:${lineNumber}`);
            } else {
                newBreakpoints.add(lineNumber);
                addToTerminal(`Breakpoint added at ${activeFile}:${lineNumber}`);
            }
            return { ...prev, breakpoints: newBreakpoints };
        });
    };
    
    const startDebugging = () => {
        if (!activeFile) {
            addToTerminal("Debugger: Please select a file to debug.");
            return;
        }
        addToTerminal(`Debugger: Session started for ${activeFile}.`);
        setDebuggerState(prev => ({
            ...prev,
            isActive: true,
            isPaused: true,
            currentLine: 1,
            callStack: [{ function: '(global)', file: activeFile, line: 1 }],
            scope: { 'message': 'Hello World', 'count': 0 },
        }));
    };

    const stopDebugging = () => {
        addToTerminal("Debugger: Session stopped.");
        setDebuggerState(prev => ({ ...prev, isActive: false, isPaused: false, currentLine: null, callStack: [], scope: {} }));
    };

    const stepDebugger = (action: 'over' | 'into' | 'out') => {
        if (!debuggerState.isActive || !debuggerState.isPaused) return;
        
        // This is a simulation. A real implementation would be much more complex.
        setDebuggerState(prev => {
            let nextLine = (prev.currentLine || 0) + 1;
            // Simple loop back for demo
            if(nextLine > editorContent.split('\n').length) {
                nextLine = 1;
            }
            addToTerminal(`Debugger: Stepped ${action} to line ${nextLine}`);
            
            // Simulate scope change
            const newScope = { ...prev.scope };
            newScope['count'] = (newScope['count'] || 0) + 1;
            newScope['status'] = `Stepped ${action} at ${new Date().toLocaleTimeString()}`;

            return { ...prev, currentLine: nextLine, scope: newScope };
        });
    };

    // --- Code Action Handler ---
    const handleCodeAction = (action: 'refactor' | 'test' | 'extract', selection: string) => {
        if (!activeFile) return;

        switch (action) {
            case 'refactor': {
                const instruction = window.prompt("How should I refactor this code?", "Extract this logic into a new function.");
                if (instruction) {
                    const fullPrompt = `refactorCode instruction: ${instruction}, code: \n\`\`\`\n${selection}\n\`\`\``
                    handleSendMessage(fullPrompt);
                }
                break;
            }
            case 'test': {
                const testPrompt = `Generate a test stub for the following code from ${activeFile}:\n\n\`\`\`\n${selection}\n\`\`\``;
                handleSendMessage(testPrompt);
                break;
            }
            case 'extract': {
                const componentName = window.prompt("Enter the new component name (e.g., MyButton):", "NewComponent");
                if (componentName && componentName.trim()) {
                    const swarmGoal = `From the file '${activeFile}', extract the following code into a new React component named '${componentName.trim()}'. 
The new component file should be created at an appropriate location (e.g., 'src/components/${componentName.trim()}.tsx'). 
Then, update the original file ('${activeFile}') to import and use this new component, replacing the original code.

Code to extract:
\`\`\`
${selection}
\`\`\``;
                    handleSendMessage(swarmGoal);
                }
                break;
            }
        }
    };
    
    // --- Indexing Handlers ---
    const handleStartIndexing = useCallback(async () => {
        setIsIndexing(true);
        setSearchResults([]);
        addToTerminal("Starting project indexing...");
        const fileCount = await indexingService.buildIndex(files);
        setIndexStatus({ isIndexed: true, fileCount });
        addToTerminal(`Indexing complete. ${fileCount} files indexed.`);
        setIsIndexing(false);
    }, [addToTerminal, files, indexingService]);

    const handleSearchIndex = useCallback((query: string) => {
        if (!query.trim()) {
            setSearchResults([]);
            return;
        }
        addToTerminal(`Searching index for: "${query}"`);
        const results = indexingService.search(query);
        setSearchResults(results);
        addToTerminal(`Found ${results.length} match(es).`);
    }, [addToTerminal, indexingService]);

    const handleSearchResultClick = useCallback((result: SearchResult) => {
        handleFileSelect(result.path);
        // Future enhancement: scroll editor to result.line
    }, [handleFileSelect]);

    // --- Agent Management Handlers ---
    const handleToggleAgent = (role: string) => {
        setAgents(prev => prev.map(agent => agent.role === role ? { ...agent, isActive: !agent.isActive } : agent));
        const agent = agents.find(a => a.role === role);
        addToTerminal(`Agent '${role}' ${agent?.isActive ? 'deactivated' : 'activated'}.`);
    };

    const handleCreateAgent = (role: string, description: string, model: Agent['model']) => {
        if (!role || !description) {
            addToTerminal("Error: New agent needs a role and description.");
            return;
        }
        if (agents.some(a => a.role.toLowerCase() === role.toLowerCase())) {
            addToTerminal(`Error: Agent with role '${role}' already exists.`);
            return;
        }
        const newAgent: Agent = {
            role,
            description,
            isActive: true,
            isCustom: true,
            model,
        };
        setAgents(prev => [...prev, newAgent]);
        addToTerminal(`Custom agent '${role}' created and activated.`);
    };


    const handleSendMessage = async (prompt: string) => {
        setMessages(prev => [...prev, { sender: 'user', text: prompt }]);
        setIsThinking(true);
        addToTerminal(`User prompt: "${prompt}"`);

        const fileSystemTools: PluginTool[] = [
            {
                name: 'listFiles',
                description: 'Lists files and directories in a given path. Use "." or "" for the root directory. args: { path: string }',
                handler: async (args: { path: string }) => {
                    if (!args || typeof args.path !== 'string') return "Error: 'path' argument is required and must be a string.";
                    const targetPath = args.path === '.' ? '' : args.path;
                    const result = listFiles(targetPath);
                    if (result === null) return `Error: Directory not found at '${args.path}'`;
                    if (result.length === 0) return `Directory '${args.path}' is empty.`;
                    return `Contents of '${args.path}':\n- ${result.join('\n- ')}`;
                }
            },
            {
                name: 'readFile',
                description: 'Reads the content of a file at a given path. args: { path: string }',
                handler: async (args: { path: string }) => {
                    if (!args || !args.path) return "Error: 'path' argument is required.";
                    const content = getFileContent(args.path);
                    if (content === null) return `Error: Could not read file at '${args.path}'. It might not exist or it might be a directory.`;
                    return `Content of ${args.path}:\n\n\`\`\`\n${content}\n\`\`\``;
                }
            },
            {
                name: 'writeFile',
                description: 'Writes or overwrites content to a file. Creates the file if it does not exist. args: { path: string, content: string }',
                handler: async (args: { path: string, content: string }) => {
                    if (!args || !args.path || args.content === undefined) return "Error: 'path' and 'content' arguments are required.";
                    const newPath = writeFile(args.path, args.content);
                    if (newPath) {
                        addToTerminal(`AI has written to ${newPath}`);
                        handleFileSelect(newPath);
                        return `Successfully wrote to ${newPath}.`;
                    }
                    return `Error: Failed to write to file at ${args.path}.`;
                }
            },
            {
                name: 'editFile',
                description: 'Edits an existing file based on an instruction. This is for refactoring or modification, not creating new files. args: { path: string, instruction: string }',
                handler: async (args: { path: string, instruction: string }) => {
                    if (!args || !args.path || !args.instruction) return "Error: 'path' and 'instruction' arguments are required.";
                    
                    const originalContent = getFileContent(args.path);
                    if (originalContent === null) return `Error: Could not read file at '${args.path}'. It might not exist.`;

                    addToTerminal(`AI is editing ${args.path}...`);
                    const editPrompt = `You are an expert AI programmer. The user wants to modify the file located at '${args.path}'.

Current file content:
\`\`\`
${originalContent}
\`\`\`

User's instruction for modification: "${args.instruction}"

Your task is to rewrite the entire file to incorporate the user's instruction.
Your response MUST be ONLY the complete, updated content of the file.
Do not add any commentary, explanations, or markdown formatting (like \`\`\`typescript) around the code block.`;

                    const newContent = await generateContent({
                        model: roleModels.code,
                        prompt: editPrompt,
                    });

                    if (newContent && newContent.length > 0 && !newContent.startsWith('Error from Gemini API')) {
                        const updatedPath = writeFile(args.path, newContent);
                        if (updatedPath) {
                            handleFileSelect(updatedPath);
                            return `Successfully edited and saved ${updatedPath}.`;
                        }
                        return `Error: Failed to write edited content to ${args.path}.`;
                    }
                    return `I apologize, but I encountered an error while editing the file. Details: ${newContent}`;
                }
            },
            {
                name: 'refactorCode',
                description: 'Refactors a selected piece of code within the currently open file based on a user instruction. args: { instruction: string, code: string }',
                handler: async (args: { instruction: string; code: string }) => {
                    if (!activeFile) return "Error: No file is currently open.";
                    if (!args || !args.instruction || !args.code) return "Error: 'instruction' and 'code' arguments are required.";
                    
                    const fileContent = getFileContent(activeFile);
                    if (!fileContent) return `Error: Could not read content of ${activeFile}.`;

                    const refactorPrompt = `You are an expert AI refactoring tool. The user wants to refactor a piece of code in the file '${activeFile}'.

Full file content:
\`\`\`
${fileContent}
\`\`\`

The user has selected the following code snippet to refactor:
\`\`\`
${args.code}
\`\`\`

User's instruction: "${args.instruction}"

Your task is to rewrite the ENTIRE file content with the refactoring applied.
Your response MUST be ONLY the complete, updated content of the file.
Do not add any commentary, explanations, or markdown formatting.`;

                    addToTerminal(`AI refactoring ${activeFile}...`);
                    const newContent = await generateContent({ model: roleModels.code, prompt: refactorPrompt });
                    
                    if (newContent && !newContent.startsWith('Error')) {
                        handleContentChange(newContent);
                        return `Successfully refactored the code in ${activeFile}.`;
                    }
                    return `Error: AI failed to refactor the code. Details: ${newContent}`;
                }
            },
            {
                name: 'createDirectory',
                description: 'Creates a new directory. args: { path: string }',
                handler: async (args: { path: string }) => {
                    if (!args || !args.path) return "Error: 'path' argument is required.";
                    const newPath = createDirectory(args.path);
                    if (newPath) return `Successfully created directory ${newPath}.`;
                    return `Error: Failed to create directory at ${args.path}.`;
                }
            },
            {
                name: 'deleteNode',
                description: 'Deletes a file or directory. args: { path: string }',
                handler: async (args: { path: string }) => {
                    if (!args || !args.path) return "Error: 'path' argument is required.";
                    handleDeleteNode(args.path);
                    return `Successfully deleted ${args.path}.`;
                }
            }
        ];

        const builtInTools: PluginTool[] = [
            {
                name: 'executeProjectRefactor',
                description: 'Executes a complex, multi-file refactoring task based on a natural language instruction. Use for renaming functions/variables/components across the entire project. args: { instruction: string }',
                handler: async (args: { instruction: string }) => {
                    if (!indexStatus.isIndexed) {
                        return "Error: Project index has not been built. Please build the index before attempting a project-wide refactor.";
                    }
                    if (!args || !args.instruction) return "Error: An instruction is required for refactoring.";

                    addToTerminal(`AI is planning a project-wide refactor for: "${args.instruction}"`);

                    // Step 1: Find relevant files using the index
                    // Simple keyword extraction: find words in quotes or camelCase/PascalCase words.
                    const keywords = args.instruction.match(/`([^`]+)`|'([^']+)'|"([^"]+)"|[a-zA-Z0-9_]+/g) || [];
                    const searchTerms = keywords.map(k => k.replace(/['"`]/g, '')).filter(k => k.length > 2);
                    if (searchTerms.length === 0) return "Error: Could not determine what to search for from the instruction.";
                    
                    const allResults = searchTerms.flatMap(term => indexingService.search(term));
                    const uniqueFilePaths = [...new Set(allResults.map(r => r.path))];

                    if (uniqueFilePaths.length === 0) {
                        return `Could not find any files related to the instruction.`;
                    }
                    addToTerminal(`Found ${uniqueFilePaths.length} potentially relevant files.`);

                    // Step 2: Gather context and prompt the AI
                    const fileContents = uniqueFilePaths.map(path => {
                        const content = getFileContent(path);
                        return `--- START FILE: ${path} ---\n${content}\n--- END FILE ---`;
                    }).join('\n\n');

                    const refactorPrompt = `You are an expert AI programmer executing a project-wide refactoring task.
The user's instruction is: "${args.instruction}"

I have found the following relevant files and their content:
${fileContents}

Your task is to analyze the user's instruction and the provided file contents. Then, generate a JSON array of objects, where each object represents a file that needs to be modified. Each object must have two keys: "filePath" (a string) and "newContent" (a string containing the complete new content for that file). If a file does not need to be changed, do not include it in the array.

Your response MUST be ONLY the valid JSON array. Do not include any explanations, markdown, or other text.`;

                    const refactorPlan = await generateContent({
                        model: roleModels.code,
                        prompt: refactorPrompt,
                        json: true
                    });

                    // Step 3: Execute the plan
                    if (!Array.isArray(refactorPlan)) {
                        const errorDetails = typeof refactorPlan === 'string' ? refactorPlan : JSON.stringify(refactorPlan);
                        return `Error: The AI failed to generate a valid refactoring plan. Details: ${errorDetails}`;
                    }

                    addToTerminal(`AI generated a plan with ${refactorPlan.length} file modification(s). Applying changes...`);
                    const modifiedFiles = [];
                    for (const change of refactorPlan) {
                        if (change.filePath && typeof change.newContent === 'string') {
                            writeFile(change.filePath, change.newContent);
                            addToTerminal(`AI modified ${change.filePath}`);
                            modifiedFiles.push(change.filePath);
                        }
                    }
                    
                    if(modifiedFiles.length > 0) {
                        handleOpenMultipleFiles(modifiedFiles);
                    }

                    return `Project refactoring complete. ${modifiedFiles.length} file(s) were modified and have been opened for your review.`;
                }
            },
            {
                name: 'generateDocstrings',
                description: 'Analyzes the currently open file and adds JSDoc comments to functions and classes that are missing documentation. args: {}',
                handler: async () => {
                    if (!activeFile) {
                        return "Error: No file is currently open in the editor.";
                    }
                    addToTerminal(`Generating docstrings for ${activeFile}...`);
                    const newContent = codebaseAnalyzer.generateDocstrings(editorContent);
                    if (newContent !== editorContent) {
                        handleContentChange(newContent);
                        return `Successfully generated and applied docstrings to ${activeFile}.`;
                    } else {
                        return `No new docstrings were needed for ${activeFile}.`;
                    }
                }
            },
            // --- Expanded Git Tools ---
            {
                name: 'gitStatus',
                description: 'Checks the current git status of the project.',
                handler: async () => {
                    const { modified, untracked } = gitState.status;
                    if (!modified.length && !untracked.length) {
                        return `On branch ${gitState.currentBranch}. Working tree is clean.`;
                    }
                    let statusText = `On branch ${gitState.currentBranch}:\n`;
                    if (modified.length) statusText += `Modified files:\n${modified.map(f => `  - ${f}`).join('\n')}\n`;
                    if (untracked.length) statusText += `Untracked files:\n${untracked.map(f => `  - ${f}`).join('\n')}\n`;
                    return statusText.trim();
                }
            },
             {
                name: 'gitCommit',
                description: 'Commits all current changes. args: { message: string }',
                handler: async (args: { message: string }) => {
                    if (!args || !args.message) return "Error: A commit message is required.";
                    handleGitCommit(args.message);
                    return `Attempting to commit changes with message: "${args.message}"`;
                }
            },
            {
                name: 'gitBranch',
                description: 'Creates a new branch. args: { name: string }',
                handler: async (args: { name: string }) => {
                    if (!args || !args.name) return "Error: A branch name is required.";
                    handleCreateBranch(args.name);
                    return `Attempting to create branch '${args.name}'.`;
                }
            },
            {
                name: 'gitCheckout',
                description: 'Switches to a different branch. args: { name: string }',
                handler: async (args: { name: string }) => {
                    if (!args || !args.name) return "Error: A branch name is required.";
                    handleSwitchBranch(args.name);
                    return `Attempting to switch to branch '${args.name}'.`;
                }
            },
            {
                name: 'gitLog',
                description: 'Shows the commit history for the current branch.',
                handler: async () => {
                    const history = gitService.getCommitHistory();
                    if (history.length === 0) return "No commits in history.";
                    return `Commit history for ${gitState.currentBranch}:\n` +
                        history.map(c => `- ${c.id.substring(0, 7)}: ${c.message}`).join('\n');
                }
            },
            {
                name: 'gitPush',
                description: 'Pushes committed changes to the remote repository.',
                handler: async () => {
                    await handleGitPush();
                    return "Push command executed. Check terminal for results.";
                }
            },
             {
                name: 'gitPull',
                description: 'Pulls changes from the remote repository.',
                handler: async () => {
                    await handleGitPull();
                    return "Pull command executed. Check terminal for results.";
                }
            }
        ];

        const allTools = [...pluginService.getRegisteredTools(), ...builtInTools, ...fileSystemTools];
        
        const toolExecutor = useCallback(async (name: string, args: any) => {
            const tool = allTools.find(t => t.name === name);
            if (tool) {
                return await tool.handler(args);
            }
            return `Error: Tool '${name}' not found.`;
        }, [allTools]);
        
        const swarmUpdateCallback = useCallback((update: Partial<SwarmTaskStatus>) => {
            setSwarmTask(prev => ({
                ...prev,
                ...update,
                // Special handling for logs and plan to append instead of replacing
                logs: update.logs ? [...prev.logs, ...update.logs] : prev.logs,
                plan: update.plan ? update.plan.map((newStep, index) => ({ ...prev.plan[index], ...newStep })) : prev.plan,
            }));
        }, []);

        const swarmCoordinator = useMemo(() => new SwarmCoordinator(roleModels, toolExecutor, swarmUpdateCallback), [roleModels, toolExecutor, swarmUpdateCallback]);

        const intentResult = await intentEngine.inferIntent(prompt, allTools);

        let agentResponse = '';
        let thought = `Intent: ${intentResult.intent}\nDetails: ${intentResult.details}`;
        if (intentResult.toolName) {
            thought += `\nTool: ${intentResult.toolName}\nArgs: ${JSON.stringify(intentResult.toolArgs)}`;
        }

        switch(intentResult.intent) {
            case 'swarm-task':
                toggleWindow('swarm'); // Show the swarm panel
                bringToFront('swarm');
                const activeAgents = agents.filter(a => a.isActive);
                const swarmResult = await swarmCoordinator.run(intentResult.details, activeAgents);
                agentResponse = swarmResult.finalMessage;
                break;
            case 'code-search':
                agentResponse = codebaseAnalyzer.searchCodebase(intentResult.details);
                addToTerminal(`Executing code search: "${intentResult.details}"`);
                break;
            case 'project-refactor':
                const refactorTool = builtInTools.find(t => t.name === 'executeProjectRefactor')!;
                agentResponse = await refactorTool.handler({ instruction: intentResult.details });
                break;
             case 'code-generation':
                if (!activeFile) {
                    agentResponse = "Please open a file before requesting code generation or modification.";
                    thought += "\nAction: Aborted. No file is open.";
                    break;
                }
                addToTerminal(`AI is generating code for ${activeFile}...`);
                thought += `\nAction: Generating code for ${activeFile}.`;
                
                const generationPrompt = `You are an expert AI programmer. The user wants to modify the file located at '${activeFile}'.

Current file content:
\`\`\`
${editorContent}
\`\`\`

User's request: "${intentResult.details}"

Your task is to rewrite the entire file to incorporate the user's request.
Your response MUST be ONLY the complete, updated content of the file.
Do not add any commentary, explanations, or markdown formatting (like \`\`\`typescript) around the code block.`;

                const newFileContent = await generateContent({
                    model: roleModels.code,
                    prompt: generationPrompt,
                });
                
                if (newFileContent && newFileContent.length > 0 && !newFileContent.startsWith('Error from Gemini API')) {
                    handleContentChange(newFileContent);
                    agentResponse = `I have updated the code in ${activeFile} as you requested. Please review the changes.`;
                    thought += `\nOutcome: Successfully updated ${activeFile}.`;
                } else {
                    agentResponse = `I apologize, but I encountered an error while generating the code. Please try again. Details: ${newFileContent}`;
                    thought += `\nOutcome: Failed to generate code. Response was empty or an error.`;
                }
                break;
            case 'plugin-tool':
                const tool = allTools.find(t => t.name === intentResult.toolName);
                if (tool) {
                    addToTerminal(`Executing tool: ${tool.name} with args ${JSON.stringify(intentResult.toolArgs)}`);
                    try {
                        let args = intentResult.toolArgs;
                        if(tool.name === 'refactorCode' && activeFile) {
                            args.fullContent = getFileContent(activeFile);
                        }
                        const result = await tool.handler(args);
                        agentResponse = `Tool '${tool.name}' executed:\n${result}`;
                    } catch (error) {
                        console.error(`Error executing tool ${tool.name}:`, error);
                        agentResponse = `Error executing tool '${tool.name}': ${error instanceof Error ? error.message : 'Unknown error'}`;
                    }
                } else {
                    agentResponse = `Error: Could not find tool '${intentResult.toolName}'.`;
                }
                break;
            default: // general-chat
                agentResponse = await generateContent({ model: roleModels.chat, prompt });
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
    
    const handleNewDirectory = (path: string) => {
        const newPath = createDirectory(path);
        if (newPath) {
            addToTerminal(`Directory created: ${newPath}`);
        } else {
            addToTerminal(`Error: Failed to create directory at ${path}`);
        }
    };

    const handleDeleteNode = (path: string) => {
        const success = deleteNode(path);
        if (success) {
            addToTerminal(`Deleted: ${path}`);
            if (activeFile && (activeFile === path || activeFile.startsWith(path + '/'))) {
                handleTabClose(path);
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
            // Update open tabs and active file if they are affected by the rename
            setOpenFiles(prevOpen => prevOpen.map(p => p === path ? newPath : (p.startsWith(path + '/') ? p.replace(path, newPath) : p)));
            if (activeFile === path) {
                setActiveFile(newPath);
            } else if (activeFile && activeFile.startsWith(path + '/')) {
                const updatedSelectedPath = activeFile.replace(path, newPath);
                setActiveFile(updatedSelectedPath);
            }
            // Update codebase analyzer
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
        <div className="bg-gray-900 text-green-400 font-mono h-screen flex flex-col p-2 overflow-hidden">
            <header className="flex-shrink-0 mb-2 flex justify-between items-center">
                <h1 className="text-xl border-b-2 border-green-700 pb-1">QUONX - AI-Powered IDE</h1>
                 <div className="flex items-center space-x-2">
                    <button onClick={() => toggleWindow('swarm')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Swarm Activity"><SwarmIcon className="w-5 h-5" /></button>
                    <button onClick={() => toggleWindow('indexing')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Indexing Menu"><SearchIndexIcon className="w-5 h-5" /></button>
                    <button onClick={() => toggleWindow('debugger')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Debugger"><BugIcon className="w-5 h-5" /></button>
                    <button onClick={() => toggleWindow('git')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Git Status"><GitIcon className="w-5 h-5" /></button>
                    <button onClick={() => toggleWindow('plugins')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Plugin Manager"><PluginsIcon className="w-5 h-5" /></button>
                    <button onClick={() => toggleWindow('settings')} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Settings"><SettingsIcon className="w-5 h-5" /></button>
                </div>
            </header>
            <main className="flex-grow grid grid-cols-12 grid-rows-6 gap-2 min-h-0">
                <div className="col-span-2 row-span-6">
                    <FileExplorer 
                        files={files} 
                        onFileSelect={handleFileSelect} 
                        activeFile={activeFile}
                        onNewFile={handleNewFile}
                        onNewDirectory={handleNewDirectory}
                        onRename={handleRenameNode}
                        onDelete={handleDeleteNode}
                    />
                </div>
                <div className="col-span-6 row-span-4 flex flex-col">
                    {/* Tab Bar */}
                    <div className="flex-shrink-0 flex items-center bg-black/50 border-b-0 border-green-800">
                        {openFiles.map(path => (
                            <div
                                key={path}
                                onClick={() => setActiveFile(path)}
                                className={`flex items-center p-2 cursor-pointer border-r border-green-900/50 ${activeFile === path ? 'bg-green-800/50' : 'bg-gray-800/30 hover:bg-gray-700/50'}`}
                            >
                                <FileIcon className="w-3 h-3 mr-2 flex-shrink-0" />
                                <span className="truncate max-w-xs">{path.split('/').pop()}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTabClose(path);
                                    }}
                                    className="ml-3 p-0.5 hover:bg-red-500 rounded-sm"
                                    aria-label={`Close ${path} tab`}
                                >
                                    <CloseIcon className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                         {openFiles.length === 0 && (
                            <div className="p-2 text-gray-500">
                                No files open.
                            </div>
                        )}
                    </div>
                    {/* Editor Component */}
                    <div className="flex-grow min-h-0">
                        <Editor 
                            activeFile={activeFile} 
                            content={editorContent} 
                            onContentChange={handleContentChange}
                            breakpoints={debuggerState.breakpoints}
                            onToggleBreakpoint={handleToggleBreakpoint}
                            activeDebugLine={debuggerState.currentLine}
                            onCodeAction={handleCodeAction}
                        />
                    </div>
                </div>
                <div className="col-span-4 row-span-4">
                    <AIAgentPanel messages={messages} onSendMessage={handleSendMessage} isThinking={isThinking} />
                </div>
                <div className="col-span-10 row-span-2">
                    <Terminal output={terminalOutput} />
                </div>
            </main>
            
            <DraggableWindow
                title="GIT SOURCE CONTROL"
                isOpen={windowStates.git.isOpen}
                onClose={() => toggleWindow('git')}
                zIndex={windowStates.git.zIndex}
                onFocus={() => bringToFront('git')}
                initialPosition={windowStates.git.position}
            >
                <GitPanel 
                    gitState={gitState} 
                    onCommit={handleGitCommit}
                    onCreateBranch={handleCreateBranch}
                    onSwitchBranch={handleSwitchBranch}
                    onPush={handleGitPush}
                    onPull={handleGitPull}
                />
            </DraggableWindow>
            
            <DraggableWindow
                title="PLUGIN MANAGER"
                isOpen={windowStates.plugins.isOpen}
                onClose={() => toggleWindow('plugins')}
                zIndex={windowStates.plugins.zIndex}
                onFocus={() => bringToFront('plugins')}
                 initialPosition={windowStates.plugins.position}
            >
                <PluginManagerPanel plugins={plugins} enabledPlugins={enabledPlugins} onTogglePlugin={handleTogglePlugin} />
            </DraggableWindow>

            <DraggableWindow
                title="SETTINGS"
                isOpen={windowStates.settings.isOpen}
                onClose={() => toggleWindow('settings')}
                zIndex={windowStates.settings.zIndex}
                onFocus={() => bringToFront('settings')}
                 initialPosition={windowStates.settings.position}
            >
                <SettingsPanel settings={settings} onSettingsChange={setSettings} roleModels={roleModels} onRoleModelsChange={setRoleModels} availableModels={availableModels}/>
            </DraggableWindow>

            <DraggableWindow
                title="DEBUGGER"
                isOpen={windowStates.debugger.isOpen}
                onClose={() => toggleWindow('debugger')}
                zIndex={windowStates.debugger.zIndex}
                onFocus={() => bringToFront('debugger')}
                 initialPosition={windowStates.debugger.position}
            >
                <DebuggerPanel 
                    debuggerState={debuggerState} 
                    onStart={startDebugging}
                    onStop={stopDebugging}
                    onStep={stepDebugger}
                />
            </DraggableWindow>

            <DraggableWindow
                title="INDEXING MENU"
                isOpen={windowStates.indexing.isOpen}
                onClose={() => toggleWindow('indexing')}
                zIndex={windowStates.indexing.zIndex}
                onFocus={() => bringToFront('indexing')}
                initialPosition={windowStates.indexing.position}
            >
                <IndexingPanel 
                    indexStatus={indexStatus}
                    searchResults={searchResults}
                    isIndexing={isIndexing}
                    onStartIndexing={handleStartIndexing}
                    onSearch={handleSearchIndex}
                    onResultClick={handleSearchResultClick}
                />
            </DraggableWindow>
            
            <DraggableWindow
                title="SWARM ACTIVITY"
                isOpen={windowStates.swarm.isOpen}
                onClose={() => toggleWindow('swarm')}
                zIndex={windowStates.swarm.zIndex}
                onFocus={() => bringToFront('swarm')}
                initialPosition={windowStates.swarm.position}
            >
                <SwarmPanel 
                    task={swarmTask} 
                    agents={agents}
                    onToggleAgent={handleToggleAgent}
                    onCreateAgent={handleCreateAgent}
                />
            </DraggableWindow>
        </div>
    );
}

export default App;