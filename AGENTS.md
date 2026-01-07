# StateCLI - AI Agent Instructions

> This file helps AI coding agents (like Cascade, Cursor, Claude) understand and use StateCLI.

## What StateCLI Does

StateCLI gives you **memory, replay, and undo** capabilities. Use it when you:

- Need to remember what changes you made
- Want to undo a mistake
- Are about to do something risky
- Need to debug what went wrong
- Want to analyze dependencies before editing

## Quick Start

```javascript
// Before risky changes
statecli_checkpoint({ entity: "file:src/index.ts", name: "before-refactor" })

// Track your edits
statecli_track({ entity_type: "file", entity_id: "src/index.ts", state: { action: "modified" } })

// If something breaks
statecli_replay({ entity: "file:src/index.ts" })  // See what you did
statecli_undo({ entity: "file:src/index.ts" })    // Roll it back
```

## Available Tools (27 total)

### Core Tools (Use These Most)
| Tool | When To Use |
|------|-------------|
| `statecli_track` | After making any state change |
| `statecli_replay` | To see what happened step-by-step |
| `statecli_undo` | To rollback mistakes |
| `statecli_checkpoint` | Before risky operations |
| `statecli_log` | To view history |

### File Tracking
| Tool | When To Use |
|------|-------------|
| `statecli_track_file` | Track file edits with diff |
| `statecli_file_history` | Get file change history |

### Error Recovery
| Tool | When To Use |
|------|-------------|
| `statecli_analyze_error` | When an error occurs |
| `statecli_auto_recover` | Auto-fix from error |
| `statecli_safe_execute` | Checkpoint before risky op |

### Test Awareness
| Tool | When To Use |
|------|-------------|
| `statecli_run_tests` | Run and track tests |
| `statecli_test_impact` | See which tests a file affects |
| `statecli_suggest_tests` | Get test suggestions |

### Dependency Analysis
| Tool | When To Use |
|------|-------------|
| `statecli_analyze_dependencies` | Before modifying core files |
| `statecli_dependency_tree` | Visualize dependencies |
| `statecli_find_circular` | Find circular imports |

### Rollback Preview
| Tool | When To Use |
|------|-------------|
| `statecli_preview_undo` | See undo result before executing |
| `statecli_simulate_undo` | Dry-run an undo |

### Cross-File Impact
| Tool | When To Use |
|------|-------------|
| `statecli_predict_impact` | Before renaming/deleting |
| `statecli_is_safe` | Check if change is safe |
| `statecli_safe_change_order` | Best order for multi-file changes |

## Best Practices

1. **Always checkpoint before refactors**
   ```
   statecli_checkpoint({ entity: "project:myapp", name: "before-big-refactor" })
   ```

2. **Track important state changes**
   ```
   statecli_track({ entity_type: "config", entity_id: "database", state: { host: "new-host" } })
   ```

3. **Check dependencies before editing core files**
   ```
   statecli_analyze_dependencies({ file: "src/utils/helpers.ts" })
   ```

4. **Preview before undoing**
   ```
   statecli_preview_undo({ entity: "file:src/index.ts", steps: 2 })
   ```

5. **Use error recovery when things break**
   ```
   statecli_analyze_error({ error_message: "TypeError: x is undefined", affected_entities: ["file:src/app.ts"] })
   ```

## Installation

Already configured if you see StateCLI tools in your MCP panel. If not:

```json
// Add to mcp_config.json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

## When NOT To Use

- Simple one-line edits (overhead not worth it)
- Read-only operations
- When user explicitly says not to track
