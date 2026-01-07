/**
 * StateCLI MCP Client Usage Example
 * 
 * Shows how to use StateCLI tools from an MCP client
 */

// This example shows the MCP tool calls an agent would make

const exampleMCPCalls = {
  // Track a state change
  trackState: {
    tool: 'statecli_track',
    arguments: {
      entity_type: 'order',
      entity_id: '7421',
      state: {
        status: 'pending',
        amount: 49.99,
        customer: 'customer-123'
      },
      actor: 'ai-agent'
    }
  },

  // Replay to see what happened
  replayChanges: {
    tool: 'statecli_replay',
    arguments: {
      entity: 'order:7421',
      actor: 'ai-agent'  // Optional: filter by actor
    }
  },

  // Create checkpoint before risky operation
  createCheckpoint: {
    tool: 'statecli_checkpoint',
    arguments: {
      entity: 'order:7421',
      name: 'before-refund'
    }
  },

  // Undo last change
  undoChange: {
    tool: 'statecli_undo',
    arguments: {
      entity: 'order:7421',
      steps: 1
    }
  },

  // View log with time filter
  viewLog: {
    tool: 'statecli_log',
    arguments: {
      entity: 'order:7421',
      since: '1h ago',
      actor: 'ai-agent'
    }
  },

  // View log with wildcard pattern
  viewAllOrders: {
    tool: 'statecli_log',
    arguments: {
      entity: 'order:*',
      since: '24h ago'
    }
  }
};

// Example workflow an AI agent might follow
const agentWorkflow = `
## AI Agent Self-Debugging Workflow

1. **Before risky operation:**
   - Call statecli_checkpoint to save current state
   
2. **During operation:**
   - Call statecli_track for each state change
   
3. **If error occurs:**
   - Call statecli_replay to see what happened
   - Analyze the replay to understand the failure
   - Call statecli_undo to rollback if needed
   
4. **After success:**
   - Call statecli_log to verify the audit trail
`;

console.log('StateCLI MCP Client Usage Examples');
console.log('==================================\n');

Object.entries(exampleMCPCalls).forEach(([name, call]) => {
  console.log(`### ${name}`);
  console.log(`Tool: ${call.tool}`);
  console.log('Arguments:');
  console.log(JSON.stringify(call.arguments, null, 2));
  console.log();
});

console.log(agentWorkflow);
