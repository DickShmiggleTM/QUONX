import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ProjectState {
    root_path: string | null;
    open_files: string[];
    active_file: string | null;
}

export interface AIEngineState {
    is_running: boolean;
    port: number;
    available_models: string[];
    active_models: Record<string, string>; // role -> model_name
}

export interface FileChangeEvent {
    path: string;
    event_type: string;
    timestamp: number;
}

export class TauriService {
    private static instance: TauriService;
    private listeners: Map<string, () => void> = new Map();

    private constructor() {}

    public static getInstance(): TauriService {
        if (!TauriService.instance) {
            TauriService.instance = new TauriService();
        }
        return TauriService.instance;
    }

    // AI Engine Management
    async initializeAIEngine(): Promise<boolean> {
        try {
            return await invoke<boolean>('initialize_ai_engine');
        } catch (error) {
            console.error('Failed to initialize AI engine:', error);
            return false;
        }
    }

    async shutdownAIEngine(): Promise<boolean> {
        try {
            return await invoke<boolean>('shutdown_ai_engine');
        } catch (error) {
            console.error('Failed to shutdown AI engine:', error);
            return false;
        }
    }

    async getAIEngineState(): Promise<AIEngineState | null> {
        try {
            return await invoke<AIEngineState>('get_ai_engine_state');
        } catch (error) {
            console.error('Failed to get AI engine state:', error);
            return null;
        }
    }

    async sendAIRequest(message: string, role: string = 'chat'): Promise<string | null> {
        try {
            return await invoke<string>('send_ai_request', { message, role });
        } catch (error) {
            console.error('Failed to send AI request:', error);
            return null;
        }
    }

    async listAvailableModels(): Promise<string[]> {
        try {
            return await invoke<string[]>('list_available_models');
        } catch (error) {
            console.error('Failed to list available models:', error);
            return [];
        }
    }

    async setModelForRole(role: string, model: string): Promise<boolean> {
        try {
            return await invoke<boolean>('set_model_for_role', { role, model });
        } catch (error) {
            console.error('Failed to set model for role:', error);
            return false;
        }
    }

    // Project Management
    async openProject(path: string): Promise<boolean> {
        try {
            return await invoke<boolean>('open_project', { path });
        } catch (error) {
            console.error('Failed to open project:', error);
            return false;
        }
    }

    async getProjectState(): Promise<ProjectState | null> {
        try {
            return await invoke<ProjectState>('get_project_state');
        } catch (error) {
            console.error('Failed to get project state:', error);
            return null;
        }
    }

    // Event Listeners
    async onFileChanged(callback: (event: FileChangeEvent) => void): Promise<() => void> {
        const unlisten = await listen<FileChangeEvent>('file-changed', (event) => {
            callback(event.payload);
        });

        const key = 'file-changed';
        if (this.listeners.has(key)) {
            this.listeners.get(key)?.();
        }
        this.listeners.set(key, unlisten);

        return unlisten;
    }

    async onTriggerAnalysis(callback: (event: any) => void): Promise<() => void> {
        const unlisten = await listen('trigger-analysis', (event) => {
            callback(event.payload);
        });

        const key = 'trigger-analysis';
        if (this.listeners.has(key)) {
            this.listeners.get(key)?.();
        }
        this.listeners.set(key, unlisten);

        return unlisten;
    }

    // Utility Methods
    cleanup(): void {
        // Clean up all listeners
        this.listeners.forEach((unlisten) => {
            unlisten();
        });
        this.listeners.clear();
    }

    // Check if running in Tauri environment
    static isTauri(): boolean {
        return typeof window !== 'undefined' && '__TAURI__' in window;
    }

    // Fallback for development when not in Tauri
    static createMockService(): TauriService {
        const mockService = new TauriService();
        
        // Override methods with mock implementations
        mockService.initializeAIEngine = async () => {
            console.log('Mock: AI Engine initialized');
            return true;
        };

        mockService.sendAIRequest = async (message: string, role: string) => {
            console.log(`Mock AI Request [${role}]: ${message}`);
            // Return a mock response based on the role
            if (role === 'code') {
                return `// Mock code response for: ${message}\nfunction mockFunction() {\n    return "Hello, World!";\n}`;
            } else {
                return `Mock response for: ${message}`;
            }
        };

        mockService.listAvailableModels = async () => {
            return ['mock-model-7b', 'mock-code-model-13b', 'mock-reasoning-model-34b'];
        };

        mockService.getAIEngineState = async () => {
            return {
                is_running: true,
                port: 8765,
                available_models: ['mock-model-7b', 'mock-code-model-13b'],
                active_models: {
                    chat: 'mock-model-7b',
                    code: 'mock-code-model-13b',
                    reasoner: 'mock-reasoning-model-34b'
                }
            };
        };

        mockService.openProject = async (path: string) => {
            console.log(`Mock: Opening project at ${path}`);
            return true;
        };

        mockService.getProjectState = async () => {
            return {
                root_path: '/mock/project/path',
                open_files: ['src/main.ts', 'src/app.tsx'],
                active_file: 'src/app.tsx'
            };
        };

        return mockService;
    }
}

// Export a singleton instance
export const tauriService = TauriService.isTauri() 
    ? TauriService.getInstance() 
    : TauriService.createMockService();