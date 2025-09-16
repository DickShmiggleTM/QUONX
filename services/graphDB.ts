import { FileNode, GraphNode, Edge } from '../types.ts';

/**
 * @class GraphDB
 * @description A simulation of an embedded graph database like FalkorDB.
 * It manages a collection of nodes and edges in memory to represent the codebase.
 */
export class GraphDB {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Edge[] = [];

  // --- MUTATION METHODS ---

  /**
   * @function addNode
   * @description Adds a node to the graph.
   * @param {GraphNode} node - The node to add.
   * @returns {void}
   */
  addNode(node: GraphNode): void {
    this.nodes.set(node.id, node);
  }

  /**
   * @function addEdge
   * @description Adds an edge to the graph.
   * @param {Edge} edge - The edge to add.
   * @returns {void}
   */
  addEdge(edge: Edge): void {
    if (this.nodes.has(edge.sourceId) && this.nodes.has(edge.targetId)) {
      this.edges.push(edge);
    }
  }

  /**
   * @function deleteNodesByPath
   * @description Deletes all nodes and associated edges for a given file path.
   * This is crucial for keeping the graph in sync when a file is changed or deleted.
   * @param {string} path - The path of the file.
   * @returns {void}
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

  /**
   * @function clear
   * @description Clears the graph.
   * @returns {void}
   */
  clear(): void {
    this.nodes.clear();
    this.edges = [];
  }

  // --- QUERY METHODS ---

  /**
   * @function getNode
   * @description Gets a node by its ID.
   * @param {string} id - The ID of the node.
   * @returns {GraphNode | undefined} The node, or undefined if not found.
   */
  getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }
  
  /**
   * @function findNodes
   * @description Finds nodes that match a filter.
   * @param {(node: GraphNode) => boolean} filter - The filter function.
   * @returns {GraphNode[]} An array of matching nodes.
   */
  findNodes(filter: (node: GraphNode) => boolean): GraphNode[] {
    return Array.from(this.nodes.values()).filter(filter);
  }
  
  /**
   * @function findEdges
   * @description Finds edges that match a filter.
   * @param {(edge: Edge) => boolean} filter - The filter function.
   * @returns {Edge[]} An array of matching edges.
   */
  findEdges(filter: (edge: Edge) => boolean): Edge[] {
    return this.edges.filter(filter);
  }

  /**
   * @function getAllNodes
   * @description Gets all nodes in the graph.
   * @returns {GraphNode[]} An array of all nodes.
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }
  
  /**
   * @function getAllEdges
   * @description Gets all edges in the graph.
   * @returns {Edge[]} An array of all edges.
   */
  getAllEdges(): Edge[] {
    return this.edges;
  }
  
  // --- PERSISTENCE METHODS ---

  /**
   * @function toJSON
   * @description Serializes the graph data to a JSON string.
   * Converts Maps to Arrays for compatibility with JSON.
   * @returns {string} The JSON string.
   */
  toJSON(): string {
    return JSON.stringify({
      nodes: Array.from(this.nodes.entries()),
      edges: this.edges,
    });
  }

  /**
   * @function fromJSON
   * @description Hydrates the graph from a JSON string.
   * @param {string} jsonString - The JSON string.
   * @returns {boolean} Whether the hydration was successful.
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