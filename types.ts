// types.ts

// From useFileSystem.ts
export interface FileNode {
  name: string;
  content?: string;
  children?: FileNode[];
}

// From codebaseAnalyzer.ts, graphDB.ts, memoryService.ts
export interface GraphNode {
    id: string;
    type: 'file' | 'function-def' | 'class-def' | 'call' | 'user-prompt' | 'ai-response' | 'file-edit' | string; // Allow string for custom types
    path?: string;
    name: string;
    properties: Record<string, any>;
}

export interface Edge {
    sourceId: string;
    targetId: string;
    type: string;
}

// From SettingsPanel.tsx
export interface ModelSettings {
  temperature: number;
  topP: number;
  topK: number;
}

export type Role = 'chat' | 'code' | 'reasoner';
export interface RoleModels {
  chat: string;
  code: string;
  reasoner: string;
  [key: string]: string; // To allow indexing with a string
}

// From pluginService.ts, PluginManagerPanel.tsx
export interface Plugin {
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    error?: string;
}

export interface PluginTool {
    name: string;
    description: string;
    handler: (args: any) => Promise<string> | string;
}

// From gitService.ts, GitPanel.tsx
export interface GitStatus {
    staged: string[];
    modified: string[];
    untracked: string[];
}

export interface Commit {
    id: string;
    message: string;
    parents: string[];
    tree: Map<string, string>;
    timestamp: number;
}

export interface CommitDiff {
    added: string[];
    modified: { path: string; diff: string }[];
    deleted: string[];
}

// From indexingService.ts, IndexingPanel.tsx
export interface IndexStatus {
    isIndexed: boolean;
    fileCount: number;
}

export interface SearchResult {
    path: string;
    line: number;
    match: string;
}

// From swarmService.ts, SwarmPanel.tsx
export interface SwarmPlanStep {
    step: number;
    action: string;
    goal?: string;
    path?: string;
    code_path?: string;
    instruction?: string;
    content_description?: string;
    agent_role?: string;
    status: 'pending' | 'executing' | 'complete' | 'error';
    result?: string;
}

export type SwarmStatus = 'idle' | 'planning' | 'designing' | 'executing' | 'reviewing' | 'testing' | 'documenting' | 'summarizing' | 'finished' | 'failed';

export interface SwarmTaskStatus {
    goal: string;
    status: SwarmStatus;
    plan: SwarmPlanStep[];
    logs: { role: AgentRole | string; message: string; timestamp: string }[];
}

export type AgentRole = 'Planner' | 'Designer' | 'CodeAgent' | 'UIAgent' | 'ReviewerAgent' | 'TestingAgent' | 'DocumentAgent' | 'SynthesizerAgent' | 'Coordinator' | string;

export interface Agent {
    role: AgentRole;
    description: string;
    model: 'chat' | 'code' | 'reasoner';
    isActive: boolean;
    isCustom: boolean;
}

// From AIAgentPanel.tsx
export interface Message {
    sender: 'user' | 'agent';
    text: string;
    thought?: string;
}

// From lintingService.ts
export interface LintingError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}
