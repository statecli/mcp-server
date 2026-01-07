/**
 * Git Integration - Track changes between commits
 * 
 * Integrates with git to provide commit-level state tracking
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { StateCLI } from './statecli';

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  files: string[];
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  changes: string[];
}

export interface CommitComparison {
  fromCommit: string;
  toCommit: string;
  files: GitDiff[];
  summary: string;
}

export class GitIntegration {
  private statecli: StateCLI;
  private repoPath: string;

  constructor(statecli: StateCLI, repoPath: string = '.') {
    this.statecli = statecli;
    this.repoPath = path.resolve(repoPath);
  }

  /**
   * Check if current directory is a git repository
   */
  isGitRepo(): boolean {
    try {
      this.execGit('rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): string {
    return this.execGit('rev-parse --abbrev-ref HEAD').trim();
  }

  /**
   * Get current commit hash
   */
  getCurrentCommit(): string {
    return this.execGit('rev-parse HEAD').trim();
  }

  /**
   * Get recent commits
   */
  getRecentCommits(count: number = 10): GitCommit[] {
    const format = '%H|%h|%s|%an|%ai';
    const log = this.execGit(`log -${count} --pretty=format:"${format}"`);
    
    return log.split('\n').filter(line => line.trim()).map(line => {
      const [hash, shortHash, message, author, date] = line.split('|');
      const files = this.getCommitFiles(hash);
      
      return { hash, shortHash, message, author, date, files };
    });
  }

  /**
   * Get files changed in a commit
   */
  getCommitFiles(commitHash: string): string[] {
    try {
      const output = this.execGit(`diff-tree --no-commit-id --name-only -r ${commitHash}`);
      return output.split('\n').filter(f => f.trim());
    } catch {
      return [];
    }
  }

  /**
   * Compare two commits
   */
  compareCommits(fromCommit: string, toCommit: string): CommitComparison {
    const diffOutput = this.execGit(`diff --stat ${fromCommit}..${toCommit}`);
    const files: GitDiff[] = [];

    // Parse diff stat output
    const lines = diffOutput.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s+(\++)?(-+)?/);
      if (match) {
        const [, file, total, additions, deletions] = match;
        files.push({
          file: file.trim(),
          additions: (additions || '').length,
          deletions: (deletions || '').length,
          changes: this.getFileDiff(fromCommit, toCommit, file.trim())
        });
      }
    }

    const summary = `Comparing ${fromCommit.substring(0, 7)} to ${toCommit.substring(0, 7)}: ${files.length} files changed`;

    return { fromCommit, toCommit, files, summary };
  }

  /**
   * Get diff for a specific file between commits
   */
  getFileDiff(fromCommit: string, toCommit: string, filePath: string): string[] {
    try {
      const diff = this.execGit(`diff ${fromCommit}..${toCommit} -- "${filePath}"`);
      return diff.split('\n').slice(0, 100); // Limit to 100 lines
    } catch {
      return [];
    }
  }

  /**
   * Track current git state in StateCLI
   */
  trackGitState(actor: string = 'git-integration'): void {
    const branch = this.getCurrentBranch();
    const commit = this.getCurrentCommit();
    const recentCommits = this.getRecentCommits(5);

    this.statecli.track('git', 'state', {
      branch,
      commit,
      shortCommit: commit.substring(0, 7),
      recentCommits: recentCommits.map(c => ({
        hash: c.shortHash,
        message: c.message
      })),
      timestamp: new Date().toISOString()
    }, actor);
  }

  /**
   * Create a checkpoint at current git state
   */
  createGitCheckpoint(name?: string): { checkpointId: string; commit: string } {
    const commit = this.getCurrentCommit();
    const checkpointName = name || `git-${commit.substring(0, 7)}`;
    
    const result = this.statecli.checkpoint('git:state', checkpointName);
    
    return {
      checkpointId: result.id,
      commit
    };
  }

  /**
   * Get what happened between two commits in StateCLI format
   */
  getCommitHistory(fromCommit: string, toCommit: string): {
    commits: GitCommit[];
    comparison: CommitComparison;
    stateChanges: ReturnType<StateCLI['replay']>;
  } {
    // Get commits between the two
    const commits = this.getCommitsBetween(fromCommit, toCommit);
    
    // Get comparison
    const comparison = this.compareCommits(fromCommit, toCommit);
    
    // Get StateCLI state changes during this period
    const stateChanges = this.statecli.replay('git:state');

    return { commits, comparison, stateChanges };
  }

  /**
   * Get commits between two commit hashes
   */
  private getCommitsBetween(fromCommit: string, toCommit: string): GitCommit[] {
    const format = '%H|%h|%s|%an|%ai';
    try {
      const log = this.execGit(`log ${fromCommit}..${toCommit} --pretty=format:"${format}"`);
      
      return log.split('\n').filter(line => line.trim()).map(line => {
        const [hash, shortHash, message, author, date] = line.split('|');
        const files = this.getCommitFiles(hash);
        
        return { hash, shortHash, message, author, date, files };
      });
    } catch {
      return [];
    }
  }

  /**
   * Get uncommitted changes
   */
  getUncommittedChanges(): { staged: string[]; unstaged: string[]; untracked: string[] } {
    const staged = this.execGit('diff --cached --name-only').split('\n').filter(f => f.trim());
    const unstaged = this.execGit('diff --name-only').split('\n').filter(f => f.trim());
    const untracked = this.execGit('ls-files --others --exclude-standard').split('\n').filter(f => f.trim());

    return { staged, unstaged, untracked };
  }

  /**
   * Execute a git command
   */
  private execGit(command: string): string {
    try {
      return execSync(`git ${command}`, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (error: any) {
      throw new Error(`Git command failed: ${error.message}`);
    }
  }
}
