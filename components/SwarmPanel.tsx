import React, { useRef, useEffect, useState } from 'react';
import { SwarmTaskStatus, SwarmPlanStep, Agent } from '../types.ts';
import { SwarmIcon, ThinkingIcon } from './icons.tsx';

/**
 * @interface SwarmPanelProps
 * @description Props for the SwarmPanel component.
 * @property {SwarmTaskStatus} task - The current status of the swarm task.
 * @property {Agent[]} agents - A list of all available agents.
 * @property {(role: string) => void} onToggleAgent - Function to toggle an agent.
 * @property {(role: string, description: string, model: Agent['model']) => void} onCreateAgent - Function to create a new agent.
 */
interface SwarmPanelProps {
    task: SwarmTaskStatus;
    agents: Agent[];
    onToggleAgent: (role: string) => void;
    onCreateAgent: (role: string, description: string, model: Agent['model']) => void;
}

/**
 * @function getStatusColor
 * @description Gets the color for a status string.
 * @param {SwarmPlanStep['status'] | SwarmTaskStatus['status']} status - The status string.
 * @returns {string} The color class for the status.
 */
const getStatusColor = (status: SwarmPlanStep['status'] | SwarmTaskStatus['status']) => {
    switch(status) {
        case 'complete':
        case 'finished':
            return 'text-green-400';
        case 'executing':
        case 'planning':
        case 'designing':
        case 'reviewing':
        case 'testing':
        case 'documenting':
        case 'summarizing':
            return 'text-yellow-400';
        case 'pending':
            return 'text-gray-500';
        case 'error':
        case 'failed':
            return 'text-red-500';
        default:
            return 'text-gray-400';
    }
};

/**
 * @function SwarmPanel
 * @description A component for monitoring and managing swarm activity.
 * @param {SwarmPanelProps} props - The props for the component.
 * @returns {JSX.Element} The rendered SwarmPanel component.
 */
