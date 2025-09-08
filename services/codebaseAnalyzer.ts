// FIX: Added .ts extension to the import path.
import { FileNode, GraphNode } from '../types.ts';
// FIX: Added .ts extension to the import path.
import { GraphDB } from './graphDB.ts';

interface ParsedQuery {
  intent: 'find-definition' | 'find-calls' | 'find-callers-of-function' | 'find-callers-of-semantic-target' | 'general-search';
  target: string;
}

/**
 * The Semantic Layer of the IDE.
 * It analyzes file content and uses a GraphDB instance to build and maintain
 * a Code Knowledge Graph, enabling sophisticated structural queries.
 */
export class CodebaseAnalyzer {
  private graphDB: GraphDB;

  constructor(graphDB: GraphDB) {
    this.graphDB = graphDB;
  }

  /**
   * Builds the initial knowledge graph by traversing the entire file system.
   */
  buildInitialGraph(nodes: FileNode[]): void {
    // The graph is not cleared here; MemoryService manages the lifecycle.
    this.traverseAndIndex(nodes, '');
  }

  private traverseAndIndex(nodes: FileNode[], currentPath: string) {
    for (const node of nodes) {
      const newPath = currentPath ? `${currentPath}/${node.name}` : node.name;
      if (node.children) {
        this.traverseAndIndex(node.children, newPath);
      } else if (node.content !== undefined) {
        this.updateGraphFromFile(newPath, node.content);
      }
    }
  }
  
  /**
   * Parses a single file and updates the knowledge graph.
   * It first removes all old data for that file to ensure consistency.
   */
  updateGraphFromFile(path: string, content: string): void {
    this.graphDB.deleteNodesByPath(path);
    
    // Add a single node for the file itself
    this.graphDB.addNode({ id: path, type: 'file', path, name: path.split('/').pop()!, properties: { lineCount: content.split('\n').length } });

    const lines = content.split('\n');
    // Improved regex to capture any valid function/variable name
    const defRegex = /(?:function|class|const|let|var)\s+([a-zA-Z0-9_]+)/g;
    const callRegex = /([a-zA-Z0-9_]+)\s*\(/g;

    // First pass: find all definitions in the file
    lines.forEach((line, index) => {
        let match;
        // Reset regex state for each line
        defRegex.lastIndex = 0;
        while ((match = defRegex.exec(line)) !== null) {
            const name = match[1];
            if (name === 'React') continue; // Avoid generic library names
            const id = `${path}:${name}`;
            const type = line.includes('class') ? 'class-def' : 'function-def';
            const node: GraphNode = {
                id,
                type,
                path,
                name,
                properties: { line: index + 1, code: line.trim() },
            };
            this.graphDB.addNode(node);
        }
    });

    // Second pass: find all calls and link them to definitions
    lines.forEach((line, index) => {
        let match;
        // Reset regex state for each line
        callRegex.lastIndex = 0;
        if (!line.trim().match(/^(?:function|class|const|let|var)\s+/)) {
            while ((match = callRegex.exec(line)) !== null) {
                if (!['if', 'for', 'while', 'switch', 'catch', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'].includes(match[1]) && match[1] !== 'constructor') {
                    const callName = match[1];
                    const targetDef = this.graphDB.findNodes(n => (n.type === 'function-def' || n.type === 'class-def') && n.name === callName)[0];
                    if (targetDef) {
                        const callId = `${path}:${callName}:${index + 1}`;
                        const callNode: GraphNode = {
                            id: callId,
                            type: 'call',
                            path,
                            name: callName,
                            properties: { line: index + 1, code: line.trim() }
                        };
                        this.graphDB.addNode(callNode);
                        this.graphDB.addEdge({ sourceId: callId, targetId: targetDef.id, type: 'calls' });
                    }
                }
            }
        }
    });
  }

  private camelCaseToSentence(name: string): string {
    const result = name.replace(/([A-Z])/g, ' $1');
    const finalResult = result.charAt(0).toUpperCase() + result.slice(1);
    return `${finalResult.trim()}`;
  }

  /**
   * Parses content to find functions and classes without JSDoc comments and adds basic ones.
   */
  public generateDocstrings(content: string): string {
      const lines = content.split('\n');
      const insertions: { index: number, lines: string[] }[] = [];

      // Regex for various function/class declarations
      const funcArrowRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async)?\s*\(([^)]*)\)\s*=>/;
      const funcKeywordRegex = /(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/;
      const classRegex = /class\s+([a-zA-Z0-9_]+)/;

      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();

          let hasDoc = false;
          if (i > 0) {
            const prevLineTrimmed = lines[i - 1].trim();
            if (prevLineTrimmed.endsWith('*/')) {
              hasDoc = true;
            }
          }
          
          if (hasDoc || !trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) continue;
          
          const funcArrowMatch = trimmedLine.match(funcArrowRegex);
          const funcKeywordMatch = trimmedLine.match(funcKeywordRegex);
          const classMatch = trimmedLine.match(classRegex);
          
          let name = '';
          let params: string[] = [];
          let isClass = false;
          const indentation = line.match(/^\s*/)?.[0] || '';

          if (funcArrowMatch) {
              name = funcArrowMatch[1];
              params = funcArrowMatch[2] ? funcArrowMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [];
          } else if (funcKeywordMatch) {
              name = funcKeywordMatch[1];
              params = funcKeywordMatch[2] ? funcKeywordMatch[2].split(',').map(p => p.trim()).filter(Boolean) : [];
          } else if (classMatch) {
              name = classMatch[1];
              isClass = true;
          }

          if (name) {
              const docstringLines: string[] = [];
              docstringLines.push(`${indentation}/**`);
              const description = isClass ? `Represents the ${name} class.` : `${this.camelCaseToSentence(name)}.`;
              docstringLines.push(`${indentation} * ${description}`);
              
              if (!isClass) {
                  params.forEach(param => {
                      const paramName = param.split('=')[0].split(':')[0].trim().replace(/{|}/g, '');
                      if (paramName) {
                          docstringLines.push(`${indentation} * @param {any} ${paramName} - Description for ${paramName}.`);
                      }
                  });
                   if (!line.includes('=> {') && !line.includes(') {') && !line.includes('){')) { // Simple check if it's a one-liner without block
                        // Heuristic: if it's not a block function, it might not have a meaningful return, or it's complex.
                   } else {
                        docstringLines.push(`${indentation} * @returns {any} Description for return value.`);
                   }
              }
              
              docstringLines.push(`${indentation} */`);
              insertions.push({ index: i, lines: docstringLines });
          }
      }

      // Apply insertions in reverse order to not mess up indices
      for (let i = insertions.length - 1; i >= 0; i--) {
          const insertion = insertions[i];
          lines.splice(insertion.index, 0, ...insertion.lines);
      }
      
      return lines.join('\n');
  }

