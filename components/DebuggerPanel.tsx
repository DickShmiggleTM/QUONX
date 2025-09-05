import React from 'react';
import { BugIcon, PlayIcon, PauseIcon, StepOverIcon, StepIntoIcon, StepOutIcon } from './icons.tsx';

interface DebuggerState {
    isActive: boolean;
    isPaused: boolean;
    currentLine: number | null;
    breakpoints: Set<number>;
    callStack: { function: string; file: string; line: number }[];
    scope: Record<string, any>;
}

interface DebuggerPanelProps {
    debuggerState: DebuggerState;
    onStart: () => void;
    onStop: () => void;
    onStep: (action: 'over' | 'into' | 'out') => void;
}

const DebuggerPanel: React.FC<DebuggerPanelProps> = ({ debuggerState, onStart, onStop, onStep }) => {
    const { isActive, isPaused, currentLine, breakpoints, callStack, scope } = debuggerState;

    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
            {/* Header and Controls */}
            <div className="flex-shrink-0 mb-2">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <BugIcon className="w-4 h-4 mr-2" /> DEBUGGER
                </h2>
                <div className="flex items-center justify-center space-x-2 p-2 bg-black/30 border border-green-900">
                    <button onClick={isActive ? onStop : onStart} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title={isActive ? "Stop" : "Start"}>
                        {isActive ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => onStep('over')} disabled={!isPaused} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50" title="Step Over">
                        <StepOverIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onStep('into')} disabled={!isPaused} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50" title="Step Into">
                        <StepIntoIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onStep('out')} disabled={!isPaused} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50" title="Step Out">
                        <StepOutIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className={`mt-1 text-center p-1 ${isActive ? (isPaused ? 'bg-yellow-800/50 text-yellow-300' : 'bg-green-800/50 text-green-300') : 'bg-gray-800/50 text-gray-500'}`}>
                    Status: {isActive ? (isPaused ? `Paused at line ${currentLine}` : 'Running') : 'Inactive'}
                </div>
            </div>

            {/* Debugger Info Panes */}
            <div className="flex-grow overflow-y-auto">
                {!isActive ? (
                     <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Start a debug session to inspect variables.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* Scope Section */}
                        <div>
                            <h3 className="font-bold border-b border-green-900/50 mb-1">Scope</h3>
                            <div className="pl-2 font-mono">
                                {Object.entries(scope).map(([key, value]) => (
                                    <div key={key}>
                                        <span className="text-blue-400">{key}:</span>
                                        <span className="text-purple-400 ml-2">{JSON.stringify(value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Call Stack Section */}
                        <div>
                            <h3 className="font-bold border-b border-green-900/50 mb-1">Call Stack</h3>
                            <ul>
                                {callStack.map((frame, index) => (
                                    <li key={index} className="p-1 hover:bg-green-900/50">
                                        <p className="font-bold">{frame.function}</p>
                                        <p className="text-gray-400 text-xs">{frame.file}:{frame.line}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        {/* Breakpoints Section */}
                        <div>
                            <h3 className="font-bold border-b border-green-900/50 mb-1">Breakpoints</h3>
                            {breakpoints.size > 0 ? (
                                <ul>
                                    {Array.from(breakpoints).sort((a,b) => a-b).map(line => (
                                        <li key={line} className="text-gray-300">
                                           Line {line}
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="text-gray-500">No breakpoints set.</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DebuggerPanel;