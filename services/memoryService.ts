import { FileNode, GraphNode } from '../types.ts';
import { GraphDB } from './graphDB.ts';
import { CodebaseAnalyzer } from './codebaseAnalyzer.ts';

const MEMORY_STORAGE_KEY = 'quonx_ide_memory_graph';

export class MemoryService {
    private graphDB: GraphDB;
    private lastSave: number = 0;
    private saveThrottle: number = 5000; // 5 seconds

    constructor() {
        this.graphDB = new GraphDB();
    }
    
    public getGraphDB(): GraphDB {
        return this.graphDB;
    }

    public buildInitialMemory(files: FileNode[], analyzer: CodebaseAnalyzer): void {
        this.graphDB.clear();
        analyzer.buildInitialGraph(files);
        this.save();
    }

    public updateMemoryFromFile(path: string, content: string, analyzer: CodebaseAnalyzer): void {
        analyzer.updateGraphFromFile(path, content);
    }
    
    public removeMemoryForPath(path: string): void {
        this.graphDB.deleteNodesByPath(path);
    }

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
    
    public search(query: string): GraphNode[] {
        if (!query) return [];
        const lowerCaseQuery = query.toLowerCase();
        return this.graphDB.findNodes(node => 
            `${node.name} ${JSON.stringify(node.properties)}`.toLowerCase().includes(lowerCaseQuery)
        );
    }
    
    public getGraphData(): { nodes: GraphNode[], edges: any[] } {
        return {
            nodes: this.graphDB.getAllNodes(),
            edges: this.graphDB.getAllEdges(),
        };
    }

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