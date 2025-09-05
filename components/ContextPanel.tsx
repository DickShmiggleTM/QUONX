import React from 'react';

interface ContextPanelProps {
  // Example props:
  // selectedText: string | null;
  // currentFilePath: string | null;
}

const ContextPanel: React.FC<ContextPanelProps> = (/* { selectedText, currentFilePath } */) => {
  const currentFilePath = "src/App.tsx"; // dummy data
  const selectedText = "function App() { ... }"; // dummy data

  return (
    <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full">
      <h2 className="text-sm mb-2 border-b-2 border-green-800">CONTEXT</h2>
      <div className="text-xs">
        {currentFilePath ? (
          <div className="mb-2">
            <h3 className="font-bold text-green-300">Current File</h3>
            <p className="text-gray-400 break-all">{currentFilePath}</p>
          </div>
        ) : (
           <p className="text-gray-500">No file is currently active.</p>
        )}
        
        {selectedText && (
          <div>
            <h3 className="font-bold text-green-300">Selected Code</h3>
            <pre className="bg-black/50 p-1 mt-1 overflow-x-auto text-gray-400">
              <code>{selectedText}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPanel;
