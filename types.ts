/**
 * @interface FileNode
 * @description Represents a file or directory in the file system.
 */
export interface FileNode {
  name: string;
  content?: string;
  children?: FileNode[];
}

/**
 * @interface GraphNode
 * @description Represents a node in the knowledge graph.
 */
export interface GraphNode {
    id: string;
    type: 'file' | 'function-def' | 'class-def' | 'call' | 'user-prompt' | 'ai-response' | 'file-edit' | string; // Allow string for custom types
    path?: string;
    name: string;
    properties: Record<string, any>;
}

/**
 * @interface Edge
 * @description Represents an edge in the knowledge graph.
 */
export interface Edge {
    sourceId: string;
    targetId: string;
    type: string;
}

/**
 * @interface ModelSettings
 * @description Represents the settings for the AI models.
 */
export interface ModelSettings {
  temperature: number;
  topP: number;
  topK: number;
}

/**
 * @type Role
 * @description Represents the role of an AI model.
 */
export type Role = 'chat' | 'code' | 'reasoner';
/**
 * @interface RoleModels
 * @description Represents the models assigned to each role.
 */
export interface RoleModels {
  chat: string;
  code: string;
  reasoner: string;
  [key: string]: string; // To allow indexing with a string
}

/**
 * @interface Plugin
 * @description Represents a plugin.
 */
export interface Plugin {
    name: string;
    version: string;
    description: string;
    author: string;
    main: string;
    error?: string;
}

/**
 * @interface PluginTool
 * @description Represents a tool provided by a plugin.
 */
export interface PluginTool {
    name: string;
    description: string;
    handler: (args: any) => Promise<string> | string;
}

/**
 * @interface GitStatus
 * @description Represents the status of the Git repository.
 */
export interface GitStatus {
    staged: string[];
    modified: string[];
    untracked: string[];
    conflicts: string[];
}

/**
 * @interface Commit
 * @description Represents a Git commit.
 */
export interface Commit {
    id: string;
    message: string;
    parents: string[];
    tree: Map<string, string>;
    timestamp: number;
}

/**
 * @interface CommitDiff
 * @description Represents the diff of a commit.
 */
export interface CommitDiff {
    added: string[];
    modified: { path: string; diff: string }[];
    deleted: string[];
}

/**
 * @interface IndexStatus
 * @description Represents the status of the index.
 */
export interface IndexStatus {
    isIndexed: boolean;
    fileCount: number;
}

/**
 * @interface SearchResult
 * @description Represents a search result.
 */
export interface SearchResult {
    path: string;
    line: number;
    match: string;
}

/**
 * @interface SwarmPlanStep
 * @description Represents a step in a swarm plan.
 */
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

/**
 * @type SwarmStatus
 * @description Represents the status of a swarm task.
 */
export type SwarmStatus = 'idle' | 'planning' | 'designing' | 'executing' | 'reviewing' | 'testing' | 'documenting' | 'summarizing' | 'finished' | 'failed';

/**
 * @interface SwarmTaskStatus
 * @description Represents the status of a swarm task.
 */
export interface SwarmTaskStatus {
    goal: string;
    status: SwarmStatus;
    plan: SwarmPlanStep[];
    logs: { role: AgentRole | string; message: string; timestamp: string }[];
}

/**
 * @type AgentRole
 * @description Represents the role of an agent in the swarm.
 */
export type AgentRole = 'Planner' | 'Designer' | 'CodeAgent' | 'UIAgent' | 'ReviewerAgent' | 'TestingAgent' | 'DocumentAgent' | 'SynthesizerAgent' | 'Coordinator' | string;

/**
 * @interface Agent
 * @description Represents an agent in the swarm.
 */
export interface Agent {
    role: AgentRole;
    description: string;
    model: 'chat' | 'code' | 'reasoner';
    isActive: boolean;
    isCustom: boolean;
}

/**
 * @interface Message
 * @description Represents a message in the chat.
 */
export interface Message {
    sender: 'user' | 'agent';
    text: string;
    thought?: string;
}

/**
 * @interface LintingError
 * @description Represents a linting error.
 */
export interface LintingError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'warning';
}

/**
 * @interface DebuggerState
 * @description Represents the state of the debugger.
 */
export interface DebuggerState {
    isActive: boolean;
    isPaused: boolean;
    currentLine: number | null;
    breakpoints: Map<number, string>; // Maps line number to a condition string
    callStack: { function: string; file: string; line: number }[];
    scope: Record<string, any>;
}