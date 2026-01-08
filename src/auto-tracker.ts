import { StateCLI } from './statecli';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface AutoTrackerConfig {
    trackGitCommits?: boolean;
    trackNpmInstalls?: boolean;
    trackTestRuns?: boolean;
    autoCheckpointBeforeRisky?: boolean;
}

export class AutoTracker {
    private stateCLI: StateCLI;
    private config: AutoTrackerConfig;

    constructor(stateCLI: StateCLI, config: AutoTrackerConfig = {}) {
        this.stateCLI = stateCLI;
        this.config = {
            trackGitCommits: true,
            trackNpmInstalls: true,
            trackTestRuns: true,
            autoCheckpointBeforeRisky: true,
            ...config
        };
    }

    async trackGitCommit(): Promise<void> {
        if (!this.config.trackGitCommits) return;

        try {
            const { stdout: hash } = await execAsync('git rev-parse HEAD');
            const { stdout: message } = await execAsync('git log -1 --pretty=%B');
            const { stdout: files } = await execAsync('git diff-tree --no-commit-id --name-only -r HEAD');

            this.stateCLI.track('git', 'commit', {
                action: 'commit',
                hash: hash.trim(),
                message: message.trim(),
                files: files.trim().split('\n').filter(f => f),
                timestamp: new Date().toISOString()
            }, 'auto-tracker');

            console.log(`✅ Tracked git commit: ${hash.trim().substring(0, 7)}`);
        } catch (error) {
            // Not a git repo or no commits yet
        }
    }

    async trackNpmInstall(packageName?: string): Promise<void> {
        if (!this.config.trackNpmInstalls) return;

        this.stateCLI.track('npm', 'install', {
            action: 'install',
            package: packageName || 'all',
            timestamp: new Date().toISOString()
        }, 'auto-tracker');

        console.log(`✅ Tracked npm install: ${packageName || 'all packages'}`);
    }

    async trackTestRun(testCommand: string, passed: boolean, output?: string): Promise<void> {
        if (!this.config.trackTestRuns) return;

        this.stateCLI.track('tests', 'run', {
            action: 'test',
            command: testCommand,
            passed,
            output: output?.substring(0, 1000), // Limit output size
            timestamp: new Date().toISOString()
        }, 'auto-tracker');

        console.log(`✅ Tracked test run: ${passed ? 'PASSED' : 'FAILED'}`);
    }

    async checkpointBeforeRisky(operation: string): Promise<string> {
        if (!this.config.autoCheckpointBeforeRisky) {
            return '';
        }

        const checkpointName = `before-${operation}-${Date.now()}`;
        this.stateCLI.checkpoint('project:current', checkpointName);
        
        console.log(`💾 Auto-checkpoint before ${operation}: ${checkpointName}`);
        return checkpointName;
    }

    async wrapRiskyOperation<T>(
        operation: string,
        fn: () => Promise<T>
    ): Promise<T> {
        const checkpointName = await this.checkpointBeforeRisky(operation);

        try {
            const result = await fn();
            console.log(`✅ ${operation} completed successfully`);
            return result;
        } catch (error) {
            console.error(`❌ ${operation} failed:`, error);
            
            if (checkpointName) {
                console.log(`💡 You can rollback with: statecli undo --checkpoint ${checkpointName}`);
            }
            
            throw error;
        }
    }
}
