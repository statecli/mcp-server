/**
 * StateCLI LangChain Integration Example
 * 
 * Shows how to integrate StateCLI with LangChain agents
 * to track tool calls and enable replay/undo
 */

const { StateCLI } = require('statecli-mcp-server');

// Initialize StateCLI
const statecli = new StateCLI();

/**
 * Create a callback handler that tracks all tool calls
 */
function createStateCLICallbackHandler(taskId) {
  return {
    handleToolStart: async (tool, input) => {
      statecli.track('langchain-tool', taskId, {
        status: 'started',
        tool: tool.name,
        input: input,
        timestamp: new Date().toISOString()
      }, 'langchain-agent');
    },

    handleToolEnd: async (tool, output) => {
      statecli.track('langchain-tool', taskId, {
        status: 'completed',
        tool: tool.name,
        output: output,
        timestamp: new Date().toISOString()
      }, 'langchain-agent');
    },

    handleToolError: async (tool, error) => {
      statecli.track('langchain-tool', taskId, {
        status: 'error',
        tool: tool.name,
        error: error.message,
        timestamp: new Date().toISOString()
      }, 'langchain-agent');
    },

    handleChainStart: async (chain) => {
      statecli.checkpoint(`langchain-tool:${taskId}`, 'chain-start');
    },

    handleChainEnd: async (outputs) => {
      statecli.track('langchain-tool', taskId, {
        status: 'chain-completed',
        outputs: outputs,
        timestamp: new Date().toISOString()
      }, 'langchain-agent');
    },

    handleChainError: async (error) => {
      // On error, we can replay to see what happened
      const replay = statecli.replay(`langchain-tool:${taskId}`);
      console.log('Chain failed. Replay of actions:');
      replay.changes.forEach(c => {
        console.log(`  ${c.step}. ${c.after.tool || 'chain'}: ${c.after.status}`);
      });
    }
  };
}

/**
 * Example: Creating a self-debugging agent executor
 */
async function createSelfDebuggingExecutor(agent, tools, taskId) {
  const callbacks = createStateCLICallbackHandler(taskId);
  
  // Create checkpoint before running
  statecli.checkpoint(`langchain-tool:${taskId}`, 'before-execution');
  
  // Simulated agent executor (replace with actual LangChain code)
  const executor = {
    async invoke(input) {
      try {
        callbacks.handleChainStart({ name: 'main-chain' });
        
        // Simulate tool calls
        for (const tool of tools) {
          callbacks.handleToolStart(tool, input);
          
          // Simulate tool execution
          const output = { result: `${tool.name} completed` };
          
          callbacks.handleToolEnd(tool, output);
        }
        
        const outputs = { result: 'Agent completed successfully' };
        callbacks.handleChainEnd(outputs);
        
        return outputs;
      } catch (error) {
        callbacks.handleChainError(error);
        throw error;
      }
    }
  };
  
  return executor;
}

// Demo
async function main() {
  const taskId = 'task-' + Date.now();
  
  const tools = [
    { name: 'search' },
    { name: 'calculator' },
    { name: 'web-browser' }
  ];
  
  console.log('Creating self-debugging executor...');
  const executor = await createSelfDebuggingExecutor(null, tools, taskId);
  
  console.log('Running agent...');
  await executor.invoke({ query: 'What is 2 + 2?' });
  
  console.log('\nReplaying agent actions:');
  const replay = statecli.replay(`langchain-tool:${taskId}`);
  replay.changes.forEach(change => {
    console.log(`  Step ${change.step}: ${change.after.tool || 'chain'} - ${change.after.status}`);
  });
  
  statecli.close();
  console.log('\nDone!');
}

main().catch(console.error);