const SwarmPanel: React.FC<SwarmPanelProps> = ({ task, agents, onToggleAgent, onCreateAgent }) => {
    const logRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'status' | 'logs' | 'agents'>('status');
    const [newAgentRole, setNewAgentRole] = useState('');
    const [newAgentDesc, setNewAgentDesc] = useState('');
    const [newAgentModel, setNewAgentModel] = useState<Agent['model']>('reasoner');

    useEffect(() => {
        if (activeTab === 'logs' && logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [task.logs, activeTab]);
    
    /**
     * @function handleCreateAgentSubmit
     * @description Handles the submission of the create agent form.
     * @param {React.FormEvent} e - The form event.
     * @returns {void}
     */
    const handleCreateAgentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onCreateAgent(newAgentRole.trim(), newAgentDesc.trim(), newAgentModel);
        setNewAgentRole('');
        setNewAgentDesc('');
    };

    const isRunning = ['planning', 'designing', 'executing', 'reviewing', 'testing', 'documenting', 'summarizing'].includes(task.status);

    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
            {/* Header */}
            <div className="flex-shrink-0 mb-2">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <SwarmIcon className="w-4 h-4 mr-2" /> SWARM ACTIVITY
                </h2>
                <div className="bg-black/30 p-2 border border-green-900 mb-2">
                    <p className="font-bold text-green-300">Goal:</p>
                    <p className="text-gray-300 mb-2">{task.goal || 'No active task.'}</p>
                    <p>
                        <span className="font-bold text-green-300">Status:</span>
                        <span className={`ml-2 font-bold uppercase ${getStatusColor(task.status)} flex items-center`}>
                           {isRunning && <ThinkingIcon className="w-3 h-3 mr-2 animate-spin" />}
                           {task.status}
                        </span>
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-green-800 flex-shrink-0">
                <button onClick={() => setActiveTab('status')} className={`px-3 py-1 ${activeTab === 'status' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>STATUS</button>
                <button onClick={() => setActiveTab('logs')} className={`px-3 py-1 ${activeTab === 'logs' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>LOGS</button>
                <button onClick={() => setActiveTab('agents')} className={`px-3 py-1 ${activeTab === 'agents' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>AGENTS</button>
            </div>

            {/* Main Content */}
            <div className="flex-grow overflow-y-auto pt-2">
                {activeTab === 'status' && (
                     <div className="flex-grow overflow-y-auto pr-1">
                        <h3 className="font-bold mb-1">Plan</h3>
                        {task.plan.length === 0 ? (
                            <p className="text-gray-500">Waiting for plan...</p>
                        ) : (
                            <ul className="space-y-2">
                                {task.plan.map(step => (
                                    <li key={step.step} className="p-2 bg-black/20 border border-gray-700/50">
                                        <div className="flex justify-between items-center font-bold">
                                            <span>Step {step.step}: {step.action} {step.agent_role && `(${step.agent_role})`}</span>
                                            <span className={`text-xs uppercase ${getStatusColor(step.status)}`}>{step.status}</span>
                                        </div>
                                        <p className="text-gray-400 text-xs mt-1 truncate" title={step.path || step.goal}>{step.path || step.goal}</p>
                                        {step.status === 'error' && <p className="text-red-500 text-xs mt-1">Error: {step.result}</p>}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {activeTab === 'logs' && (
                     <div ref={logRef} className="h-full overflow-y-auto bg-black/40 p-1 font-mono">
                        {task.logs.length === 0 ? (<p className="text-gray-500">No logs yet.</p>) : task.logs.map((log, index) => (
                            <div key={index} className="mb-1">
                                <span className="text-gray-500">{log.timestamp}</span>
                                <span className="font-bold text-blue-400 mx-1">[{log.role}]</span>
                                <span>{log.message}</span>
                            </div>
                        ))}
                     </div>
                )}
                {activeTab === 'agents' && (
                    <div>
                        <h3 className="font-bold mb-2">Manage Agents</h3>
                        <ul className="space-y-2 mb-4">
                            {agents.map(agent => (
                                <li key={agent.role} className="p-2 bg-black/20 border border-gray-700/50">
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold ${agent.isCustom ? 'text-yellow-400' : 'text-green-300'}`}>{agent.role} {agent.isCustom && '(Custom)'}</span>
                                        <label className="flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only"
                                                checked={agent.isActive}
                                                onChange={() => onToggleAgent(agent.role)}
                                            />
                                            <div className={`w-8 h-4 flex items-center rounded-full p-1 transition-colors ${agent.isActive ? 'bg-green-600' : 'bg-gray-700'}`}>
                                                <div className={`bg-white w-2 h-2 rounded-full shadow-md transform transition-transform ${agent.isActive ? 'translate-x-4' : ''}`}></div>
                                            </div>
                                        </label>
                                    </div>
                                    <p className="text-gray-400 mt-1">{agent.description}</p>
                                </li>
                            ))}
                        </ul>
                        <form onSubmit={handleCreateAgentSubmit} className="border-t-2 border-green-800 pt-2">
                            <h3 className="font-bold mb-2">Create New Agent</h3>
                            <input
                                type="text"
                                placeholder="Agent Role (e.g., DatabaseOptimizer)"
                                value={newAgentRole}
                                onChange={e => setNewAgentRole(e.target.value)}
                                className="w-full bg-black border border-green-700 p-1 mb-2 text-xs placeholder-gray-500"
                                required
                            />
                            <textarea
                                placeholder="Agent Description (e.g., Analyzes SQL queries and rewrites them for performance.)"
                                value={newAgentDesc}
                                onChange={e => setNewAgentDesc(e.target.value)}
                                className="w-full bg-black border border-green-700 p-1 mb-2 text-xs resize-y placeholder-gray-500"
                                rows={3}
                                required
                            />
                            <select value={newAgentModel} onChange={(e) => setNewAgentModel(e.target.value as Agent['model'])} className="w-full bg-black border border-green-700 p-1 mb-2">
                                <option value="reasoner">Reasoner Model (for planning, analysis)</option>
                                <option value="code">Code Model (for code generation)</option>
                                <option value="chat">Chat Model (for text, docs)</option>
                            </select>
                            <button type="submit" className="w-full p-2 bg-green-700 hover:bg-green-600">Create Agent</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SwarmPanel;