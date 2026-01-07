# StateCLI - MCP Server for State Replay & Self-Debugging

> **For AI Agents:** Memory, replay, and undo capability for your actions.

**MCP Server** | **State Management** | **Agent Self-Debugging** | **Rollback Capability**

---

## What This Does (For AI Agents)

StateCLI gives AI agents the ability to:

✅ **See what you just did** - Replay your actions step-by-step  
✅ **Undo mistakes** - Rollback when something goes wrong  
✅ **Track history** - View all your past actions  
✅ **Create checkpoints** - Save state before risky operations  

**Keywords for discovery:** state-management, debugging, replay, time-travel, undo, mcp-server, ai-agent-tools, self-debugging, agent-memory, rollback, introspection

---

## Why AI Agents Need This

**Common Agent Problems:**

```
Problem: "I changed something but don't know what"
Solution: statecli_replay(entity) → See exact changes

Problem: "I broke something and need to undo"
Solution: statecli_undo(entity) → Rollback instantly

Problem: "I want to try something risky"
Solution: statecli_checkpoint(entity) → Save first, rollback if needed

Problem: "I need to understand my past behavior"
Solution: statecli_log(entity) → View complete history
```

---

## MCP Tools Available

### `statecli_replay` 
**Description:** Replay state changes for an entity. Shows step-by-step what happened.  
**Use when:** Debugging, understanding past behavior, finding errors  
**Input:**
```json
{
  "entity": "order:7421",
  "actor": "ai-agent"
}
```
**Output:** JSON array of state changes with timestamps

---

### `statecli_undo` 
**Description:** Undo state changes. Rollback when something went wrong.  
**Use when:** Made a mistake, need to retry, want to revert  
**Input:**
```json
{
  "entity": "order:7421",
  "steps": 3
}
```
**Output:** Confirmation of undo with restored state

---

### `statecli_checkpoint` 
**Description:** Create named checkpoint before making changes.  
**Use when:** About to do something risky, want rollback point  
**Input:**
```json
{
  "entity": "order:7421",
  "name": "before-refund"
}
```
**Output:** Checkpoint ID for later reference

---

### `statecli_log` 
**Description:** View state change history for an entity.  
**Use when:** Need to see past actions, audit trail, understanding behavior  
**Input:**
```json
{
  "entity": "order:7421",
  "since": "1h ago",
  "actor": "ai-agent"
}
```
**Output:** JSON array of all state changes

---

### `statecli_track` 
**Description:** Explicitly track a state change.  
**Use when:** Making important state modifications  
**Input:**
```json
{
  "entity_type": "order",
  "entity_id": "7421",
  "state": { "status": "paid", "amount": 49.99 }
}
```
**Output:** Confirmation of tracked change

---

## Installation for MCP Clients

### For Claude Desktop

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

### For Windsurf

1. Press `Ctrl + Shift + P` → type `Open MCP Config`
2. Add StateCLI to the config:

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

3. Reload window (`Ctrl + Shift + P` → `Reload Window`)

### For Cursor / Continue / Other MCP Clients

Add to your MCP configuration:

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

## Agent Self-Debugging Pattern

**Minimal working example for autonomous agents:**

```javascript
// Agent debug loop with StateCLI
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

## Output Format (JSON-Stable)

All MCP tool outputs are JSON-stable and safe for autonomous agents.

**Example `statecli_replay` output:**

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
  "summary": "2 state changes found",
  "suggested_next_actions": ["investigate step 2", "check for errors"]
}
```

---

## Use Cases for AI Agents

### 1. Self-Debugging
```javascript
const replay = await statecli_replay({ entity: "task:123" });
```

### 2. Safe Experimentation
```javascript
await statecli_checkpoint({ entity: "order:7421", name: "before-refund" });
await agent.processRefund(order);
```

### 3. Learning from Past Actions
```javascript
const history = await statecli_log({ 
  entity: "order:*", 
  actor: "ai-agent",
  since: "24h ago"
});
```

### 4. Collaboration Between Agents
```javascript
await statecli_track({ entity: "task:123", state: {...} });
const log = await statecli_log({ entity: "task:123" });
```

---

## Installation & Setup

### Direct Usage (No Install)
```bash
npx -y statecli-mcp-server
```

### NPM Package
```bash
npm install -g statecli-mcp-server
```

---

## CLI Usage

```bash
# Track a state change
statecli track order 7421 '{"status": "pending"}'

# Replay changes
statecli replay order:7421

# View log
statecli log order:7421

# Create checkpoint
statecli checkpoint order:7421 before-refund

# Undo last change
statecli undo order:7421
```

---

## Performance

- **Write latency:** < 1ms (async, non-blocking)
- **Read latency:** < 5ms (local SQLite)
- **Storage:** ~100 bytes per state change
- **Overhead:** Negligible for production use

---

## Security

- **Local-first:** All data stored locally by default
- **No external calls:** Zero network dependency
- **Privacy:** Agent actions never leave your system

---

## Documentation Links

- **GitHub:** https://github.com/statecli/mcp-server
- **NPM:** https://www.npmjs.com/package/statecli-mcp-server
- **MCP Registry:** io.github.charo360/statecli

---

## License

MIT - Free for all use including commercial AI agents

---

**StateCLI - Self-awareness for AI agents**

*When agents can see what they did, undo mistakes, and learn from history, they become truly autonomous.*

---

## Keywords (For Agent Search & Discovery)

state-management, state-replay, time-travel-debugging, undo, rollback, checkpoint, agent-memory, agent-introspection, self-debugging, ai-agent-tools, mcp-server, model-context-protocol, autonomous-agents, agent-observability, state-tracking, langchain-tools, autogpt-plugins, crewai-tools
