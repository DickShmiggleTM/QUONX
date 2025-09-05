

// FIX: Added .ts extension to import path.
import { FileNode, GraphNode, Edge } from '../types.ts';

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

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }
  
  getAllEdges(): Edge[] {
    return this.edges;
  }
  
  // --- PERSISTENCE METHODS ---

  /**
   * Serializes the graph data to a JSON string.
   * Converts Maps to Arrays for compatibility with JSON.
   */
  toJSON(): string {
    return JSON.stringify({
      nodes: Array.from(this.nodes.entries()),
      edges: this.edges,
    });
  }

  /**
   * Hydrates the graph from a JSON string.
   */
  fromJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.nodes && Array.isArray(data.nodes) && data.edges && Array.isArray(data.edges)) {
        this.nodes = new Map(data.nodes);
        this.edges = data.edges;
        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to load graph from JSON:", e);
      return false;
    }
  }
}
