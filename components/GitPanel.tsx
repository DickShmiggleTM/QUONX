import React, { useState, useEffect } from 'react';
import { GitStatus, Commit, CommitDiff } from '../types.ts';
import { GitIcon, ModifiedIcon, UntrackedIcon, BranchIcon, PushIcon, PullIcon, UndoIcon, ConflictIcon } from './icons.tsx';

interface GitState {
    status: GitStatus;
    currentBranch: string;
    branches: string[];
    history: Commit[];
}

interface GitPanelProps {
    gitState: GitState;
    onCommit: (message: string) => void;
    onCreateBranch: (name: string) => void;
    onSwitchBranch: (name: string) => void;
    onPush: () => void;
    onPull: () => void;
    getCommitDiff: (commitId: string) => CommitDiff | null;
    onRevertCommit: (commitId: string) => void;
}

const FileListItem: React.FC<{
    path: string;
    color: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = ({ path, color, Icon }) => (
    <div className="flex justify-between items-center mb-1 p-1 rounded-sm">
        <span className={`flex items-center ${color}`}>
            <Icon className="w-4 h-4 mr-2 flex-shrink-0" />
            {path}
        </span>
    </div>
);

const DiffViewer: React.FC<{ diff: string }> = ({ diff }) => {
    const lines = diff.split('\n');
    return (
        <pre className="p-2 bg-black/50 font-mono text-xs overflow-x-auto mt-1 rounded">
            <code>
                {lines.map((line, i) => {
                    const color = line.startsWith('+') ? 'bg-green-900/50 text-green-300' : line.startsWith('-') ? 'bg-red-900/50 text-red-400' : 'text-gray-500';
                    return <div key={i} className={color}>{line}</div>
                })}
            </code>
        </pre>
    )
};

const GitPanel: React.FC<GitPanelProps> = ({ gitState, onCommit, onCreateBranch, onSwitchBranch, onPush, onPull, getCommitDiff, onRevertCommit }) => {
    const [commitMessage, setCommitMessage] = useState('');
    const [newBranchName, setNewBranchName] = useState('');
    const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
    const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
    const [commitDiff, setCommitDiff] = useState<CommitDiff | null>(null);

    const { status, currentBranch, branches, history } = gitState;
    const hasChanges = status.modified.length > 0 || status.untracked.length > 0;
    const hasConflicts = status.conflicts && status.conflicts.length > 0;


    useEffect(() => {
        if (selectedCommit) {
            const diffData = getCommitDiff(selectedCommit);
            setCommitDiff(diffData);
        } else {
            setCommitDiff(null);
        }
    }, [selectedCommit, getCommitDiff, history]); // depend on history in case of revert

    const handleCommit = () => {
        if (commitMessage.trim()) {
            if(hasConflicts || hasChanges) {
                onCommit(commitMessage.trim());
                setCommitMessage('');
            }
        }
    };
    
    const handleCreateBranch = () => {
        if (newBranchName.trim()) {
            onCreateBranch(newBranchName.trim());
            setNewBranchName('');
        }
    }
    
    const handleSelectCommit = (commitId: string) => {
        setSelectedCommit(prev => prev === commitId ? null : commitId);
    };

    const handleRevert = (commitId: string) => {
        if(window.confirm(`Are you sure you want to revert commit ${commitId.substring(0,7)}? This will create a new commit.`)) {
            onRevertCommit(commitId);
        }
    };

    const timeAgo = (timestamp: number) => {
        const seconds = Math.floor((new Date().getTime() - timestamp) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return Math.floor(interval) + " years ago";
        interval = seconds / 2592000;
        if (interval > 1) return Math.floor(interval) + " months ago";
        interval = seconds / 86400;
        if (interval > 1) return Math.floor(interval) + " days ago";
        interval = seconds / 3600;
        if (interval > 1) return Math.floor(interval) + " hours ago";
        interval = seconds / 60;
        if (interval > 1) return Math.floor(interval) + " minutes ago";
        return Math.floor(seconds) + " seconds ago";
    };

    return (
        <div className="bg-black/50 border border-green-800 p-2 overflow-y-auto h-full flex flex-col text-xs">
            {/* Header */}
            <div className="flex-shrink-0">
                <h2 className="text-sm mb-2 border-b-2 border-green-800 flex items-center">
                    <GitIcon className="w-4 h-4 mr-2" /> GIT SOURCE CONTROL
                </h2>

                {/* Branch Management */}
                <div className="bg-black/30 p-2 border border-green-900 mb-2">
                    <div className="flex items-center space-x-2 mb-2">
                         <BranchIcon className="w-4 h-4 text-green-400 flex-shrink-0" />
                         <select value={currentBranch} onChange={(e) => onSwitchBranch(e.target.value)} className="w-full bg-black border border-green-700 p-1 text-xs" disabled={hasConflicts}>
                            {branches.map(b => <option key={b} value={b}>{b}</option>)}
                         </select>
                         <button onClick={onPull} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Pull from remote" disabled={hasConflicts}><PullIcon className="w-4 h-4"/></button>
                         <button onClick={onPush} className="p-2 border border-green-700 hover:bg-green-700 rounded-sm" title="Push to remote" disabled={hasConflicts}><PushIcon className="w-4 h-4"/></button>
                    </div>
                     <div className="flex items-center space-x-2">
                        <input 
                            type="text" 
                            value={newBranchName} 
                            onChange={(e) => setNewBranchName(e.target.value)}
                            placeholder="New branch name..."
                            className="w-full bg-black border border-green-700 p-1.5 text-xs placeholder-gray-500"
                            disabled={hasConflicts}
                        />
                        <button onClick={handleCreateBranch} className="px-3 py-1.5 border border-green-700 hover:bg-green-700 rounded-sm whitespace-nowrap" disabled={hasConflicts}>Create Branch</button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-green-800">
                    <button onClick={() => setActiveTab('status')} className={`px-3 py-1 ${activeTab === 'status' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>STATUS</button>
                    <button onClick={() => setActiveTab('history')} className={`px-3 py-1 ${activeTab === 'history' ? 'bg-green-800/50 border-b-2 border-green-400' : 'text-gray-400'}`}>HISTORY</button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-grow overflow-y-auto pt-2">
                {activeTab === 'status' && (
                    <div>
                         {hasConflicts && (
                            <div className="mb-3 p-2 border border-red-500 bg-red-900/30">
                                <h3 className="font-bold text-red-400 flex items-center mb-1">
                                    <ConflictIcon className="w-4 h-4 mr-2" />
                                    Merge Conflicts Detected
                                </h3>
                                <p className="text-gray-300 mb-2">Please resolve the conflicts in the following files, then commit the changes to finalize the merge.</p>
                                {status.conflicts.map(path => (
                                    <FileListItem key={path} path={path} color="text-red-400" Icon={ConflictIcon} />
                                ))}
                            </div>
                        )}
                         <textarea
                            value={commitMessage}
                            onChange={(e) => setCommitMessage(e.target.value)}
                            placeholder={hasConflicts ? "Commit message for merge..." : "Commit message..."}
                            className="w-full bg-black border border-green-700 p-2 text-xs resize-none placeholder-gray-500"
                            rows={3}
                        />
                        <button 
                            onClick={handleCommit} 
                            disabled={hasConflicts ? !commitMessage.trim() : (!hasChanges || !commitMessage.trim())}
                            className="w-full mt-1 p-2 bg-green-700 hover:bg-green-600 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-gray-700 disabled:cursor-not-allowed"
                        >
                            {hasConflicts ? 'Commit Merge' : 'Commit Changes'}
                        </button>
                        
                        {!hasConflicts && (
                             <div className="mt-3">
                                <h3 className="font-bold mb-1">Changes ({status.modified.length + status.untracked.length})</h3>
                                {status.modified.map(path => (
                                    <FileListItem key={path} path={path} color="text-yellow-400" Icon={ModifiedIcon} />
                                ))}
                                {status.untracked.map(path => (
                                    <FileListItem key={path} path={path} color="text-blue-400" Icon={UntrackedIcon} />
                                ))}
                                {!hasChanges && <p className="text-gray-500 mt-2">No changes to commit.</p>}
                            </div>
                        )}
                    </div>
                )}
                {activeTab === 'history' && (
                    <div>
                         {history.length === 0 ? (
                            <p className="text-gray-500 mt-2">No commit history.</p>
                         ) : (
                            <ul>
                                {history.map(c => (
                                    <li key={c.id} className="mb-1 border-b border-green-900/50">
                                        <div onClick={() => handleSelectCommit(c.id)} className="p-2 cursor-pointer hover:bg-green-900/50">
                                            <p className="font-bold text-green-300">{c.message}</p>
                                            <p className="text-gray-400">{c.id.substring(0, 7)} - <span className="italic">{timeAgo(c.timestamp)}</span></p>
                                        </div>
                                        {selectedCommit === c.id && commitDiff && (
                                            <div className="p-2 bg-black/30 border-t-2 border-green-800">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-bold">Commit Details</h4>
                                                    <button 
                                                        onClick={() => handleRevert(c.id)}
                                                        className="flex items-center px-2 py-1 border border-yellow-600 text-yellow-400 hover:bg-yellow-600 hover:text-black rounded-sm"
                                                        title="Revert this commit"
                                                    >
                                                        <UndoIcon className="w-3 h-3 mr-1" />
                                                        Revert
                                                    </button>
                                                </div>
                                                {commitDiff.added.length > 0 && (
                                                    <div className="mb-1">
                                                        <p className="font-semibold text-green-400">Added:</p>
                                                        {commitDiff.added.map(path => <p key={path} className="ml-2 font-mono text-xs">+ {path}</p>)}
                                                    </div>
                                                )}
                                                {commitDiff.deleted.length > 0 && (
                                                    <div className="mb-1">
                                                        <p className="font-semibold text-red-400">Deleted:</p>
                                                        {commitDiff.deleted.map(path => <p key={path} className="ml-2 font-mono text-xs">- {path}</p>)}
                                                    </div>
                                                )}
                                                {commitDiff.modified.length > 0 && (
                                                    <div className="mb-1">
                                                        <p className="font-semibold text-yellow-400">Modified:</p>
                                                        {commitDiff.modified.map(file => (
                                                            <details key={file.path} className="ml-2 mt-1">
                                                                <summary className="font-mono text-xs cursor-pointer">M {file.path}</summary>
                                                                <DiffViewer diff={file.diff} />
                                                            </details>
                                                        ))}
                                                    </div>
                                                )}
                                                {(commitDiff.added.length + commitDiff.modified.length + commitDiff.deleted.length) === 0 && (
                                                    <p className="text-gray-500">No file changes in this commit.</p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GitPanel;