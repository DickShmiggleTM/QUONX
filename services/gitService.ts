import { FileNode, GitStatus, Commit, CommitDiff } from '../types.ts';

// Simple deep clone for objects and arrays
const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

/**
 * @function generateDiff
 * @description Generates a simple line-by-line diff between two strings.
 * @param {string} oldContent - The old content.
 * @param {string} newContent - The new content.
 * @returns {string} The generated diff.
 */
const generateDiff = (oldContent: string, newContent: string): string => {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const allLines = new Set([...oldLines, ...newLines]);
    const diffLines: string[] = [];

    // This is a simplified diff for demonstration.
    // A real implementation would use a proper diffing algorithm (e.g., Myers diff).
    newLines.forEach(line => {
        if (!oldLines.includes(line)) {
            diffLines.push(`+ ${line}`);
        }
    });
    oldLines.forEach(line => {
        if (!newLines.includes(line)) {
            diffLines.push(`- ${line}`);
        }
    });

    if (diffLines.length === 0) {
        // Fallback for content change that doesn't add/remove lines (e.g. whitespace)
        return "+ (Content modified)";
    }

    return diffLines.join('\n');
};


/**
 * @class GitService
 * @description A service for simulating Git functionality.
 */
export class GitService {
    // Core Git data structures
    private commits: Map<string, Commit> = new Map();
    private branches: Map<string, string> = new Map(); // branch name -> commit id
    private HEAD: string = 'main'; // Points to the current branch name
    private mergeConflictFiles: Set<string> = new Set();

    // Simulation of remote repository
    private remote: {
        commits: Map<string, Commit>,
        branches: Map<string, string>
    } = {
        commits: new Map(),
        branches: new Map()
    };

    /**
     * @constructor
     * @param {FileNode[]} initialFiles - The initial file system structure.
     */
    constructor(initialFiles: FileNode[]) {
        this.initializeRepo(initialFiles);
    }

    /**
     * @function initializeRepo
     * @description Initializes the Git repository with an initial commit.
     * @param {FileNode[]} initialFiles - The initial file system structure.
     * @private
     */
    private initializeRepo(initialFiles: FileNode[]) {
        const initialTree = this.flattenFiles(initialFiles);
        const initialCommitId = this.createCommitId("Initial commit");
        const initialCommit: Commit = {
            id: initialCommitId,
            message: "Initial commit",
            parents: [],
            tree: initialTree,
            timestamp: Date.now(),
        };
        this.commits.set(initialCommitId, initialCommit);
        this.branches.set('main', initialCommitId);

        // Sync remote
        this.remote.commits.set(initialCommitId, deepClone(initialCommit));
        this.remote.branches.set('main', initialCommitId);
    }
    
    /**
     * @function createCommitId
     * @description Creates a pseudo-random commit ID.
     * @param {string} message - The commit message.
     * @returns {string} The commit ID.
     * @private
     */
    private createCommitId = (message: string): string => {
        // Simple pseudo-hash for simulation purposes
        return Math.random().toString(36).substr(2, 7) + Math.random().toString(36).substr(2, 7);
    }

    /**
     * @function flattenFiles
     * @description Flattens a file tree into a map of paths to content.
     * @param {FileNode[]} nodes - The file tree to flatten.
     * @param {string} [pathPrefix=''] - The path prefix.
     * @returns {Map<string, string>} The flattened file map.
     * @private
     */
    private flattenFiles(nodes: FileNode[], pathPrefix = ''): Map<string, string> {
        const fileMap = new Map<string, string>();
        for (const node of nodes) {
            const path = pathPrefix ? `${pathPrefix}/${node.name}` : node.name;
            if (node.children) {
                const childMap = this.flattenFiles(node.children, path);
                childMap.forEach((content, childPath) => fileMap.set(childPath, content));
            } else if (node.content !== undefined) {
                fileMap.set(path, node.content);
            }
        }
        return fileMap;
    }

    /**
     * @function getHeadCommit
     * @description Gets the commit that HEAD points to.
     * @returns {Commit | undefined} The HEAD commit, or undefined if not found.
     * @private
     */
    private getHeadCommit(): Commit | undefined {
        const headCommitId = this.branches.get(this.HEAD);
        return headCommitId ? this.commits.get(headCommitId) : undefined;
    }

