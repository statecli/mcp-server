import * as fs from 'fs';
import * as path from 'path';
import watch from 'node-watch';
import { StateCLI } from './statecli';

export interface WatcherConfig {
    paths: string[];
    ignore?: string[];
    autoCheckpoint?: boolean;
    checkpointInterval?: number; // minutes
}

export class FileWatcher {
    private watcher: any = null;
    private stateCLI: StateCLI;
    private config: WatcherConfig;
    private lastCheckpoint: number = Date.now();
    private fileSnapshots: Map<string, string> = new Map();

    constructor(stateCLI: StateCLI, config: WatcherConfig) {
        this.stateCLI = stateCLI;
        this.config = config;
    }

    start(): void {
        const watchPaths = this.config.paths;
        // Basic ignore list - substrings to ignore
        const ignoredSubstrings = [
            'node_modules',
            '.git',
            'dist',
            'build',
            '.next',
            'coverage',
            '.statecli'
        ];

        // Filter function for node-watch
        // Return true to include/watch, false to ignore
        const filter = (name: string) => {
            for (const ignored of ignoredSubstrings) {
                // Check if path contains the ignored substring
                // Using platform specific separator check might be safer but substring is usually ok for these standard names
                if (name.includes(ignored)) return false;
            }
            // Also ignore changes to specific files like .DS_Store
            if (name.endsWith('.DS_Store')) return false;

            return true;
        };

        console.log(`🔍 StateCLI watching: ${watchPaths.join(', ')}`);

        try {
            this.watcher = watch(watchPaths, {
                recursive: true,
                filter: filter,
                delay: 200 // Wait 200ms for file write to finish/debounce
            });

            this.watcher.on('change', (evt: string, name: string) => {
                // name is the full path
                if (evt === 'update') {
                    // Check if it's a new file or existing
                    if (this.fileSnapshots.has(name)) {
                        console.log(`📝 File changed: ${name}`);
                        this.handleFileChange(name);
                    } else {
                        console.log(`➕ File added: ${name}`);
                        this.handleFileAdd(name);
                    }
                } else if (evt === 'remove') {
                    console.log(`🗑️ File deleted: ${name}`);
                    this.handleFileDelete(name);
                }
            });

            console.log('✅ Watcher ready (using node-watch)');

        } catch (error) {
            console.error('Failed to start watcher:', error);
        }

        // Auto-checkpoint timer
        if (this.config.autoCheckpoint) {
            setInterval(() => this.autoCheckpoint(), (this.config.checkpointInterval || 15) * 60 * 1000);
        }
    }

    stop(): void {
        if (this.watcher) {
            this.watcher.close();
            console.log('🛑 StateCLI watcher stopped');
        }
    }

    private async handleFileChange(filePath: string): Promise<void> {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`📝 Changed: ${relativePath}`);

        try {
            // Read new content
            const content = fs.readFileSync(filePath, 'utf-8');
            const entity = `file:${relativePath}`;

            // Get previous content from snapshots or use empty string
            const previousContent = this.fileSnapshots.get(filePath) || '';

            // Track the file change with proper before/after
            this.stateCLI.trackFile(entity, previousContent, content);

            // Update snapshot
            this.fileSnapshots.set(filePath, content);
        } catch (error) {
            // If file was deleted rapidly or read failed
            console.error(`Error tracking ${filePath}:`, error);
        }
    }

    private async handleFileAdd(filePath: string): Promise<void> {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`➕ Added: ${relativePath}`);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');

            // Initialize snapshot
            this.fileSnapshots.set(filePath, content);

            this.stateCLI.track('file', relativePath, {
                action: 'created',
                timestamp: new Date().toISOString(),
                path: relativePath,
                size: content.length
            }, 'watcher');
        } catch (error) {
            // File might be deleted immediately
            // console.error(`Error tracking ${filePath}:`, error);
        }
    }

    private async handleFileDelete(filePath: string): Promise<void> {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`🗑️ Deleted: ${relativePath}`);

        this.fileSnapshots.delete(filePath);

        this.stateCLI.track('file', relativePath, {
            action: 'deleted',
            timestamp: new Date().toISOString(),
            path: relativePath
        }, 'watcher');
    }

    private async autoCheckpoint(): Promise<void> {
        const now = Date.now();
        const elapsed = (now - this.lastCheckpoint) / 1000 / 60; // minutes

        if (elapsed >= (this.config.checkpointInterval || 15)) {
            console.log(`💾 Auto-checkpoint (${elapsed.toFixed(0)} min elapsed)`);

            const checkpointName = `auto-${new Date().toISOString().replace(/[:.]/g, '-')}`;
            this.stateCLI.checkpoint('project:current', checkpointName);

            this.lastCheckpoint = now;
        }
    }

    getStats(): { filesTracked: number; lastCheckpoint: Date } {
        return {
            filesTracked: this.fileSnapshots.size,
            lastCheckpoint: new Date(this.lastCheckpoint)
        };
    }
}
