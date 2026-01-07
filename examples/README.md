# StateCLI Examples

Usage examples for StateCLI MCP Server.

## Examples

| Example | Description |
|---------|-------------|
| [basic-usage.js](./basic-usage.js) | Core functionality: track, replay, checkpoint, undo |
| [self-healing-agent.js](./self-healing-agent.js) | Self-debugging agent pattern with retry logic |
| [langchain-integration.js](./langchain-integration.js) | Integration with LangChain agents |
| [mcp-client-usage.js](./mcp-client-usage.js) | MCP tool call examples |

## Running Examples

```bash
# Install StateCLI first
npm install statecli-mcp-server

# Run an example
node basic-usage.js
node self-healing-agent.js
node langchain-integration.js
node mcp-client-usage.js
```

## Use Cases

### 1. Self-Debugging Agent

```javascript
const { StateCLI } = require('statecli-mcp-server');
const cli = new StateCLI();

// Checkpoint before risky operation
cli.checkpoint('task:123', 'before-risky-op');

try {
  await riskyOperation();
} catch (error) {
  // Replay to understand what happened
  const replay = cli.replay('task:123');
  console.log('What happened:', replay.changes);
  
  // Undo to restore state
  cli.undo('task:123');
}
```

### 2. Agent Collaboration

```javascript
// Agent A tracks its work
cli.track('task', '123', { status: 'in-progress', step: 1 }, 'agent-a');

// Agent B can see what Agent A did
const log = cli.log('task:123', { actor: 'agent-a' });
console.log('Agent A did:', log.changes);

// Agent B continues the work
cli.track('task', '123', { status: 'in-progress', step: 2 }, 'agent-b');
```

### 3. Safe Experimentation

```javascript
// Save current state
cli.checkpoint('experiment:456', 'baseline');

// Try something new
cli.track('experiment', '456', { hypothesis: 'A', result: null });

// If it doesn't work, rollback
cli.restoreCheckpoint('experiment:456', 'baseline');
```
