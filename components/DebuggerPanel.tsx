import React from 'react';
import { BugIcon, PlayIcon, PauseIcon, StepOverIcon, StepIntoIcon, StepOutIcon } from './icons.tsx';
import { DebuggerState } from '../types.ts';

/**
 * @interface DebuggerPanelProps
 * @description Props for the DebuggerPanel component.
 * @property {DebuggerState} debuggerState - The current state of the debugger.
 * @property {() => void} onStart - Function to start the debugger.
 * @property {() => void} onStop - Function to stop the debugger.
 * @property {(action: 'over' | 'into' | 'out') => void} onStep - Function to step through the code.
 */
interface DebuggerPanelProps {
    debuggerState: DebuggerState;
    onStart: () => void;
    onStop: () => void;
    onStep: (action: 'over' | 'into' | 'out') => void;
}

/**
 * @function DebuggerPanel
 * @description A component that provides a UI for debugging code.
 * @param {DebuggerPanelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered DebuggerPanel component.
 */
const DebuggerPanel: React.FC<DebuggerPanelProps> = ({ debuggerState, onStart, onStop, onStep }) => {
    const { isActive, isPaused, currentLine, breakpoints, callStack, scope } = debuggerState;

    /**
     * @function handleDebugAction
     * @description Handles the main debug action button click.
     * @returns {void}
     */
    const handleDebugAction = () => {
        if (!isActive) {
            onStart();
        } else if (isPaused) {
            // This is simplified; a real debugger would have resume vs step
            onStep('over'); 
        } else {
            onStop();
        }
    };


    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
            {/* Header and Controls */}
            <div className="flex-shrink-0 mb-2">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <BugIcon className="w-4 h-4 mr-2" /> DEBUGGER
                </h2>
                <div className="flex items-center justify-center space-x-2 p-2 bg-black/30 border border-green-900">
                    <button onClick={handleDebugAction} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title={isActive ? (isPaused ? "Continue" : "Pause") : "Start"}>
                        {isActive && !isPaused ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={() => onStep('over')} disabled={!isPaused} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed" title="Step Over">
                        <StepOverIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onStep('into')} disabled={true} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed" title="Step Into (Not Implemented)">
                        <StepIntoIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => onStep('out')} disabled={true} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed" title="Step Out (Not Implemented)">
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
                                {Object.keys(scope).length > 0 ? Object.entries(scope).map(([key, value]) => (
                                    <div key={key}>
                                        <span className="text-blue-400">{key}:</span>
                                        <span className="text-purple-400 ml-2">{JSON.stringify(value)}</span>
                                    </div>
                                )) : <p className="text-gray-500 text-xs italic">No variables in scope.</p>}
                            </div>
                        </div>

                        {/* Call Stack Section */}
                        <div>
                            <h3 className="font-bold border-b border-green-900/50 mb-1">Call Stack</h3>
                            <ul>
                                {callStack.map((frame, index) => (
                                    <li key={index} className={`p-1 ${index === 0 ? 'bg-green-900/30' : ''}`}>
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
                                    {Array.from(breakpoints.entries()).sort((a,b) => a[0]-b[0]).map(([line, condition]) => (
                                        <li key={line} className="text-gray-300">
                                           Line {line} {condition && <span className="text-yellow-400 italic ml-2">(if {condition})</span>}
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