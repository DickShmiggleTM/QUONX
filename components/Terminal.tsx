
import React from 'react';

interface TerminalProps {
    output: string[];
}

const Terminal: React.FC<TerminalProps> = ({ output }) => {
  const terminalRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className="bg-black/50 border border-green-800 p-2 flex flex-col">
      <h2 className="text-sm mb-2 border-b-2 border-green-800">TERMINAL</h2>
      <div ref={terminalRef} className="flex-grow font-mono text-xs overflow-y-auto">
        {output.map((line, index) => (
          <div key={index}>
            <span className="text-green-600 mr-2">&gt;</span>
            <span className="whitespace-pre-wrap">{line}</span>
          </div>
        ))}
         <div className="w-2 h-3 bg-green-400 animate-pulse mt-1"></div>
      </div>
    </div>
  );
};

export default Terminal;
