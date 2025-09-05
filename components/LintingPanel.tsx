import React from 'react';
// FIX: Added .tsx extension to the import path.
import { LintingError } from '../types.ts';
// FIX: Added .tsx extension to the import path.
import { BugIcon } from './icons.tsx';

interface LintingPanelProps {
  errors: LintingError[];
  onClearErrors: () => void;
  onRunLint: () => void;
}

const LintingPanel: React.FC<LintingPanelProps> = ({ errors, onClearErrors, onRunLint }) => {
  return (
    <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
      <div className="flex-shrink-0 mb-2">
        <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
          <BugIcon className="w-4 h-4 mr-2" /> LINTING
        </h2>
        <div className="flex space-x-2">
            <button 
                onClick={onRunLint}
                className="w-full p-2 bg-green-700 hover:bg-green-600">
                Run Lint on Active File
            </button>
            <button 
                onClick={onClearErrors}
                className="w-full p-2 bg-gray-700 hover:bg-gray-600">
                Clear
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto pt-2">
        {errors.length === 0 ? (
          <p className="text-gray-500">No linting issues found.</p>
        ) : (
          <ul>
            {errors.map((error, index) => (
              <li key={index} className={`mb-2 p-2 border-l-4 ${error.severity === 'error' ? 'border-red-500' : 'border-yellow-500'}`}>
                <p className="font-bold">
                  {error.severity.toUpperCase()}: {error.message}
                </p>
                <p className="text-gray-400">
                  at line {error.line}, column {error.column}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LintingPanel;
