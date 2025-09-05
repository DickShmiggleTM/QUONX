import { FileNode, GitStatus, Commit, CommitDiff } from '../types.ts';

// Simple deep clone for objects and arrays
const deepClone = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

// Diff generation utility (simple line-by-line)
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


export class GitService {
    // Core Git data structures
    private commits: Map<string, Commit> = new Map();
    private branches: Map<string, string> = new Map(); // branch name -> commit id
    private HEAD: string = 'main'; // Points to the current branch name

    // Simulation of remote repository
    private remote: {
        commits: Map<string, Commit>,
        branches: Map<string, string>
    } = {
        commits: new Map(),
        branches: new Map()
    };

    constructor(initialFiles: FileNode[]) {
        this.initializeRepo(initialFiles);
    }

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
    
    private createCommitId = (message: string): string => {
        // Simple pseudo-hash for simulation purposes
        return Math.random().toString(36).substr(2, 7) + Math.random().toString(36).substr(2, 7);
    }

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

    private getHeadCommit(): Commit | undefined {
        const headCommitId = this.branches.get(this.HEAD);
        return headCommitId ? this.commits.get(headCommitId) : undefined;
    }

    public status(currentFiles: FileNode[]): GitStatus {
        const headCommit = this.getHeadCommit();
        if (!headCommit) {
            // Should not happen in an initialized repo
            return { staged: [], modified: [], untracked: [] };
        }

        const headMap = headCommit.tree;
        const currentMap = this.flattenFiles(currentFiles);

        const status: GitStatus = { staged: [], modified: [], untracked: [] };

        currentMap.forEach((content, path) => {
            if (!headMap.has(path)) {
                status.untracked.push(path);
            } else if (headMap.get(path) !== content) {
                status.modified.push(path);
            }
        });
        
        // This simplified model assumes all changes are "staged" on commit.
        // For the UI, we'll treat all diffs as "changes" to be staged.
        status.staged = []; // Staging is now implicit in the commit action.
        status.modified.sort();
        status.untracked.sort();
        
        return status;
    }
    
    // In this new model, `add` is conceptual. The commit will snapshot all changes.
    // We keep this for AI tool compatibility.
    public add(paths: string[] | string): string {
         return "Changes noted. Ready to commit.";
    }

