# StateCLI - MCP Server for State Replay & Self-Debugging

> **For AI Agents:** Memory, replay, and undo capability for your actions.

[![npm version](https://img.shields.io/npm/v/statecli-mcp-server.svg)](https://www.npmjs.com/package/statecli-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MCP Server** | **State Management** | **Agent Self-Debugging** | **Rollback Capability**

---

## Installation

```bash
npx statecli-mcp-server
```

## MCP Client Configuration

```json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

---

## Available Tools

| Tool | Description | Use When |
|------|-------------|----------|
| `statecli_replay` | See what you just did | Debugging, understanding past behavior |
| `statecli_undo` | Rollback mistakes | Made an error, need to retry |
| `statecli_checkpoint` | Save state before risky ops | About to do something risky |
| `statecli_log` | View action history | Need audit trail |
| `statecli_track` | Track state changes | Making important modifications |

---

## Quick Example

```javascript
// Checkpoint before risky operation
await statecli_checkpoint({ entity: "order:123", name: "before-refund" });

try {
  await processOrder(order);
} catch (error) {
  // Replay to see what went wrong
  const replay = await statecli_replay({ entity: "order:123" });
  
  // Undo if needed
  await statecli_undo({ entity: "order:123" });
}
```

---

## Why AI Agents Need This

| Problem | Solution |
|---------|----------|
| "I changed something but don't know what" | `statecli_replay(entity)` |
| "I broke something and need to undo" | `statecli_undo(entity)` |
| "I want to try something risky" | `statecli_checkpoint(entity)` |
| "I need to understand my past behavior" | `statecli_log(entity)` |

---

## Tool Reference

### `statecli_replay`

Replay state changes for an entity. Shows step-by-step what happened.

```json
{
  "entity": "order:7421",
  "actor": "ai-agent"
}
```

### `statecli_undo`

Undo state changes. Rollback when something went wrong.

```json
{
  "entity": "order:7421",
  "steps": 3
}
```

### `statecli_checkpoint`

Create named checkpoint before making changes.

```json
{
  "entity": "order:7421",
  "name": "before-refund"
}
```

### `statecli_log`

View state change history for an entity.

```json
{
  "entity": "order:7421",
  "since": "1h ago",
  "actor": "ai-agent"
}
```

### `statecli_track`

Explicitly track a state change.

```json
{
  "entity_type": "order",
  "entity_id": "7421",
  "state": { "status": "paid", "amount": 49.99 }
}
```

---

## Agent Self-Debugging Pattern

```javascript
try {
  await agent.run(task);
} catch (error) {
  // Get replay of what just happened
  const replay = await mcp.call("statecli_replay", {
    entity: `task:${task.id}`,
    actor: "ai-agent"
  });
  
  // Analyze what went wrong
  const analysis = await llm.analyze({
    replay: replay.result,
    error: error.message,
    prompt: "What went wrong in this sequence?"
  });
  
  // Undo if fixable
  if (analysis.canRetry) {
    await mcp.call("statecli_undo", {
      entity: `task:${task.id}`,
      steps: 1
    });
    
    // Retry with fix
    await agent.runWithFix(task, analysis.fix);
  }
}
```

---

## MCP Configuration Examples

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

### Windsurf

Add to MCP settings:

```json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

---

## CLI Usage

```bash
# Initialize configuration
statecli init

# Track a state change
statecli track order 7421 -d '{"status": "pending"}'

# Replay changes
statecli replay order:7421

# View log
statecli log order:7421 --since "1h ago"

# Create checkpoint
statecli checkpoint order:7421 before-payment

# Undo last change
statecli undo order:7421

# Get current state
statecli state order:7421

# List all entities
statecli list

# Start MCP server
statecli serve
```

---

## Programmatic Usage

```typescript
import { StateCLI } from 'statecli-mcp-server';

const cli = new StateCLI();

// Track state
cli.track('order', '7421', { status: 'pending' }, 'ai-agent');

// Replay
const replay = cli.replay('order:7421');

// Checkpoint
cli.checkpoint('order:7421', 'before-payment');

// Undo
cli.undo('order:7421', 1);

// Log with wildcards
const log = cli.log('order:*', { since: '1h ago' });
```

---

## Integration Examples

### LangChain

```javascript
import { AgentExecutor } from "langchain/agents";

const executor = AgentExecutor.fromAgentAndTools({
  agent,
  tools: [...tools, statecliMCPTools],
  callbacks: [{
    handleToolEnd: async (tool, output) => {
      await statecli_track({
        entity_type: "agent-task",
        entity_id: taskId,
        state: { tool, output }
      });
    }
  }]
});
```

### AutoGPT

```python
from statecli import StateCLI

class SelfDebuggingAgent:
    def __init__(self):
        self.statecli = StateCLI()
    
    async def execute(self, task):
        checkpoint = await self.statecli.checkpoint(f"task:{task.id}")
        try:
            await self.run_task(task)
        except Exception as e:
            replay = await self.statecli.replay(f"task:{task.id}")
            await self.statecli.undo(f"task:{task.id}")
            await self.retry_with_context(task, replay)
```

### CrewAI

```python
from crewai import Agent, Task
from statecli import statecli_mcp_tool

agent = Agent(
    role="Developer",
    tools=[statecli_mcp_tool],
    allow_delegation=True
)
```

---

## Output Format

All outputs are JSON-stable:

```json
{
  "entity": "order:7421",
  "changes": [
    {
      "timestamp": "2025-01-07T10:23:45Z",
      "step": 1,
      "before": { "status": null },
      "after": { "status": "pending" },
      "actor": "ai-agent"
    }
  ],
  "summary": "1 state change found",
  "suggested_next_actions": ["investigate latest change"]
}
```

---

## Performance

- **Write latency:** < 1ms (async, non-blocking)
- **Read latency:** < 5ms (local SQLite)
- **Storage:** ~100 bytes per state change
- **Overhead:** Negligible for production use

---

## Configuration

Create `.statecli/config.json`:

```json
{
  "storage": {
    "type": "local",
    "path": ".statecli/state.db"
  },
  "autoTrack": {
    "enabled": true,
    "patterns": ["order:*", "user:*", "task:*"]
  },
  "retention": {
    "days": 30,
    "maxChangesPerEntity": 1000
  }
}
```

---

## Development

```bash
npm install
npm run build
npm test
```

---

## Links

- **GitHub:** https://github.com/statecli/mcp-server
- **NPM:** https://www.npmjs.com/package/statecli-mcp-server
- **Examples:** https://github.com/statecli/examples
- **Issues:** https://github.com/statecli/mcp-server/issues

---

## License

MIT - Free for all use including commercial AI agents

---

## Keywords

state-management, mcp-server, ai-agent-tools, debugging, replay, undo, rollback, agent-memory, self-debugging, autonomous-agents, model-context-protocol, time-travel-debugging, checkpoint, agent-introspection, state-tracking, langchain-tools, autogpt-plugins, crewai-tools