  /**
   * Removes all graph nodes associated with a given file path.
   */
  removeGraphNodesForPath(path: string): void {
      this.graphDB.deleteNodesByPath(path);
  }

  private interpretQuery(query: string): ParsedQuery {
    const findDefMatch = query.match(/definition of|define|where is\s+'?([a-zA-Z0-9_]+)'?/i);
    if (findDefMatch) {
      return { intent: 'find-definition', target: findDefMatch[1] || query.split(' ').pop()! };
    }

    const findCallersSemanticMatch = query.match(/(?:callers of|functions that call|who calls)\s+(.*)/i);
    if (findCallersSemanticMatch && findCallersSemanticMatch[1].trim().split(' ').length > 1) {
        return { intent: 'find-callers-of-semantic-target', target: findCallersSemanticMatch[1].trim() };
    }

    // More robustly detect queries asking for functions that call a specific target.
    const findCallersMatch = query.match(/(?:find callers of|functions that call|functions calling|callers of|who uses)\s+'?([a-zA-Z0-9_]+)'?/i);
    if (findCallersMatch) {
        return { intent: 'find-callers-of-function', target: findCallersMatch[1] };
    }

    const findCallsMatch = query.match(/calls to|who calls|find usages of|where is\s+'?([a-zA-Z0-9_]+)'?\s+used/i);
    if (findCallsMatch) {
      return { intent: 'find-calls', target: findCallsMatch[1] || query.split(' ').pop()! };
    }

    return { intent: 'general-search', target: query };
  }

  /**
   * Finds the definition node for a given function or class name.
   * @param name The name of the function/class to find.
   * @returns The graph node for the definition, or null if not found.
   */
  public findDefinition(name: string): GraphNode | null {
    return this.graphDB.findNodes(n => (n.type === 'function-def' || n.type === 'class-def') && n.name === name)[0] || null;
  }

  /**
   * Finds all usage (call) nodes that point to a given definition node ID.
   * @param definitionId The ID of the function/class definition node.
   * @returns An array of graph nodes representing the calls.
   */
  public findUsages(definitionId: string): GraphNode[] {
    const callingEdges = this.graphDB.findEdges(e => e.targetId === definitionId && e.type === 'calls');
    return callingEdges.map(e => this.graphDB.getNode(e.sourceId)).filter((n): n is GraphNode => n !== undefined);
  }

