/**
 * StateCLI Self-Healing Agent Example
 * 
 * Demonstrates how AI agents can use StateCLI to:
 * - Track their actions
 * - Detect failures
 * - Replay to understand what went wrong
 * - Undo and retry with fixes
 */

const { StateCLI } = require('statecli-mcp-server');

class SelfHealingAgent {
  constructor() {
    this.statecli = new StateCLI();
    this.maxRetries = 3;
  }

  async executeTask(taskId, task) {
    const entity = `task:${taskId}`;
    let retries = 0;

    while (retries < this.maxRetries) {
      // Create checkpoint before attempting task
      this.statecli.checkpoint(entity, `attempt-${retries + 1}`);
      
      try {
        // Track that we're starting
        this.statecli.track('task', taskId, {
          status: 'running',
          attempt: retries + 1,
          startedAt: new Date().toISOString()
        }, 'self-healing-agent');

        // Execute the task
        const result = await this.runTask(task);

        // Track success
        this.statecli.track('task', taskId, {
          status: 'completed',
          result: result,
          completedAt: new Date().toISOString()
        }, 'self-healing-agent');

        console.log(`Task ${taskId} completed successfully`);
        return result;

      } catch (error) {
        // Track the failure
        this.statecli.track('task', taskId, {
          status: 'failed',
          error: error.message,
          failedAt: new Date().toISOString()
        }, 'self-healing-agent');

        // Analyze what went wrong
        const analysis = await this.analyzeFailure(entity, error);
        
        if (analysis.canRetry) {
          console.log(`Attempt ${retries + 1} failed: ${error.message}`);
          console.log(`Analysis suggests: ${analysis.fix}`);
          
          // Undo to restore state before failure
          this.statecli.undo(entity, 1);
          
          // Apply fix and retry
          task = this.applyFix(task, analysis.fix);
          retries++;
        } else {
          console.log(`Task ${taskId} failed permanently: ${error.message}`);
          throw error;
        }
      }
    }

    throw new Error(`Task ${taskId} failed after ${this.maxRetries} attempts`);
  }

  async runTask(task) {
    // Simulate task execution
    // In real usage, this would be the actual task logic
    if (Math.random() > 0.7) {
      return { success: true, data: 'Task completed' };
    }
    throw new Error('Random failure for demonstration');
  }

  async analyzeFailure(entity, error) {
    // Replay to understand what happened
    const replay = this.statecli.replay(entity);
    
    console.log('\n--- Failure Analysis ---');
    console.log(`Entity: ${entity}`);
    console.log(`Error: ${error.message}`);
    console.log(`Steps taken: ${replay.changes.length}`);
    
    replay.changes.forEach(change => {
      console.log(`  ${change.step}. ${JSON.stringify(change.after)}`);
    });
    console.log('------------------------\n');

    // In real usage, this would use LLM to analyze
    return {
      canRetry: true,
      fix: 'retry-with-backoff'
    };
  }

  applyFix(task, fix) {
    // Apply the suggested fix
    return { ...task, retryDelay: 1000 };
  }

  close() {
    this.statecli.close();
  }
}

// Demo
async function main() {
  const agent = new SelfHealingAgent();
  
  try {
    await agent.executeTask('demo-123', { action: 'process-data' });
  } catch (error) {
    console.log('Task ultimately failed:', error.message);
  }
  
  agent.close();
}

main().catch(console.error);
