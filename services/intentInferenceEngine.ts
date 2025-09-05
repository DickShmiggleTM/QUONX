// FIX: Added .ts extension to the import path.
import { generateContent } from './geminiService.ts';
// FIX: Added .ts extension to the import path.
import { PluginTool } from '../types.ts';

const SYSTEM_INSTRUCTION = `
You are an expert at interpreting user requests and mapping them to available tools.
Your goal is to determine the user's primary intent and select the best tool for the job.

Available intents:
- 'file-edit': The user wants to create, delete, or modify a file. This is for direct manipulation.
- 'code-generation': The user wants to write or refactor a block of code.
- 'code-search': The user is asking questions about the codebase structure, like "where is X defined?" or "who calls Y?".
- 'run-command': The user wants to execute a terminal command (e.g., 'npm install').
- 'plugin-tool': The user's request maps directly to a custom plugin tool.
- 'general-chat': A general question or conversation that doesn't fit other categories.

You must respond ONLY with a valid JSON object matching this structure:
{
  "intent": "<one of the intents>",
  "details": "<a summary of the task, e.g., the file path, the code to generate, or the question about the codebase>",
  "toolName": "<name of the plugin tool if intent is 'plugin-tool', otherwise null>",
  "toolArgs": "<arguments for the plugin tool as an object, otherwise null>"
}

Analyze the user's prompt and the list of available plugin tools to make your decision.
If a plugin tool is a perfect match, use the 'plugin-tool' intent.
`;

export interface IntentResult {
    intent: 'file-edit' | 'code-generation' | 'code-search' | 'run-command' | 'plugin-tool' | 'general-chat';
    details: string;
    toolName: string | null;
    toolArgs: any | null;
}

export class IntentInferenceEngine {
    private model: string;

    constructor(model: string) {
        this.model = model;
    }

    public async inferIntent(prompt: string, tools: PluginTool[]): Promise<IntentResult> {
        const toolsDescription = tools.map(t => `- ${t.name}: ${t.description}`).join('\n');
        const fullPrompt = `
User Prompt: "${prompt}"

Available Plugin Tools:
${toolsDescription || 'No plugin tools available.'}
`;

        try {
            // FIX: Use the 'json: true' flag to get a reliable JSON response and simplify parsing.
            const responseText = await generateContent({
                model: this.model,
                systemInstruction: SYSTEM_INSTRUCTION,
                prompt: fullPrompt,
                json: true,
            });
            
            let parsedResponse: IntentResult;
            try {
                // The response should be a clean JSON string.
                parsedResponse = JSON.parse(responseText);
            } catch (e) {
                console.error("Failed to parse intent JSON:", responseText, e);
                return {
                    intent: 'general-chat',
                    details: prompt,
                    toolName: null,
                    toolArgs: null
                };
            }
            return parsedResponse;
        } catch (error) {
            console.error("Error inferring intent:", error);
            return {
                intent: 'general-chat',
                details: `Error during intent inference: ${error instanceof Error ? error.message : 'Unknown error'}`,
                toolName: null,
                toolArgs: null,
            };
        }
    }
}
