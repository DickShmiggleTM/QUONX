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
 * If 'json' is true, it attempts to parse the response as JSON.
 */
export const generateContent = async ({ model, prompt, systemInstruction, json }: GenerateContentOptions): Promise<any> => {
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
        
        const responseText = response.text;

        if (json) {
            try {
                // The API can sometimes wrap the JSON in markdown backticks, so we clean it.
                const cleanJsonString = responseText.replace(/^```json\s*/, '').replace(/```$/, '');
                return JSON.parse(cleanJsonString);
            } catch (error) {
                console.error("Failed to parse JSON from Gemini API:", responseText, error);
                if (error instanceof Error) {
                    return `Error: Failed to parse JSON response. Details: ${error.message}`;
                }
                return "Error: Failed to parse JSON response from Gemini API.";
            }
        }
        
        // Per guidelines, access the text directly from the response object if not JSON.
        return responseText;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            return `Error from Gemini API: ${error.message}`;
        }
        return "An unknown error occurred while contacting the Gemini API.";
    }
};