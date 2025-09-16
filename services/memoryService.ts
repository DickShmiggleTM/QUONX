import { FileNode, GraphNode } from '../types.ts';
import { GraphDB } from './graphDB.ts';
import { CodebaseAnalyzer } from './codebaseAnalyzer.ts';

const MEMORY_STORAGE_KEY = 'quonx_ide_memory_graph';

/**
 * @class MemoryService
 * @description A service for managing the knowledge graph memory.
 */
export class MemoryService {
    private graphDB: GraphDB;
    private lastSave: number = 0;
    private saveThrottle: number = 5000; // 5 seconds

    constructor() {
        this.graphDB = new GraphDB();
    }
    
    /**
     * @function getGraphDB
     * @description Gets the GraphDB instance.
     * @returns {GraphDB} The GraphDB instance.
     */
    public getGraphDB(): GraphDB {
        return this.graphDB;
    }

    /**
     * @function buildInitialMemory
     * @description Builds the initial memory from the file system.
     * @param {FileNode[]} files - The root nodes of the file system.
     * @param {CodebaseAnalyzer} analyzer - The codebase analyzer.
     * @returns {void}
     */
    public buildInitialMemory(files: FileNode[], analyzer: CodebaseAnalyzer): void {
        this.graphDB.clear();
        analyzer.buildInitialGraph(files);
        this.save();
    }

    /**
     * @function updateMemoryFromFile
     * @description Updates the memory from a file.
     * @param {string} path - The path of the file.
     * @param {string} content - The content of the file.
     * @param {CodebaseAnalyzer} analyzer - The codebase analyzer.
     * @returns {void}
     */
    public updateMemoryFromFile(path: string, content: string, analyzer: CodebaseAnalyzer): void {
        analyzer.updateGraphFromFile(path, content);
    }
    
    /**
     * @function removeMemoryForPath
     * @description Removes the memory for a given path.
     * @param {string} path - The path of the file.
     * @returns {void}
     */
    public removeMemoryForPath(path: string): void {
        this.graphDB.deleteNodesByPath(path);
    }

    /**
     * @function addInteractionMemory
     * @description Adds an interaction to the memory.
     * @param {string} prompt - The user's prompt.
     * @param {string} response - The AI's response.
     * @param {string | null} activeFile - The currently active file.
     * @returns {void}
     */
    public addInteractionMemory(prompt: string, response: string, activeFile: string | null): void {
        const timestamp = Date.now();
        const promptId = `prompt-${timestamp}`;
        const responseId = `response-${timestamp}`;

        const promptNode: GraphNode = {
            id: promptId,
            type: 'user-prompt',
            name: 'User Prompt',
            properties: { text: prompt, timestamp }
        };
        this.graphDB.addNode(promptNode);

        const responseNode: GraphNode = {
            id: responseId,
            type: 'ai-response',
            name: 'AI Response',
            properties: { text: response, timestamp }
        };
        this.graphDB.addNode(responseNode);
        
        this.graphDB.addEdge({ sourceId: responseId, targetId: promptId, type: 'response_to' });

        if (activeFile) {
            const fileNode = this.graphDB.getNode(activeFile);
            if (fileNode) {
                this.graphDB.addEdge({ sourceId: promptId, targetId: fileNode.id, type: 'references' });
            }
        }
    }

    /**
     * @function findRelevantMemories
     * @description Finds relevant memories for a given prompt.
     * @param {string} prompt - The user's prompt.
     * @param {string | null} activeFile - The currently active file.
     * @param {number} [limit=5] - The maximum number of memories to return.
     * @returns {GraphNode[]} An array of relevant memories.
     */
    public findRelevantMemories(prompt: string, activeFile: string | null, limit: number = 5): GraphNode[] {
        const keywords = prompt.toLowerCase().match(/\b(\w+)\b/g) || [];
        const uniqueKeywords = [...new Set(keywords)].filter(k => k.length > 3);
        
        const scoredNodes: Map<GraphNode, number> = new Map();

        this.graphDB.getAllNodes().forEach(node => {
            let score = 0;
            const nodeText = `${node.name} ${JSON.stringify(node.properties)}`.toLowerCase();

            if (activeFile && node.path === activeFile) {
                score += 5; // High priority for nodes in the active file
            }

            uniqueKeywords.forEach(keyword => {
                if (nodeText.includes(keyword)) {
                    score += 1;
                    if (node.name.toLowerCase().includes(keyword)) {
                        score += 2; // Higher score for name matches
                    }
                }
            });
            
            if (score > 0) {
                scoredNodes.set(node, score);
            }
        });
        
        const sorted = Array.from(scoredNodes.entries()).sort((a, b) => b[1] - a[1]);
        return sorted.slice(0, limit).map(entry => entry[0]);
    }
    
    /**
     * @function search
     * @description Searches the memory for a given query.
     * @param {string} query - The search query.
     * @returns {GraphNode[]} An array of matching nodes.
     */
    public search(query: string): GraphNode[] {
        if (!query) return [];
        const lowerCaseQuery = query.toLowerCase();
        return this.graphDB.findNodes(node => 
            `${node.name} ${JSON.stringify(node.properties)}`.toLowerCase().includes(lowerCaseQuery)
        );
    }
    
    /**
     * @function getGraphData
     * @description Gets the data for the knowledge graph.
     * @returns {{ nodes: GraphNode[], edges: any[] }} The graph data.
     */
    public getGraphData(): { nodes: GraphNode[], edges: any[] } {
        return {
            nodes: this.graphDB.getAllNodes(),
            edges: this.graphDB.getAllEdges(),
        };
    }

    /**
     * @function save
     * @description Saves the memory to local storage.
     * @returns {void}
     */
    public save(): void {
        const now = Date.now();
        if (now - this.lastSave < this.saveThrottle) {
            return; // Throttled
        }
        try {
            const serializedGraph = this.graphDB.toJSON();
            localStorage.setItem(MEMORY_STORAGE_KEY, serializedGraph);
            this.lastSave = now;
        } catch (error) {
            console.error("Failed to save memory to localStorage:", error);
        }
    }

    /**
     * @function load
     * @description Loads the memory from local storage.
     * @returns {boolean} Whether the memory was loaded successfully.
     */
    public load(): boolean {
        try {
            const serializedGraph = localStorage.getItem(MEMORY_STORAGE_KEY);
            if (serializedGraph) {
                return this.graphDB.fromJSON(serializedGraph);
            }
        } catch (error) {
            console.error("Failed to load memory from localStorage:", error);
        }
        return false;
    }
}