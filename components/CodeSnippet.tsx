import React, { useState, useCallback } from 'react';
import { ClipboardIcon, CheckIcon } from './icons.tsx';

interface CodeSnippetProps {
  language: string;
  code: string;
}

const CodeSnippet: React.FC<CodeSnippetProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000); // Reset feedback after 2 seconds
        }).catch(err => {
            console.error('Failed to copy code to clipboard: ', err);
        });
    }
  }, [code]);
  
  return (
    <div 
        className="bg-black border border-green-800 rounded my-2 relative text-xs font-mono cursor-pointer hover:border-green-600 transition-colors" 
        onClick={handleCopy} 
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleCopy()}
        role="button" 
        tabIndex={0} 
        aria-label="Copy code snippet to clipboard"
    >
      <div className="flex justify-between items-center px-3 py-1 bg-gray-800/50 border-b border-green-800">
        <span className="text-gray-400 select-none">{language}</span>
        <div className="flex items-center text-green-400 select-none">
          {copied ? (
            <>
              <CheckIcon className="w-3 h-3 mr-1" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <ClipboardIcon className="w-3 h-3 mr-1" />
              <span>Copy</span>
            </>
          )}
        </div>
      </div>
      <pre className="p-3 overflow-x-auto">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default CodeSnippet;
