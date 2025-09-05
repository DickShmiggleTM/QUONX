
// FIX: Added .ts extension to the import path.
import { FileNode } from '../types.ts';

export interface GraphNode {
  id: string; // e.g., 'src/App.tsx:App'
  type: 'file' | 'function-def' | 'class-def' | 'call';
  path: string;
  name: string;
  properties: Record<string, any>;
}

export interface Edge {
  sourceId: string;
  targetId: string;
  type: 'calls' | 'imports';
}

/**
 * A simulation of an embedded graph database like FalkorDB.
 * It manages a collection of nodes and edges in memory to represent the codebase.
 */
export class GraphDB {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Edge[] = [];

  // --- MUTATION METHODS ---

  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  addEdge(edge: Edge): void {
    if (this.nodes.has(edge.sourceId) && this.nodes.has(edge.targetId)) {
      this.edges.push(edge);
    }
  }

  /**
   * Deletes all nodes and associated edges for a given file path.
   * This is crucial for keeping the graph in sync when a file is changed or deleted.
   */
  deleteNodesByPath(path: string): void {
    const nodesToDelete = new Set<string>();
    
    // Find all nodes associated with the path
    for (const [id, node] of this.nodes.entries()) {
      if (node.path === path) {
        nodesToDelete.add(id);
      }
    }

    // Delete the nodes and any edges connected to them
    nodesToDelete.forEach(id => this.nodes.delete(id));
    this.edges = this.edges.filter(
      edge => !nodesToDelete.has(edge.sourceId) && !nodesToDelete.has(edge.targetId)
    );
  }

  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  // --- QUERY METHODS ---

  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }
  
  findNodes(filter: (node: GraphNode) => boolean): GraphNode[] {
    return Array.from(this.nodes.values()).filter(filter);
  }
  
  findEdges(filter: (edge: Edge) => boolean): Edge[] {
    return this.edges.filter(filter);
  }
}