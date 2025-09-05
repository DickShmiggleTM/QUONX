import React from 'react';
import { Plugin } from '../types.ts';
import { PluginsIcon } from './icons.tsx';

interface PluginManagerPanelProps {
    plugins: Plugin[];
    enabledPlugins: { [pluginName: string]: boolean };
    onTogglePlugin: (pluginName: string, isEnabled: boolean) => void;
}

const PluginManagerPanel: React.FC<PluginManagerPanelProps> = ({ plugins, enabledPlugins, onTogglePlugin }) => {
    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full">
            <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                <PluginsIcon className="w-4 h-4 mr-2" /> PLUGIN MANAGER
            </h2>
            {plugins.length === 0 ? (
                <p className="text-gray-500">No plugins loaded. Add plugins to the /plugins directory.</p>
            ) : (
                <ul className="text-xs">
                    {plugins.map(plugin => (
                        <li key={plugin.name} className="mb-2 p-2 border border-green-900 bg-black/30">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-green-300">{plugin.name} <span className="text-gray-500 font-normal">v{plugin.version}</span></span>
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only" 
                                        // A plugin is enabled by default if not present in the map
                                        checked={enabledPlugins[plugin.name] !== false}
                                        onChange={(e) => onTogglePlugin(plugin.name, e.target.checked)}
                                    />
                                    <div className={`w-8 h-4 flex items-center rounded-full p-1 transition-colors ${enabledPlugins[plugin.name] !== false ? 'bg-green-600' : 'bg-gray-700'}`}>
                                        <div className={`bg-white w-2 h-2 rounded-full shadow-md transform transition-transform ${enabledPlugins[plugin.name] !== false ? 'translate-x-4' : ''}`}></div>
                                    </div>
                                </label>
                            </div>
                            <p className="text-gray-400 mt-1">{plugin.description}</p>
                            {plugin.error && (
                                <div className="mt-1 text-red-500 border-t border-red-900 pt-1">
                                    <p><span className="font-bold">Error:</span> {plugin.error}</p>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default PluginManagerPanel;