    /**
     * @function status
     * @description Gets the status of the repository.
     * @param {FileNode[]} currentFiles - The current file system structure.
     * @returns {GitStatus} The status of the repository.
     */
    public status(currentFiles: FileNode[]): GitStatus {
        if (this.mergeConflictFiles.size > 0) {
            return {
                staged: [],
                modified: [],
                untracked: [],
                conflicts: Array.from(this.mergeConflictFiles).sort(),
            };
        }
        
        const headCommit = this.getHeadCommit();
        if (!headCommit) {
            return { staged: [], modified: [], untracked: [], conflicts: [] };
        }

        const headMap = headCommit.tree;
        const currentMap = this.flattenFiles(currentFiles);

        const status: GitStatus = { staged: [], modified: [], untracked: [], conflicts: [] };

        currentMap.forEach((content, path) => {
            if (!headMap.has(path)) {
                status.untracked.push(path);
            } else if (headMap.get(path) !== content) {
                status.modified.push(path);
            }
        });
        
        status.modified.sort();
        status.untracked.sort();
        
        return status;
    }

    /**
     * @function commit
     * @description Commits changes to the repository.
     * @param {FileNode[]} currentFiles - The current file system structure.
     * @param {string} message - The commit message.
     * @returns {boolean} Whether the commit was successful.
     */
    public commit(currentFiles: FileNode[], message: string): boolean {
        const headCommit = this.getHeadCommit();
        if (!headCommit) return false;

        const isMergeCommit = this.mergeConflictFiles.size > 0;
        if (isMergeCommit) {
            this.mergeConflictFiles.clear();
        } else {
            const status = this.status(currentFiles);
            if (status.modified.length === 0 && status.untracked.length === 0) {
                return false;
            }
        }

        const currentTree = this.flattenFiles(currentFiles);
        const newCommitId = this.createCommitId(message);
        const newCommit: Commit = {
            id: newCommitId,
            message,
            parents: [headCommit.id],
            tree: currentTree,
            timestamp: Date.now(),
        };
        
        this.commits.set(newCommitId, newCommit);
        this.branches.set(this.HEAD, newCommitId);
        
        return true;
    }

    /**
     * @function getCurrentBranch
     * @description Gets the name of the current branch.
     * @returns {string} The name of the current branch.
     */
    public getCurrentBranch = (): string => this.HEAD;
    /**
     * @function listBranches
     * @description Lists all branches.
     * @returns {string[]} A list of all branch names.
     */
    public listBranches = (): string[] => Array.from(this.branches.keys());

    /**
     * @function createBranch
     * @description Creates a new branch.
     * @param {string} name - The name of the new branch.
     * @returns {boolean} Whether the branch was created successfully.
     */
    public createBranch(name: string): boolean {
        if (this.branches.has(name)) return false;
        const headCommitId = this.branches.get(this.HEAD);
        if (headCommitId) {
            this.branches.set(name, headCommitId);
            return true;
        }
        return false;
    }

    /**
     * @function switchBranch
     * @description Switches to a different branch.
     * @param {string} name - The name of the branch to switch to.
     * @returns {FileNode[] | null} The file system structure of the new branch, or null if the switch failed.
     */
    public switchBranch(name: string): FileNode[] | null {
        if (!this.branches.has(name)) return null;
        if (this.mergeConflictFiles.size > 0) {
            console.error("Cannot switch branches with unresolved conflicts.");
            return null;
        }
        this.HEAD = name;
        const newHeadCommit = this.getHeadCommit();
        if (newHeadCommit) {
            return this.unflattenFiles(newHeadCommit.tree);
        }
        return null;
    }

    /**
     * @function getCommitHistory
     * @description Gets the commit history of the current branch.
     * @returns {Commit[]} The commit history.
     */
    public getCommitHistory(): Commit[] {
        const history: Commit[] = [];
        let currentCommitId = this.branches.get(this.HEAD);
        while (currentCommitId) {
            const commit = this.commits.get(currentCommitId);
            if (!commit) break;
            history.push(commit);
            currentCommitId = commit.parents[0]; // Simplified to follow first parent
        }
        return history;
    }

    /**
     * @function push
     * @description Pushes changes to the remote repository.
     * @returns {{ success: boolean; message: string; }} The result of the push operation.
     */
    public push(): { success: boolean; message: string; } {
        const localHeadId = this.branches.get(this.HEAD);
        if (!localHeadId) return { success: false, message: "Error: Could not find local branch HEAD." };

        const remoteBranchId = this.remote.branches.get(this.HEAD);
        
        const commitsToPush: Commit[] = [];
        let currentId = localHeadId;
        while (currentId) {
            const commit = this.commits.get(currentId);
            if (!commit) break;
            if (currentId === remoteBranchId) break;
            commitsToPush.unshift(commit);
            currentId = commit.parents[0];
        }

        if (commitsToPush.length === 0) {
            return { success: true, message: "Everything up-to-date." };
        }

        if (remoteBranchId && !commitsToPush.find(c => c.parents.includes(remoteBranchId))) {
             return { success: false, message: "Push rejected. Pull remote changes first (non-fast-forward)." };
        }
        
        commitsToPush.forEach(c => this.remote.commits.set(c.id, deepClone(c)));
        this.remote.branches.set(this.HEAD, localHeadId);

        return { success: true, message: `Pushed ${commitsToPush.length} commit(s) to origin/${this.HEAD}.` };
    }
    
