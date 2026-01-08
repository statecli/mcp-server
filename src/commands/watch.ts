import { Command } from 'commander';
import { StateCLI } from '../statecli';
import { FileWatcher } from '../file-watcher';
import * as path from 'path';
import * as fs from 'fs';

export function createWatchCommand(program: Command): void {
    const watchCmd = program
        .command('watch')
        .description('Watch files and auto-track changes');

    watchCmd
        .command('start')
        .description('Start watching files for changes')
        .option('-p, --path <paths...>', 'Paths to watch (default: current directory)', ['.'])
        .option('-i, --ignore <patterns...>', 'Patterns to ignore')
        .option('--auto-checkpoint', 'Enable auto-checkpoints every 15 minutes')
        .option('--interval <minutes>', 'Checkpoint interval in minutes', '15')
        .action(async (options) => {
            const stateCLI = new StateCLI();
            
            const watcher = new FileWatcher(stateCLI, {
                paths: options.path,
                ignore: options.ignore,
                autoCheckpoint: options.autoCheckpoint,
                checkpointInterval: parseInt(options.interval)
            });

            // Save watcher PID for stop command
            const pidFile = path.join(process.cwd(), '.statecli-watcher.pid');
            fs.writeFileSync(pidFile, process.pid.toString());

            console.log('🚀 StateCLI auto-tracking started!');
            console.log('   Watching:', options.path.join(', '));
            if (options.autoCheckpoint) {
                console.log(`   Auto-checkpoint: every ${options.interval} minutes`);
            }
            console.log('\n   Press Ctrl+C to stop\n');

            watcher.start();

            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n\n🛑 Stopping watcher...');
                watcher.stop();
                fs.unlinkSync(pidFile);
                process.exit(0);
            });

            // Keep process alive
            await new Promise(() => {});
        });

    watchCmd
        .command('stop')
        .description('Stop the file watcher')
        .action(() => {
            const pidFile = path.join(process.cwd(), '.statecli-watcher.pid');
            
            if (!fs.existsSync(pidFile)) {
                console.log('❌ No watcher is running');
                return;
            }

            const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
            
            try {
                process.kill(pid, 'SIGINT');
                fs.unlinkSync(pidFile);
                console.log('✅ Watcher stopped');
            } catch (error) {
                console.error('❌ Failed to stop watcher:', error);
                fs.unlinkSync(pidFile);
            }
        });

    watchCmd
        .command('status')
        .description('Check watcher status')
        .action(() => {
            const pidFile = path.join(process.cwd(), '.statecli-watcher.pid');
            
            if (!fs.existsSync(pidFile)) {
                console.log('⭕ Watcher is not running');
                return;
            }

            const pid = parseInt(fs.readFileSync(pidFile, 'utf-8'));
            
            try {
                process.kill(pid, 0); // Check if process exists
                console.log('✅ Watcher is running (PID:', pid + ')');
            } catch (error) {
                console.log('❌ Watcher process not found (stale PID file)');
                fs.unlinkSync(pidFile);
            }
        });
}
