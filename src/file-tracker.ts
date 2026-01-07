/**
 * File Tracker - Auto-tracking of file edits
 * 
 * Automatically tracks file changes and integrates with StateCLI
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { StateCLI } from './statecli';

export interface FileChange {
  filePath: string;
  operation: 'create' | 'modify' | 'delete';
  before: string | null;
  after: string | null;
  diff: string[];
  timestamp: string;
}

export interface FileTrackerConfig {
  watchPaths: string[];
  ignorePatterns: string[];
  autoCheckpoint: boolean;
  checkpointThreshold: number; // Number of changes before auto-checkpoint
}

const DEFAULT_CONFIG: FileTrackerConfig = {
  watchPaths: ['.'],
  ignorePatterns: ['node_modules', '.git', 'dist', '*.log', '.statecli'],
  autoCheckpoint: true,
  checkpointThreshold: 10
};

export class FileTracker {
  private statecli: StateCLI;
  private config: FileTrackerConfig;
  private fileHashes: Map<string, string> = new Map();
  private changeCount: number = 0;
  private watchers: fs.FSWatcher[] = [];

  constructor(statecli: StateCLI, config?: Partial<FileTrackerConfig>) {
    this.statecli = statecli;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start watching files for changes
   */
  startWatching(): void {
    for (const watchPath of this.config.watchPaths) {
      this.watchDirectory(watchPath);
    }
  }

  /**
   * Stop watching files
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }

  /**
   * Track a file change manually
   */
  trackFileChange(
    filePath: string,
    operation: 'create' | 'modify' | 'delete',
    beforeContent: string | null,
    afterContent: string | null,
    actor: string = 'ai-agent'
  ): FileChange {
    const diff = this.computeDiff(beforeContent, afterContent);
    const timestamp = new Date().toISOString();

    const change: FileChange = {
      filePath: path.normalize(filePath),
      operation,
      before: beforeContent,
      after: afterContent,
      diff,
      timestamp
    };

    // Track in StateCLI
    this.statecli.track('file', filePath, {
      operation,
      contentHash: afterContent ? this.hashContent(afterContent) : null,
      lineCount: afterContent ? afterContent.split('\n').length : 0,
      diff: diff.slice(0, 50), // Store first 50 diff lines
      timestamp
    }, actor);

    this.changeCount++;

    // Auto-checkpoint if threshold reached
    if (this.config.autoCheckpoint && 
        this.changeCount >= this.config.checkpointThreshold) {
      this.createAutoCheckpoint();
    }

    return change;
  }

  /**
   * Track a file edit with before/after content
   */
  trackEdit(
    filePath: string,
    beforeContent: string,
    afterContent: string,
    actor: string = 'ai-agent'
  ): FileChange {
    return this.trackFileChange(filePath, 'modify', beforeContent, afterContent, actor);
  }

  /**
   * Track a file creation
   */
  trackCreate(
    filePath: string,
    content: string,
    actor: string = 'ai-agent'
  ): FileChange {
    return this.trackFileChange(filePath, 'create', null, content, actor);
  }

  /**
   * Track a file deletion
   */
  trackDelete(
    filePath: string,
    previousContent: string,
    actor: string = 'ai-agent'
  ): FileChange {
    return this.trackFileChange(filePath, 'delete', previousContent, null, actor);
  }

  /**
   * Get file change history
   */
  getFileHistory(filePath: string): ReturnType<StateCLI['replay']> {
    return this.statecli.replay(`file:${path.normalize(filePath)}`);
  }

  /**
   * Compute simple diff between two strings
   */
  private computeDiff(before: string | null, after: string | null): string[] {
    const diff: string[] = [];
    
    if (before === null && after !== null) {
      // New file
      const lines = after.split('\n');
      lines.forEach((line, i) => {
        diff.push(`+${i + 1}: ${line}`);
      });
    } else if (before !== null && after === null) {
      // Deleted file
      const lines = before.split('\n');
      lines.forEach((line, i) => {
        diff.push(`-${i + 1}: ${line}`);
      });
    } else if (before !== null && after !== null) {
      // Modified file - simple line-by-line diff
      const beforeLines = before.split('\n');
      const afterLines = after.split('\n');
      
      const maxLines = Math.max(beforeLines.length, afterLines.length);
      
      for (let i = 0; i < maxLines; i++) {
        const beforeLine = beforeLines[i];
        const afterLine = afterLines[i];
        
        if (beforeLine !== afterLine) {
          if (beforeLine !== undefined) {
            diff.push(`-${i + 1}: ${beforeLine}`);
          }
          if (afterLine !== undefined) {
            diff.push(`+${i + 1}: ${afterLine}`);
          }
        }
      }
    }
    
    return diff;
  }

  /**
   * Create a hash of file content
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Watch a directory for changes
   */
  private watchDirectory(dirPath: string): void {
    try {
      const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
        if (filename && !this.shouldIgnore(filename)) {
          this.handleFileEvent(path.join(dirPath, filename), eventType);
        }
      });
      this.watchers.push(watcher);
    } catch (error) {
      console.error(`Failed to watch directory ${dirPath}:`, error);
    }
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnore(filePath: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(filePath)) return true;
      } else {
        if (filePath.includes(pattern)) return true;
      }
    }
    return false;
  }

  /**
   * Handle a file system event
   */
  private handleFileEvent(filePath: string, eventType: string): void {
    const normalizedPath = path.normalize(filePath);
    const previousHash = this.fileHashes.get(normalizedPath);

    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const newHash = this.hashContent(content);

        if (previousHash !== newHash) {
          this.fileHashes.set(normalizedPath, newHash);
          
          if (previousHash === undefined) {
            // New file or first time seeing it
            this.trackCreate(normalizedPath, content);
          } else {
            // Modified file
            this.trackEdit(normalizedPath, '', content); // We don't have old content in watch mode
          }
        }
      } else if (previousHash !== undefined) {
        // File was deleted
        this.fileHashes.delete(normalizedPath);
        this.trackDelete(normalizedPath, '');
      }
    } catch (error) {
      // File might be locked or inaccessible
    }
  }

  /**
   * Create an automatic checkpoint
   */
  private createAutoCheckpoint(): void {
    const checkpointName = `auto-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.statecli.checkpoint('session:current', checkpointName);
    this.changeCount = 0;
  }
}
