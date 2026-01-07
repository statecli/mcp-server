/**
 * StateCLI Basic Usage Example
 * 
 * Demonstrates core functionality: track, replay, checkpoint, undo
 */

const { StateCLI } = require('statecli-mcp-server');

async function main() {
  const cli = new StateCLI();

  // 1. Track state changes
  console.log('=== Tracking State Changes ===');
  
  cli.track('order', '7421', { status: 'pending', amount: 49.99 }, 'ai-agent');
  console.log('Tracked: order:7421 -> pending');
  
  cli.track('order', '7421', { status: 'processing', amount: 49.99 }, 'ai-agent');
  console.log('Tracked: order:7421 -> processing');
  
  cli.track('order', '7421', { status: 'paid', amount: 49.99 }, 'ai-agent');
  console.log('Tracked: order:7421 -> paid');

  // 2. Replay to see what happened
  console.log('\n=== Replaying State Changes ===');
  
  const replay = cli.replay('order:7421');
  console.log(`Found ${replay.changes.length} changes:`);
  
  replay.changes.forEach(change => {
    console.log(`  Step ${change.step}: ${JSON.stringify(change.before)} -> ${JSON.stringify(change.after)}`);
  });

  // 3. Create a checkpoint before risky operation
  console.log('\n=== Creating Checkpoint ===');
  
  const checkpoint = cli.checkpoint('order:7421', 'before-refund');
  console.log(`Checkpoint created: ${checkpoint.name} at ${checkpoint.timestamp}`);

  // 4. Make a risky change
  cli.track('order', '7421', { status: 'refunded', amount: 0 }, 'ai-agent');
  console.log('Made risky change: order:7421 -> refunded');

  // 5. Undo the risky change
  console.log('\n=== Undoing Last Change ===');
  
  const undo = cli.undo('order:7421', 1);
  console.log(`Undid ${undo.stepsUndone} step(s)`);
  console.log(`Restored state: ${JSON.stringify(undo.restoredState)}`);

  // 6. View log with filters
  console.log('\n=== Viewing Log ===');
  
  const log = cli.log('order:7421', { actor: 'ai-agent' });
  console.log(`Log has ${log.changes.length} entries`);

  // 7. Get current state
  console.log('\n=== Current State ===');
  
  const currentState = cli.getCurrentState('order:7421');
  console.log(`Current state: ${JSON.stringify(currentState)}`);

  // Cleanup
  cli.close();
  console.log('\nDone!');
}

main().catch(console.error);
