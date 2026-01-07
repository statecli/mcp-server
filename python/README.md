# StateCLI - Python Client

State Replay & Self-Debugging for AI Agents.

## Installation

```bash
pip install statecli
```

## Quick Start

```python
from statecli import StateCLI

# Initialize
cli = StateCLI()

# Track state changes
cli.track("order", "7421", {"status": "pending"}, actor="ai-agent")
cli.track("order", "7421", {"status": "processing"}, actor="ai-agent")

# Replay to see what happened
replay = cli.replay("order:7421")
print(f"Found {len(replay.changes)} changes")
for change in replay.changes:
    print(f"  Step {change.step}: {change.before} -> {change.after}")

# Create checkpoint before risky operation
cli.checkpoint("order:7421", "before-refund")

# Make risky change
cli.track("order", "7421", {"status": "refunded", "amount": 0})

# Undo if something went wrong
result = cli.undo("order:7421", steps=1)
print(f"Undid {result.steps_undone} step(s)")

# View history
log = cli.log("order:7421")
for change in log.changes:
    print(f"{change.timestamp}: {change.actor} -> {change.after}")
```

## Self-Debugging Pattern

```python
from statecli import StateCLI

class SelfHealingAgent:
    def __init__(self):
        self.cli = StateCLI()
    
    async def execute(self, task):
        entity = f"task:{task.id}"
        
        # Checkpoint before risky operation
        self.cli.checkpoint(entity, "before-execution")
        
        try:
            await self.run_task(task)
        except Exception as e:
            # Replay to see what happened
            replay = self.cli.replay(entity)
            print(f"Task failed. Replay: {replay.changes}")
            
            # Undo and retry
            self.cli.undo(entity)
            await self.retry_with_fix(task, replay)
```

## API Reference

### `StateCLI(db_path=None)`
Initialize client. Uses `~/.statecli/state.db` by default.

### `track(entity_type, entity_id, state, actor="ai-agent")`
Track a state change.

### `replay(entity, actor=None)`
Replay state changes for an entity.

### `undo(entity, steps=1)`
Undo the last N state changes.

### `checkpoint(entity, name)`
Create a named checkpoint.

### `log(entity, since=None, actor=None)`
View state change history.

### `restore_checkpoint(entity, name)`
Restore to a named checkpoint.

## Links

- **GitHub:** https://github.com/statecli/mcp-server
- **NPM (Node.js):** https://www.npmjs.com/package/statecli-mcp-server
- **MCP Registry:** io.github.charo360/statecli

## License

MIT
