import { FileNode, Plugin, PluginTool } from '../types.ts';

interface FileSystemAPI {
    (path: string): string | null;
}

// This script will be run inside the Web Worker.
// It creates a sandboxed environment for the plugin code.
const workerScript = `
  self.onmessage = (event) => {
    const { scriptContent } = event.data;
    const tools = [];
    
    // The sandboxed 'quonx' API available to the plugin.
    const sandbox = {
      quonx: {
        registerTool: (name, description, handler) => {
          // The handler function is converted to a string for safe transport
          // back to the main thread.
          tools.push({ name, description, handler: handler.toString() });
        },
      },
      // A sandboxed console that forwards logs back to the main thread.
      console: {
        log: (...args) => self.postMessage({ type: 'log', payload: args }),
        error: (...args) => self.postMessage({ type: 'error', payload: args }),
        warn: (...args) => self.postMessage({ type: 'warn', payload: args }),
      }
    };

    try {
      // The plugin code is executed with only the sandbox in its scope.
      const pluginFunction = new Function('quonx', 'console', scriptContent);
      pluginFunction(sandbox.quonx, sandbox.console);
      self.postMessage({ type: 'success', payload: tools });
    } catch (e) {
      // Report any execution errors back to the main thread.
      self.postMessage({ type: 'execution_error', payload: e.message });
    }
  };
`;

export class PluginService {
    private loadedPlugins: Plugin[] = [];
    private registeredTools: PluginTool[] = [];
    private getFileContent: FileSystemAPI;
    private fileSystem: FileNode[];

    constructor(fileSystem: FileNode[], getFileContent: FileSystemAPI) {
        this.fileSystem = fileSystem;
        this.getFileContent = getFileContent;
    }

    public getLoadedPlugins(): Plugin[] {
        return this.loadedPlugins;
    }

    public getRegisteredTools(): PluginTool[] {
        return this.registeredTools;
    }

    public async loadPlugins(enabledPlugins: { [pluginName: string]: boolean }) {
        this.loadedPlugins = [];
        this.registeredTools = [];
        console.log("Starting plugin discovery with robust sandboxing...");

        const pluginsDir = this.fileSystem.find(node => node.name === 'plugins' && node.children);
        if (!pluginsDir || !pluginsDir.children) {
            console.log("No /plugins directory found.");
            return;
        }

        const loadPromises = pluginsDir.children.map(async (pluginDir) => {
            if (!pluginDir.children) return;

            const manifestPath = `plugins/${pluginDir.name}/plugin.json`;
            const manifestContent = this.getFileContent(manifestPath);

            if (!manifestContent) {
                this.loadedPlugins.push({ name: pluginDir.name, version: 'N/A', description: 'Manifest file (plugin.json) not found.', author: 'N/A', main: '', error: 'Manifest file (plugin.json) not found.' });
                return;
            }
            
            let manifest: Plugin;
            try {
                manifest = JSON.parse(manifestContent);
            } catch(e) {
                this.loadedPlugins.push({ name: pluginDir.name, version: 'N/A', description: 'Failed to parse plugin.json.', author: 'N/A', main: '', error: `Invalid JSON in manifest: ${e instanceof Error ? e.message : String(e)}` });
                return;
            }

            // A plugin is considered enabled if it's not explicitly set to false.
            if (enabledPlugins[manifest.name] === false) {
                this.loadedPlugins.push(manifest); // Add to list but don't load.
                console.log(`Plugin '${manifest.name}' is disabled. Skipping.`);
                return;
            }

            const scriptPath = `plugins/${pluginDir.name}/${manifest.main}`;
            const scriptContent = this.getFileContent(scriptPath);

            if (!scriptContent) {
                manifest.error = `Main script '${manifest.main}' not found.`;
                this.loadedPlugins.push(manifest);
                return;
            }

            try {
                const toolsFromWorker = await this.executePluginInWorker(scriptContent);
                toolsFromWorker.forEach(toolInfo => {
                    this.registeredTools.push({
                        name: toolInfo.name,
                        description: toolInfo.description,
                        // Reconstruct the handler function from its string representation.
                        handler: new Function('args', `return (${toolInfo.handler})(args)`) as (args: any) => Promise<string> | string
                    });
                });
                this.loadedPlugins.push(manifest);
            } catch (error) {
                manifest.error = error instanceof Error ? error.message : String(error);
                this.loadedPlugins.push(manifest);
            }
        });
        
        await Promise.all(loadPromises);
        this.loadedPlugins.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    /**
     * Executes plugin code inside a secure Web Worker.
     */
    private executePluginInWorker(scriptContent: string): Promise<{ name: string; description: string; handler: string }[]> {
        return new Promise((resolve, reject) => {
            // Create a worker from a Blob to avoid needing a separate file.
            const blob = new Blob([workerScript], { type: 'application/javascript' });
            const worker = new Worker(URL.createObjectURL(blob));

            // Set a timeout to prevent runaway scripts.
            const timeout = setTimeout(() => {
                worker.terminate();
                reject(new Error("Plugin execution timed out."));
            }, 2000);

            worker.onmessage = (event) => {
                clearTimeout(timeout);
                const { type, payload } = event.data;
                switch (type) {
                    case 'success':
                        resolve(payload);
                        break;
                    case 'execution_error':
                        reject(new Error(`Plugin script error: ${payload}`));
                        break;
                    // Forward logs from the worker to the main console.
                    case 'log': console.log('[PLUGIN WORKER]', ...payload); break;
                    case 'error': console.error('[PLUGIN WORKER]', ...payload); break;
                    case 'warn': console.warn('[PLUGIN WORKER]', ...payload); break;
                }
                worker.terminate();
            };

            worker.onerror = (error) => {
                clearTimeout(timeout);
                reject(new Error(`Worker error: ${error.message}`));
                worker.terminate();
            };
            
            // Send the plugin script to the worker to start execution.
            worker.postMessage({ scriptContent });
        });
    }
}