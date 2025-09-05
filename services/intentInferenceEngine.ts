// FIX: Added .ts extension to the import path.
import { generateContent } from './geminiService.ts';
// FIX: Added .ts extension to the import path.
import { PluginTool } from '../types.ts';

const SYSTEM_INSTRUCTION = `
You are an expert at interpreting user requests and mapping them to available tools.
Your goal is to determine the user's primary intent and select the best tool for the job.

Available intents:
- 'swarm-task': A complex, high-level goal that requires multiple steps, planning, and the creation or modification of several files. The swarm can design components, write UI and API code, create tests, and write documentation. Examples: "create a new React component for a login form and an API route to handle it", "build a complete feature for user profile management", "refactor the authentication logic to use JWT and document the changes".
- 'file-edit': The user wants to create, delete, or modify a single file directly.
- 'code-generation': The user wants to write or refactor a block of code within the currently open file.
- 'project-refactor': The user wants to perform a large-scale change that likely affects multiple files, such as renaming a function/component and updating all its usages.
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
If the user describes a goal that requires planning and several steps (like creating multiple files or a full feature), choose 'swarm-task'.
For refactoring, prefer 'project-refactor' if the change seems global (e.g., "rename X everywhere"), otherwise use 'code-generation' for single-file changes.
`;

export interface IntentResult {
    intent: 'file-edit' | 'code-generation' | 'code-search' | 'run-command' | 'plugin-tool' | 'general-chat' | 'project-refactor' | 'swarm-task';
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
            // The generateContent service now handles JSON parsing internally.
            const response = await generateContent({
                model: this.model,
                systemInstruction: SYSTEM_INSTRUCTION,
                prompt: fullPrompt,
                json: true,
            });

            // If the response is a string, it indicates an error occurred during generation or parsing.
            if (typeof response === 'string') {
                console.error("Error from intent inference service:", response);
                return {
                    intent: 'general-chat',
                    details: `Failed to understand intent. Details: ${response}`,
                    toolName: null,
                    toolArgs: null
                };
            }
            
            // Otherwise, we expect a valid IntentResult object.
            return response as IntentResult;

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