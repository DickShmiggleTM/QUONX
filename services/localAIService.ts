import { tauriService } from './tauriService';

export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}

export interface AIResponse {
    content: string;
    model?: string;
    tokens_used?: number;
    processing_time?: number;
}

export class LocalAIService {
    private static instance: LocalAIService;
    private isInitialized = false;
    private availableModels: string[] = [];
    private activeModels: Record<string, string> = {};

    private constructor() {}

    public static getInstance(): LocalAIService {
        if (!LocalAIService.instance) {
            LocalAIService.instance = new LocalAIService();
        }
        return LocalAIService.instance;
    }

    async initialize(): Promise<boolean> {
        if (this.isInitialized) {
            return true;
        }

        try {
            // Initialize the AI engine
            const success = await tauriService.initializeAIEngine();
            if (!success) {
                console.error('Failed to initialize AI engine');
                return false;
            }

            // Get available models
            this.availableModels = await tauriService.listAvailableModels();
            console.log('Available models:', this.availableModels);

            // Get current AI engine state
            const state = await tauriService.getAIEngineState();
            if (state) {
                this.activeModels = state.active_models;
            }

            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize LocalAIService:', error);
            return false;
        }
    }

    async generateContent(messages: AIMessage[], role: string = 'chat'): Promise<string> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Convert messages to a single prompt
            const prompt = this.messagesToPrompt(messages);
            
            // Send request to the AI engine
            const response = await tauriService.sendAIRequest(prompt, role);
            
            if (!response) {
                throw new Error('No response from AI engine');
            }

            return response;
        } catch (error) {
            console.error('Failed to generate content:', error);
            throw error;
        }
    }

    async generateCodeCompletion(code: string, context?: string): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful coding assistant. Complete the given code or provide suggestions.'
            }
        ];

        if (context) {
            messages.push({
                role: 'user',
                content: `Context: ${context}\n\nCode to complete:\n${code}`
            });
        } else {
            messages.push({
                role: 'user',
                content: `Complete this code:\n${code}`
            });
        }

        return this.generateContent(messages, 'code');
    }

    async explainCode(code: string, language?: string): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful coding assistant. Explain the given code clearly and concisely.'
            },
            {
                role: 'user',
                content: `Explain this ${language || ''} code:\n\n${code}`
            }
        ];

        return this.generateContent(messages, 'code');
    }

    async generateDocumentation(code: string, language?: string): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful documentation assistant. Generate clear, comprehensive documentation for the given code.'
            },
            {
                role: 'user',
                content: `Generate documentation for this ${language || ''} code:\n\n${code}`
            }
        ];

        return this.generateContent(messages, 'code');
    }

    async reviewCode(code: string, language?: string): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful code reviewer. Review the given code for potential issues, improvements, and best practices.'
            },
            {
                role: 'user',
                content: `Review this ${language || ''} code:\n\n${code}`
            }
        ];

        return this.generateContent(messages, 'reasoner');
    }

    async planTask(description: string): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'system',
                content: 'You are a helpful project planning assistant. Break down tasks into clear, actionable steps.'
            },
            {
                role: 'user',
                content: `Create a detailed plan for: ${description}`
            }
        ];

        return this.generateContent(messages, 'reasoner');
    }

    async getAvailableModels(): Promise<string[]> {
        if (!this.isInitialized) {
            await this.initialize();
        }
        return this.availableModels;
    }

    async setModelForRole(role: string, model: string): Promise<boolean> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const success = await tauriService.setModelForRole(role, model);
            if (success) {
                this.activeModels[role] = model;
            }
            return success;
        } catch (error) {
            console.error('Failed to set model for role:', error);
            return false;
        }
    }

    getActiveModels(): Record<string, string> {
        return { ...this.activeModels };
    }

    async shutdown(): Promise<void> {
        if (this.isInitialized) {
            await tauriService.shutdownAIEngine();
            this.isInitialized = false;
        }
    }

    private messagesToPrompt(messages: AIMessage[]): string {
        // Convert messages array to a single prompt string
        let prompt = '';
        
        for (const message of messages) {
            if (message.role === 'system') {
                prompt += `System: ${message.content}\n\n`;
            } else if (message.role === 'user') {
                prompt += `User: ${message.content}\n\n`;
            } else if (message.role === 'assistant') {
                prompt += `Assistant: ${message.content}\n\n`;
            }
        }

        // Add assistant prompt at the end
        prompt += 'Assistant: ';
        
        return prompt;
    }

    // Compatibility method for existing code that uses generateContent directly
    async generateResponse(prompt: string, role: string = 'chat'): Promise<string> {
        const messages: AIMessage[] = [
            {
                role: 'user',
                content: prompt
            }
        ];

        return this.generateContent(messages, role);
    }
}

// Export singleton instance
export const localAIService = LocalAIService.getInstance();