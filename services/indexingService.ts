import { FileNode, IndexStatus, SearchResult } from '../types.ts';

/**
 * @class IndexingService
 * @description A service that simulates the Vector Layer of the IDE.
 * It builds a searchable index of the entire codebase for fast context retrieval.
 */
export class IndexingService {
  private index: Map<string, string> = new Map(); // path -> file content
  private status: IndexStatus = { isIndexed: false, fileCount: 0 };

  constructor() {}

  /**
   * @function buildIndex
   * @description Builds the index from the entire file system tree.
   * This is an async simulation to represent a potentially long-running task.
   * @param {FileNode[]} files - The root nodes of the file system.
   * @returns {Promise<number>} The number of files successfully indexed.
   */
  public async buildIndex(files: FileNode[]): Promise<number> {
    return new Promise(resolve => {
        this.index.clear();
        const fileList: { path: string; content: string }[] = [];

        const traverse = (nodes: FileNode[], currentPath: string) => {
            for (const node of nodes) {
                const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
                if (node.children) {
                    traverse(node.children, newPath);
                } else if (typeof node.content === 'string') {
                    fileList.push({ path: newPath, content: node.content });
                }
            }
        };

        traverse(files, '');

        fileList.forEach(file => this.index.set(file.path, file.content));
        
        this.status = {
            isIndexed: true,
            fileCount: this.index.size,
        };

        // Simulate a short delay for the indexing process
        setTimeout(() => resolve(this.index.size), 200);
    });
  }

  /**
   * @function search
   * @description Searches the built index for a given query string.
   * @param {string} query - The string to search for.
   * @returns {SearchResult[]} An array of SearchResult objects.
   */
  public search(query: string): SearchResult[] {
    if (!this.status.isIndexed || !query.trim()) {
      return [];
    }

    const results: SearchResult[] = [];
    const lowerCaseQuery = query.toLowerCase();

    this.index.forEach((content, path) => {
      const lines = content.split('\n');
      lines.forEach((lineContent, lineIndex) => {
        if (lineContent.toLowerCase().includes(lowerCaseQuery)) {
          results.push({
            path,
            line: lineIndex + 1,
            match: lineContent.trim(),
          });
        }
      });
    });

    return results;
  }
  
  /**
   * @function getIndexStatus
   * @description Returns the current status of the index.
   * @returns {IndexStatus} The current status of the index.
   */
  public getIndexStatus(): IndexStatus {
    return this.status;
  }
}