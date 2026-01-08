import { Command } from 'commander';
import { StateCLI } from '../statecli';

export function createDiffCommand(program: Command): void {
    program
        .command('diff')
        .description('Show what changed recently')
        .option('-t, --time <duration>', 'Show changes in last X time (e.g., 5m, 1h, 2d)', '1h')
        .option('-f, --file <path>', 'Show changes for specific file')
        .option('-l, --limit <number>', 'Limit number of changes', '20')
        .action(async (options) => {
            const stateCLI = new StateCLI();
            
            // Parse time duration
            const duration = parseDuration(options.time);
            const since = new Date(Date.now() - duration);
            
            let entity = 'project:current';
            if (options.file) {
                entity = `file:${options.file}`;
            }

            const history = stateCLI.log(entity, { limit: parseInt(options.limit) });
            
            // Filter by time
            const recentChanges = history.changes.filter((change: any) => {
                const changeTime = new Date(change.timestamp);
                return changeTime >= since;
            });

            if (recentChanges.length === 0) {
                console.log(`No changes in the last ${options.time}`);
                return;
            }

            console.log(`\n📊 Changes in the last ${options.time}:\n`);
            
            recentChanges.forEach((change: any, index: number) => {
                const time = new Date(change.timestamp).toLocaleTimeString();
                const state = change.after || change;
                
                console.log(`${index + 1}. [${time}] ${state.action || 'change'}`);
                
                if (state.path) {
                    console.log(`   📁 ${state.path}`);
                }
                
                if (state.description) {
                    console.log(`   💬 ${state.description}`);
                }
                
                if (state.files && Array.isArray(state.files)) {
                    console.log(`   📝 Files: ${state.files.join(', ')}`);
                }
                
                console.log('');
            });

            console.log(`Total: ${recentChanges.length} changes\n`);
        });
}

function parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    
    if (!match) {
        throw new Error('Invalid duration format. Use: 5m, 1h, 2d');
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers: Record<string, number> = {
        's': 1000,
        'm': 60 * 1000,
        'h': 60 * 60 * 1000,
        'd': 24 * 60 * 60 * 1000
    };

    return value * multipliers[unit];
}