  /**
   * The main search function that queries the knowledge graph.
   */
  searchCodebase(query: string): string {
    const parsedQuery = this.interpretQuery(query);
    const { intent, target } = parsedQuery;
    let results: GraphNode[] = [];

    switch (intent) {
      case 'find-definition':
        results = this.graphDB.findNodes(n => (n.type === 'function-def' || n.type === 'class-def') && n.name === target);
        break;

      case 'find-calls':
        const targetDef = this.graphDB.findNodes(n => (n.type === 'function-def' || n.type === 'class-def') && n.name === target)[0];
        if (targetDef) {
          const callingEdges = this.graphDB.findEdges(e => e.targetId === targetDef.id && e.type === 'calls');
          results = callingEdges.map(e => this.graphDB.getNode(e.sourceId)).filter((n): n is GraphNode => n !== undefined);
        }
        break;
    
      case 'find-callers-of-function':
        // This traces the call chain: find the target function's definition node in the graph,
        // then find all 'call' nodes that point to it, and finally, find the parent
        // function definitions for each of those 'call' nodes.
        const calledFuncDef = this.graphDB.findNodes(n => (n.type === 'function-def' || n.type === 'class-def') && n.name === target)[0];
        if (calledFuncDef) {
            results = this.findParentFunctionsOfCallers(calledFuncDef.id);
        }
        break;
    
      case 'find-callers-of-semantic-target':
        const keywords = target.toLowerCase().split(/\s+/).filter(Boolean);
        const targetDefs = this.graphDB.findNodes(n => {
            if (!n.type.includes('-def')) return false;
            const nodeText = `${n.name} ${n.properties.code || ''}`.toLowerCase();
            return keywords.every(k => nodeText.includes(k));
        });

        if (targetDefs.length === 0) {
            return `Could not find a definition matching "${target}". Trying general search.`;
        }

        const allCallers = new Map<string, GraphNode>();
        for (const def of targetDefs) {
            const callers = this.findParentFunctionsOfCallers(def.id);
            callers.forEach(caller => allCallers.set(caller.id, caller));
        }
        results = Array.from(allCallers.values());
        break;


      case 'general-search':
        const searchKeywords = target.toLowerCase().split(/\s+/).filter(Boolean);
        results = this.graphDB.findNodes(n => {
            const nodeText = `${n.name} ${n.properties.code || ''}`.toLowerCase();
            return searchKeywords.every(k => nodeText.includes(k));
        });
        break;
    }

    return this.formatResults(results, query, intent, target);
  }

  private findParentFunctionsOfCallers(targetId: string): GraphNode[] {
    const callingEdges = this.graphDB.findEdges(e => e.targetId === targetId && e.type === 'calls');
    const callNodes = callingEdges.map(e => this.graphDB.getNode(e.sourceId)).filter((n): n is GraphNode => n !== undefined);
    
    const parentFunctions = new Map<string, GraphNode>();
    for (const callNode of callNodes) {
        if (!callNode.path) continue;
        const functionsInFile = this.graphDB.findNodes(n => n.path === callNode.path && n.type.includes('-def'))
            .sort((a, b) => a.properties.line - b.properties.line); 

        const parentFunc = functionsInFile.filter(f => f.properties.line < callNode.properties.line).pop();
        if (parentFunc && !parentFunctions.has(parentFunc.id)) {
            parentFunctions.set(parentFunc.id, parentFunc);
        }
    }
    return Array.from(parentFunctions.values());
  }

  private formatResults(results: GraphNode[], originalQuery: string, intent: ParsedQuery['intent'], target: string): string {
    if (results.length === 0) {
      return `No structural results found for query: "${originalQuery}"`;
    }

    let resultTitle = `Found ${results.length} structural match(es) for "${originalQuery}":`;
    let resultLinePrefix = 'Match found for';

    if (intent === 'find-callers-of-function' || intent === 'find-callers-of-semantic-target') {
        resultTitle = `Found ${results.length} function(s) that call '${target}':`;
        resultLinePrefix = 'Caller';
    } else if (intent === 'find-calls') {
        resultTitle = `Found ${results.length} call(s) to '${target}':`;
        resultLinePrefix = 'Call';
    } else if (intent === 'find-definition') {
        resultTitle = `Found definition for '${target}':`;
        resultLinePrefix = 'Definition';
    }


    const formatted = results.map(r => 
        `- ${resultLinePrefix}: '${r.name}' (${r.type})\n  - Location: ${r.path}:${r.properties.line}\n  - Code:     ${r.properties.code}`
    ).join('\n\n');

    return `${resultTitle}\n\n${formatted}`;
  }
}