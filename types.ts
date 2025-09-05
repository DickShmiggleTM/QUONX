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
  name: string;
  description: string;
  handler: (args: any) => Promise<string> | string;
}