    public commit(currentFiles: FileNode[], message: string): boolean {
        const headCommit = this.getHeadCommit();
        if (!headCommit) return false;

        const currentTree = this.flattenFiles(currentFiles);
        
        // Check if there are any actual changes
        const status = this.status(currentFiles);
        if (status.modified.length === 0 && status.untracked.length === 0) {
            return false; // No changes to commit
        }

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

    public getCurrentBranch = (): string => this.HEAD;
    public listBranches = (): string[] => Array.from(this.branches.keys());

    public createBranch(name: string): boolean {
        if (this.branches.has(name)) return false;
        const headCommitId = this.branches.get(this.HEAD);
        if (headCommitId) {
            this.branches.set(name, headCommitId);
            return true;
        }
        return false;
    }

    public switchBranch(name: string): FileNode[] | null {
        if (!this.branches.has(name)) return null;
        this.HEAD = name;
        const newHeadCommit = this.getHeadCommit();
        if (newHeadCommit) {
            return this.unflattenFiles(newHeadCommit.tree);
        }
        return null;
    }

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

    public push(): { success: boolean; message: string; } {
        const localHeadId = this.branches.get(this.HEAD);
        if (!localHeadId) return { success: false, message: "Error: Could not find local branch HEAD." };

        const remoteBranchId = this.remote.branches.get(this.HEAD);
        
        // Find commits to push
        const commitsToPush: Commit[] = [];
        let currentId = localHeadId;
        while (currentId) {
            const commit = this.commits.get(currentId);
            if (!commit) break;
            if (currentId === remoteBranchId) break; // Reached common ancestor
            commitsToPush.unshift(commit);
            currentId = commit.parents[0];
        }

        if (commitsToPush.length === 0) {
            return { success: true, message: "Everything up-to-date." };
        }

        // Simulate non-fast-forward
        if (remoteBranchId && !commitsToPush.find(c => c.parents.includes(remoteBranchId))) {
             return { success: false, message: "Push rejected. Pull remote changes first (non-fast-forward)." };
        }
        
        // Apply changes to remote
        commitsToPush.forEach(c => this.remote.commits.set(c.id, deepClone(c)));
        this.remote.branches.set(this.HEAD, localHeadId);

        return { success: true, message: `Pushed ${commitsToPush.length} commit(s) to origin/${this.HEAD}.` };
    }

    public pull(): { success: boolean; message: string; newFiles?: FileNode[] } {
        const remoteBranchId = this.remote.branches.get(this.HEAD);
        const localHeadId = this.branches.get(this.HEAD);

        if (!remoteBranchId) return { success: false, message: `No remote branch found for ${this.HEAD}.` };
        if (remoteBranchId === localHeadId) return { success: true, message: "Already up-to-date." };

        const commitsToPull: Commit[] = [];
        let currentId = remoteBranchId;
        while(currentId) {
            const commit = this.remote.commits.get(currentId);
            if (!commit) break;
            if (currentId === localHeadId) break;
            commitsToPull.unshift(commit);
            currentId = commit.parents[0];
        }
        
        if (commitsToPull.length === 0) {
             return { success: true, message: "Already up-to-date." };
        }

        // Copy commits to local and update branch pointer
        commitsToPull.forEach(c => this.commits.set(c.id, deepClone(c)));
        this.branches.set(this.HEAD, remoteBranchId);

        const newHeadCommit = this.commits.get(remoteBranchId)!;
        const newFileTree = this.unflattenFiles(newHeadCommit.tree);

        return { success: true, message: `Pulled ${commitsToPull.length} commit(s). Your local branch is updated.`, newFiles: newFileTree };
    }

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

        // Check for added and modified files
        currentTree.forEach((content, path) => {
            if (!parentTree.has(path)) {
                diff.added.push(path);
            } else if (parentTree.get(path) !== content) {
                diff.modified.push({
                    path,
                    diff: generateDiff(parentTree.get(path)!, content),
                });
            }
        });

        // Check for deleted files
        parentTree.forEach((_content, path) => {
            if (!currentTree.has(path)) {
                diff.deleted.push(path);
            }
        });

        return diff;
    }

    public revertCommit(commitId: string): { success: boolean; message: string; newFiles?: FileNode[] } {
        const commitToRevert = this.commits.get(commitId);
        if (!commitToRevert) {
            return { success: false, message: `Error: Commit ${commitId} not found.` };
        }

        const headCommit = this.getHeadCommit();
        if (!headCommit) {
            return { success: false, message: `Error: Could not find HEAD commit.` };
        }
        
        const parentId = commitToRevert.parents[0];
        const parentCommit = parentId ? this.commits.get(parentId) : null;
        
        // The tree we want to revert to
        const targetTree = parentCommit ? parentCommit.tree : new Map<string, string>();

        const revertMessage = `Revert "${commitToRevert.message}"`;
        const newCommitId = this.createCommitId(revertMessage);
        const newCommit: Commit = {
            id: newCommitId,
            message: revertMessage,
            parents: [headCommit.id], // The new commit is on top of the current HEAD
            tree: targetTree,
            timestamp: Date.now(),
        };

        this.commits.set(newCommitId, newCommit);
        this.branches.set(this.HEAD, newCommitId);

        const newFileTree = this.unflattenFiles(targetTree);
        
        return { success: true, message: `Successfully reverted commit ${commitToRevert.id.substring(0, 7)}. A new commit has been created.`, newFiles: newFileTree };
    }


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
            const dirParts = parts;

            const parentDir = dirParts.length > 0 ? ensurePath(dirParts) : root;
            parentDir.push({ name: fileName, content });
        }

        // Sort files/folders at each level
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