    /**
     * @function findCommonAncestor
     * @description Finds the common ancestor of two commits.
     * @param {string} commitId1 - The ID of the first commit.
     * @param {string} commitId2 - The ID of the second commit.
     * @param {Map<string, Commit>} commitMap - The map of commits to search.
     * @returns {string | null} The ID of the common ancestor, or null if not found.
     * @private
     */
    private findCommonAncestor(commitId1: string, commitId2: string, commitMap: Map<string, Commit>): string | null {
        const path1 = new Set<string>();
        let currentId: string | undefined = commitId1;
        while (currentId) {
            path1.add(currentId);
            const commit = commitMap.get(currentId);
            currentId = commit?.parents[0];
        }

        currentId = commitId2;
        while (currentId) {
            if (path1.has(currentId)) return currentId;
            const commit = commitMap.get(currentId);
            currentId = commit?.parents[0];
        }
        return null;
    }
    
    /**
     * @function getChangedFilesSince
     * @description Gets the set of files that have changed between two commits.
     * @param {string} startCommitId - The ID of the starting commit.
     * @param {string | null} ancestorId - The ID of the ancestor commit.
     * @param {Map<string, Commit>} commitMap - The map of commits to search.
     * @returns {Set<string>} A set of changed file paths.
     * @private
     */
    private getChangedFilesSince(startCommitId: string, ancestorId: string | null, commitMap: Map<string, Commit>): Set<string> {
        const changedFiles = new Set<string>();
        let currentId: string | undefined = startCommitId;
        while(currentId && currentId !== ancestorId) {
            const commit = commitMap.get(currentId);
            if (!commit) break;
            const parentId = commit.parents[0];
            const parentCommit = parentId ? commitMap.get(parentId) : null;
            const currentTree = commit.tree;
            const parentTree = parentCommit ? parentCommit.tree : new Map<string, string>();
            
            currentTree.forEach((content, path) => {
                if (parentTree.get(path) !== content) changedFiles.add(path);
            });
            parentTree.forEach((_content, path) => {
                if (!currentTree.has(path)) changedFiles.add(path);
            });
            
            currentId = parentId;
        }
        return changedFiles;
    }

    /**
     * @function pull
     * @description Pulls changes from the remote repository.
     * @returns {{ success: boolean; message: string; newFiles?: FileNode[], conflictingFiles?: string[] }} The result of the pull operation.
     */
    public pull(): { success: boolean; message: string; newFiles?: FileNode[], conflictingFiles?: string[] } {
        this.mergeConflictFiles.clear();
        const remoteBranchId = this.remote.branches.get(this.HEAD);
        const localHeadId = this.branches.get(this.HEAD);

        if (!remoteBranchId || !localHeadId) return { success: false, message: `Could not find branch HEAD.` };
        if (remoteBranchId === localHeadId) return { success: true, message: "Already up-to-date." };

        const ancestorId = this.findCommonAncestor(localHeadId, remoteBranchId, this.commits);

        // Case: Local is ancestor of remote -> fast-forward
        if (localHeadId === ancestorId) {
            const remoteHeadCommit = this.remote.commits.get(remoteBranchId)!;
            this.commits.set(remoteHeadCommit.id, deepClone(remoteHeadCommit));
            this.branches.set(this.HEAD, remoteBranchId);
            const newFileTree = this.unflattenFiles(remoteHeadCommit.tree);
            return { success: true, message: `Pulled and fast-forwarded remote changes.`, newFiles: newFileTree };
        }
        
        // Case: Remote is ancestor of local -> nothing to pull
        if (remoteBranchId === ancestorId) return { success: true, message: "Local branch is ahead of remote. Nothing to pull." };

        // Case: Branches have diverged
        const remoteChanges = this.getChangedFilesSince(remoteBranchId, ancestorId, this.remote.commits);
        const localChanges = this.getChangedFilesSince(localHeadId, ancestorId, this.commits);
        const conflictingFiles = Array.from(remoteChanges).filter(file => localChanges.has(file));

        if (conflictingFiles.length > 0) {
            this.mergeConflictFiles = new Set(conflictingFiles);
            return { success: false, message: `Merge conflict in: ${conflictingFiles.join(', ')}. Please resolve conflicts and commit.`, conflictingFiles };
        }
        
        // Diverged but no conflicts -> simulate a simple merge by taking remote changes
        const remoteHeadCommit = this.remote.commits.get(remoteBranchId)!;
        this.commits.set(remoteHeadCommit.id, deepClone(remoteHeadCommit));
        this.branches.set(this.HEAD, remoteBranchId);
        const newFileTree = this.unflattenFiles(remoteHeadCommit.tree);
        return { success: true, message: `Pulled and merged non-conflicting changes from remote.`, newFiles: newFileTree };
    }

