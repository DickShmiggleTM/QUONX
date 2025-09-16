import React, { useState } from 'react';
import { IndexStatus, SearchResult } from '../types.ts';
import { SearchIndexIcon } from './icons.tsx';

/**
 * @interface IndexingPanelProps
 * @description Props for the IndexingPanel component.
 * @property {IndexStatus} indexStatus - The current status of the index.
 * @property {SearchResult[]} searchResults - The results of the last search.
 * @property {boolean} isIndexing - Whether the index is currently being built.
 * @property {() => void} onStartIndexing - Function to start the indexing process.
 * @property {(query: string) => void} onSearch - Function to perform a search.
 * @property {(result: SearchResult) => void} onResultClick - Function to handle a click on a search result.
 */
interface IndexingPanelProps {
    indexStatus: IndexStatus;
    searchResults: SearchResult[];
    isIndexing: boolean;
    onStartIndexing: () => void;
    onSearch: (query: string) => void;
    onResultClick: (result: SearchResult) => void;
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
 * @function IndexingPanel
 * @description A component for managing and searching the codebase index.
 * @param {IndexingPanelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered IndexingPanel component.
 */
const IndexingPanel: React.FC<IndexingPanelProps> = ({ indexStatus, searchResults, isIndexing, onStartIndexing, onSearch, onResultClick }) => {
    const [searchQuery, setSearchQuery] = useState('');

    /**
     * @function handleSearchSubmit
     * @description Handles the submission of a search query.
     * @param {React.FormEvent} e - The form event.
     * @returns {void}
     */
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSearch(searchQuery);
    };

    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
            {/* Header */}
            <div className="flex-shrink-0 mb-2">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <SearchIndexIcon className="w-4 h-4 mr-2" /> CONTEXT INDEXING
                </h2>
                <div className="bg-black/30 p-2 border border-green-900 mb-2 text-center">
                    <p className="mb-2">
                        Status: 
                        <span className={`font-bold ml-1 ${indexStatus.isIndexed ? 'text-green-400' : 'text-yellow-400'}`}>
                            {isIndexing ? 'Indexing...' : (indexStatus.isIndexed ? `Indexed ${indexStatus.fileCount} files` : 'Not Indexed')}
                        </span>
                    </p>
                    <button 
                        onClick={onStartIndexing}
                        disabled={isIndexing}
                        className="w-full p-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                        {isIndexing ? 'Please wait...' : 'Build / Re-Build Index'}
                    </button>
                </div>
                 {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} className="relative flex-shrink-0">
                    <input
                        type="text"
                        placeholder="Search codebase..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black border border-green-700 p-1 pl-7 text-xs placeholder-gray-500"
                        disabled={!indexStatus.isIndexed || isIndexing}
                    />
                    <SearchIcon className="absolute left-1.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                </form>
            </div>

            {/* Results */}
            <div className="flex-grow overflow-y-auto pt-2">
                { !indexStatus.isIndexed ? (
                     <p className="text-gray-500">Build the index to start searching.</p>
                ) : searchResults.length === 0 ? (
                    <p className="text-gray-500">{searchQuery ? 'No results found.' : 'Enter a query to search the codebase.'}</p>
                ) : (
                    <ul>
                        {searchResults.map((result, index) => (
                            <li 
                                key={index} 
                                className="mb-2 p-2 border-b border-green-900/50 cursor-pointer hover:bg-green-900/50"
                                onClick={() => onResultClick(result)}
                            >
                                <p className="font-bold text-green-300">{result.path}:{result.line}</p>
                                <pre className="text-gray-400 whitespace-pre-wrap font-mono mt-1 bg-black/30 p-1">
                                    <code>{result.match}</code>
                                </pre>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default IndexingPanel;