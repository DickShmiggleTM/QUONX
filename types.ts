import { FileNode } from './FileExplorer';

export interface FileNode {
  name: string;
  content?: string;
  children?: FileNode[];
}

export interface ModelSettings {
  temperature: number;
  topP: number;
  topK: number;
}

export interface RoleModels {
  chat: string;
  code: string;
  reasoner: string;
}

export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  main: string;
  error?: string; // Added to store loading/execution errors
}

export interface PluginTool {
  name:string;
  description: string;
  handler: (args: any) => Promise<string> | string;
}

// --- Git Types ---
export type FileStatus = 'untracked' | 'modified' | 'staged' | 'deleted';

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

// --- Indexing Types ---
export interface IndexStatus {
    isIndexed: boolean;
    fileCount: number;
}

export interface SearchResult {
    path: string;
    line: number;
    match: string;
}

// --- Swarm Types ---
export type AgentRole = 'Planner' | 'Designer' | 'CodeAgent' | 'UIAgent' | 'ReviewerAgent' | 'TestingAgent' | 'DocumentAgent' | 'SynthesizerAgent' | 'Coordinator';

export interface Agent {
    role: AgentRole | string; // Built-in or custom role name
    description: string;
    isActive: boolean;
    isCustom: boolean;
    model: 'chat' | 'code' | 'reasoner'; // Which model this agent should use
}

export interface SwarmPlanStep {
    step: number;
    action: 'designComponent' | 'generateComponentCode' | 'generateApiCode' | 'generateTests' | 'writeDocumentation' | 'readFile' | 'writeFile' | 'editFile' | 'createDirectory' | 'deleteNode' | 'executeShell' | 'final_summary' | 'custom_agent_action';
    agent_role?: AgentRole | string;
    path?: string;
    goal?: string; // Used for design, test, and doc steps
    design?: string; // Output from designer, input for coder
    code_path?: string; // Input for tester/documenter
    content_description?: string;
    instruction?: string;
    status: 'pending' | 'executing' | 'complete' | 'error';
    result?: string;
}

export interface SwarmTaskStatus {
    goal: string;
    status: 'idle' | 'planning' | 'designing' | 'executing' | 'reviewing' | 'testing' | 'documenting' | 'summarizing' | 'finished' | 'failed';
    plan: SwarmPlanStep[];
    logs: { role: AgentRole | string; message: string; timestamp: string }[];
}