    /**
     * @function getCommitDiff
     * @description Gets the diff of a commit.
     * @param {string} commitId - The ID of the commit.
     * @returns {CommitDiff | null} The diff of the commit, or null if not found.
     */
    public getCommitDiff(commitId: string): CommitDiff | null {
        const commit = this.commits.get(commitId);
        if (!commit) return null;

        const parentId = commit.parents[0];
        const parentCommit = parentId ? this.commits.get(parentId) : null;

        const currentTree = commit.tree;
        const parentTree = parentCommit ? parentCommit.tree : new Map<string, string>();

        const diff: CommitDiff = {
            added: [],
            modified: [],
            deleted: [],
        };

        currentTree.forEach((content, path) => {
            if (!parentTree.has(path)) diff.added.push(path);
            else if (parentTree.get(path) !== content) diff.modified.push({ path, diff: generateDiff(parentTree.get(path)!, content) });
        });
        parentTree.forEach((_content, path) => {
            if (!currentTree.has(path)) diff.deleted.push(path);
        });

        return diff;
    }

    /**
     * @function revertCommit
     * @description Reverts a commit.
     * @param {string} commitId - The ID of the commit to revert.
     * @returns {{ success: boolean; message: string; newFiles?: FileNode[] }} The result of the revert operation.
     */
    public revertCommit(commitId: string): { success: boolean; message: string; newFiles?: FileNode[] } {
        const commitToRevert = this.commits.get(commitId);
        if (!commitToRevert) return { success: false, message: `Error: Commit ${commitId} not found.` };
        
        const headCommit = this.getHeadCommit();
        if (!headCommit) return { success: false, message: `Error: Could not find HEAD commit.` };
        
        const parentId = commitToRevert.parents[0];
        const parentCommit = parentId ? this.commits.get(parentId) : null;
        const targetTree = parentCommit ? parentCommit.tree : new Map<string, string>();

        const revertMessage = `Revert "${commitToRevert.message}"`;
        const newCommitId = this.createCommitId(revertMessage);
        const newCommit: Commit = { id: newCommitId, message: revertMessage, parents: [headCommit.id], tree: targetTree, timestamp: Date.now() };

        this.commits.set(newCommitId, newCommit);
        this.branches.set(this.HEAD, newCommitId);

        const newFileTree = this.unflattenFiles(targetTree);
        return { success: true, message: `Successfully reverted commit ${commitToRevert.id.substring(0, 7)}. A new commit has been created.`, newFiles: newFileTree };
    }

    /**
     * @function unflattenFiles
     * @description Unflattens a map of paths to content into a file tree.
     * @param {Map<string, string>} tree - The map to unflatten.
     * @returns {FileNode[]} The unflattened file tree.
     * @private
     */
    private unflattenFiles(tree: Map<string, string>): FileNode[] {
        const root: FileNode[] = [];
        const dirs = new Map<string, FileNode>();

        const ensurePath = (pathParts: string[]): FileNode[] => {
            let currentLevel = root;
            for (let i = 0; i < pathParts.length; i++) {
                const part = pathParts[i];
                const currentPath = pathParts.slice(0, i + 1).join('/');
                let node = dirs.get(currentPath);
                if (!node) {
                    node = { name: part, children: [] };
                    currentLevel.push(node);
                    dirs.set(currentPath, node);
                }
                currentLevel = node.children!;
            }
            return currentLevel;
        };

        for (const [path, content] of tree.entries()) {
            const parts = path.split('/');
            const fileName = parts.pop()!;
            const parentDir = parts.length > 0 ? ensurePath(parts) : root;
            parentDir.push({ name: fileName, content });
        }

        const sortNodes = (nodes: FileNode[]) => {
            nodes.sort((a, b) => a.name.localeCompare(b.name));
            nodes.forEach(node => {
                if (node.children) sortNodes(node.children);
            });
        };
        sortNodes(root);
        return root;
    }
}