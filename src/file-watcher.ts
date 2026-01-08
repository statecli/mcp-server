import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { StateCLI } from './statecli';

export interface WatcherConfig {
    paths: string[];
    ignore?: string[];
    autoCheckpoint?: boolean;
    checkpointInterval?: number; // minutes
}

export class FileWatcher {
    private watcher: chokidar.FSWatcher | null = null;
    private stateCLI: StateCLI;
    private config: WatcherConfig;
    private lastCheckpoint: number = Date.now();

    constructor(stateCLI: StateCLI, config: WatcherConfig) {
        this.stateCLI = stateCLI;
        this.config = config;
    }

    start(): void {
        const watchPaths = this.config.paths;
        const ignore = this.config.ignore || [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**',
            '**/.next/**',
            '**/coverage/**'
        ];

        console.log(`🔍 StateCLI watching: ${watchPaths.join(', ')}`);

        this.watcher = chokidar.watch(watchPaths, {
            ignored: ignore,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100
            }
        });

        this.watcher
            .on('change', (filePath) => this.handleFileChange(filePath))
            .on('add', (filePath) => this.handleFileAdd(filePath))
            .on('unlink', (filePath) => this.handleFileDelete(filePath))
            .on('error', (error) => console.error(`Watcher error: ${error}`));

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
            const content = fs.readFileSync(filePath, 'utf-8');
            const entity = `file:${relativePath}`;

            // Track the file change
            this.stateCLI.trackFile(entity, content, content);
        } catch (error) {
            console.error(`Error tracking ${filePath}:`, error);
        }
    }

    private async handleFileAdd(filePath: string): Promise<void> {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`➕ Added: ${relativePath}`);

        try {
            const content = fs.readFileSync(filePath, 'utf-8');

            this.stateCLI.track('file', relativePath, {
                action: 'created',
                timestamp: new Date().toISOString(),
                path: relativePath,
                size: content.length
            }, 'watcher');
        } catch (error) {
            console.error(`Error tracking ${filePath}:`, error);
        }
    }

    private async handleFileDelete(filePath: string): Promise<void> {
        const relativePath = path.relative(process.cwd(), filePath);
        console.log(`🗑️ Deleted: ${relativePath}`);

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
            filesTracked: 0, // TODO: implement
            lastCheckpoint: new Date(this.lastCheckpoint)
        };
    }
}
