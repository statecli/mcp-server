import { Command } from 'commander';
import { StateCLI } from '../statecli';
import * as readline from 'readline';

export function createQuickUndoCommand(program: Command): void {
    program
        .command('undo')
        .description('Quick undo last change')
        .argument('[file]', 'File to undo (optional, defaults to last change)')
        .option('-t, --time <duration>', 'Undo to X time ago (e.g., 5m, 1h)')
        .option('-c, --checkpoint <name>', 'Undo to specific checkpoint')
        .option('-s, --steps <number>', 'Number of steps to undo', '1')
        .option('-y, --yes', 'Skip confirmation')
        .action(async (file, options) => {
            const stateCLI = new StateCLI();
            
            let entity = 'project:current';
            if (file) {
                entity = `file:${file}`;
            }

            // Preview what will be undone
            const preview = stateCLI.previewUndo(entity, parseInt(options.steps));
            
            console.log('\n🔍 Preview of undo operation:\n');
            console.log(`Entity: ${preview.entity}`);
            console.log(`Steps to undo: ${preview.stepsToUndo}`);
            console.log(`Current state: ${preview.currentStateIndex}`);
            console.log(`Target state: ${preview.targetStateIndex}\n`);

            if (preview.affectedChanges.length > 0) {
                console.log('Changes that will be undone:');
                preview.affectedChanges.forEach((change: any, index: number) => {
                    const state = change.state as any;
                    console.log(`  ${index + 1}. ${state.action || 'change'} - ${new Date(change.timestamp).toLocaleString()}`);
                });
                console.log('');
            }

            // Confirm
            if (!options.yes) {
                const confirmed = await confirm('Do you want to proceed with undo?');
                if (!confirmed) {
                    console.log('❌ Undo cancelled');
                    return;
                }
            }

            // Perform undo
            const result = stateCLI.undo(entity, parseInt(options.steps));
            
            console.log('\n✅ Undo completed!');
            console.log(`Rolled back ${result.stepsUndone} step(s)`);
            console.log(result.summary);

            if (result.restoredState) {
                const state = result.restoredState as any;
                if (state.path) {
                    console.log(`📁 Restored: ${state.path}`);
                }
            }
        });
}

async function confirm(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(`${question} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}
