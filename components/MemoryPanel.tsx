import React, { useState } from 'react';
import { GraphNode } from '../types.ts';
import { MemoryIcon } from './icons.tsx';
import KnowledgeGraphVisualizer from './KnowledgeGraphVisualizer.tsx';

/**
 * @interface MemoryPanelProps
 * @description Props for the MemoryPanel component.
 * @property {boolean} isMemoryEnabled - Whether the memory is enabled.
 * @property {(isEnabled: boolean) => void} onToggleMemory - Function to toggle the memory.
 * @property {(query: string) => GraphNode[]} onSearch - Function to search the memory.
 * @property {{ nodes: GraphNode[], edges: any[] }} graphData - The data for the knowledge graph.
 */
interface MemoryPanelProps {
    isMemoryEnabled: boolean;
    onToggleMemory: (isEnabled: boolean) => void;
    onSearch: (query: string) => GraphNode[];
    graphData: { nodes: GraphNode[], edges: any[] };
}

/**
 * @function SearchIcon
 * @description A component for the search icon.
 * @param {React.SVGProps<SVGSVGElement>} props - The props for the component.
 * @returns {JSX.Element} The rendered SearchIcon component.
 */
const SearchIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
  </svg>
);

/**
 * @function MemoryPanel
 * @description A component for managing and visualizing the knowledge graph memory.
 * @param {MemoryPanelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered MemoryPanel component.
 */
const MemoryPanel: React.FC<MemoryPanelProps> = ({ isMemoryEnabled, onToggleMemory, onSearch, graphData }) => {
    const [activeTab, setActiveTab] = useState<'search' | 'visualize' | 'settings'>('search');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<GraphNode[]>([]);

    /**
     * @function handleSearchSubmit
     * @description Handles the submission of a search query.
     * @param {React.FormEvent} e - The form event.
     * @returns {void}
     */
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const results = onSearch(searchQuery);
        setSearchResults(results);
    };

    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-hidden h-full flex flex-col text-xs">
            {/* Header */}
            <div className="flex-shrink-0 mb-2">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <MemoryIcon className="w-4 h-4 mr-2" /> KNOWLEDGE GRAPH MEMORY
                </h2>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-green-800 flex-shrink-0">
                <button onClick={() => setActiveTab('search')} className={`px-3 py-1 ${activeTab === 'search' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>SEARCH</button>
                <button onClick={() => setActiveTab('visualize')} className={`px-3 py-1 ${activeTab === 'visualize' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>VISUALIZE</button>
                <button onClick={() => setActiveTab('settings')} className={`px-3 py-1 ${activeTab === 'settings' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>SETTINGS</button>
            </div>

            {/* Main Content */}
            <div className="flex-grow overflow-auto pt-2">
                {activeTab === 'settings' && (
                    <div>
                        <h3 className="font-bold mb-2">Memory Settings</h3>
                        <div className="p-2 bg-black/30 border border-green-900 flex justify-between items-center">
                            <span>Enable Memory Augmentation</span>
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only"
                                    checked={isMemoryEnabled}
                                    onChange={(e) => onToggleMemory(e.target.checked)}
                                />
                                <div className={`w-10 h-5 flex items-center rounded-full p-1 transition-colors ${isMemoryEnabled ? 'bg-green-600' : 'bg-gray-700'}`}>
                                    <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform ${isMemoryEnabled ? 'translate-x-5' : ''}`}></div>
                                </div>
                            </label>
                        </div>
                         <p className="text-gray-400 mt-2 text-xs">When enabled, the AI will use the knowledge graph to get relevant context before responding to your prompts.</p>
                    </div>
                )}
                {activeTab === 'search' && (
                    <div className="flex flex-col h-full">
                         <form onSubmit={handleSearchSubmit} className="relative flex-shrink-0 mb-2">
                            <input
                                type="text"
                                placeholder="Search memories..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-black border border-green-700 p-1 pl-7 text-xs placeholder-gray-500"
                            />
                            <SearchIcon className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        </form>
                        <div className="flex-grow overflow-y-auto">
                            {searchResults.length === 0 ? (
                                <p className="text-gray-500">{searchQuery ? 'No results found.' : 'Enter a query to search memories.'}</p>
                            ) : (
                                <ul>
                                    {searchResults.map((result) => (
                                        <li key={result.id} className="mb-2 p-2 border-b border-green-900/50">
                                            <p className="font-bold text-green-300">{result.name} <span className="text-gray-400 font-normal">({result.type})</span></p>
                                            <pre className="text-gray-400 whitespace-pre-wrap font-mono mt-1 bg-black/30 p-1 text-xs">
                                                <code>{JSON.stringify(result.properties, null, 2)}</code>
                                            </pre>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}
                {activeTab === 'visualize' && (
                    <div className="w-full h-full bg-black/40 border border-green-900">
                        <KnowledgeGraphVisualizer nodes={graphData.nodes} edges={graphData.edges} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default MemoryPanel;