// FIX: Add .ts extension to import path. This file was created to resolve "not a module" errors.
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Per guidelines, initialize with apiKey from environment variables.
// The key's availability is a hard requirement and handled externally.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface GenerateContentOptions {
    model: string;
    prompt: string;
    systemInstruction?: string;
    json?: boolean;
}

/**
 * Generates content using the Gemini API.
 * This is a wrapper to centralize API calls.
 */
export const generateContent = async ({ model, prompt, systemInstruction, json }: GenerateContentOptions): Promise<string> => {
    try {
        const config: { systemInstruction?: string; responseMimeType?: string; } = {};
        if (systemInstruction) {
            config.systemInstruction = systemInstruction;
        }
        if (json) {
            config.responseMimeType = "application/json";
        }

        // Per guidelines, call generateContent with model and contents.
        const response: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: prompt,
            // Conditionally add config only if it has properties
            ...(Object.keys(config).length > 0 && { config }),
        });
        
        // Per guidelines, access the text directly from the response object.
        return response.text;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `Error from Gemini API: ${error.message}`;
        }
        return "An unknown error occurred while contacting the Gemini API.";
    }
};
