# StateCLI Tutorial - Get Started in 5 Minutes

## 🚀 Quick Start

### Step 1: Install

**For MCP clients (Windsurf, Cursor, Claude):**
```json
// Add to your mcp_config.json
{
  "mcpServers": {
    "statecli": {
      "command": "npx",
      "args": ["-y", "statecli-mcp-server"]
    }
  }
}
```

**For Python:**
```bash
pip install statecli
```

### Step 2: Basic Usage

```javascript
// 1. Before risky changes - create a checkpoint
statecli_checkpoint({ 
  entity: "file:src/index.ts", 
  name: "before-refactor" 
})

// 2. Make your changes...
// (AI agent edits the file)

// 3. Track what you did
statecli_track({ 
  entity_type: "file", 
  entity_id: "src/index.ts", 
  state: { action: "refactored", lines_changed: 50 } 
})

// 4. If something breaks - see what happened
statecli_replay({ entity: "file:src/index.ts" })

// 5. Undo if needed
statecli_undo({ entity: "file:src/index.ts" })
```

---

## 📖 Real-World Examples

### Example 1: Safe Refactoring

```javascript
// AI is about to refactor a core utility file

// Step 1: Check what depends on this file
statecli_analyze_dependencies({ file: "src/utils/helpers.ts" })
// Output: { directDependents: 15, riskLevel: "high" }

// Step 2: Create checkpoint
statecli_checkpoint({ entity: "file:src/utils/helpers.ts", name: "pre-refactor" })

// Step 3: Make changes...

// Step 4: Run affected tests
statecli_suggest_tests()
// Output: { suggested: ["helpers.test.ts", "api.test.ts"], coverage: "partial" }

statecli_run_tests({ files: ["helpers.test.ts"] })

// Step 5: If tests fail, preview undo first
statecli_preview_undo({ entity: "file:src/utils/helpers.ts", steps: 1 })
// Shows exactly what will be restored

// Step 6: Undo if needed
statecli_undo({ entity: "file:src/utils/helpers.ts" })
```

### Example 2: Error Recovery

```javascript
// An error occurred during editing

// Step 1: Analyze the error
statecli_analyze_error({ 
  error_message: "TypeError: Cannot read property 'map' of undefined",
  affected_entities: ["file:src/components/List.tsx"]
})
// Output: { 
//   suggestions: [{ action: "undo", confidence: "high" }],
//   recentChanges: [...] 
// }

// Step 2: Auto-recover
statecli_auto_recover({ 
  error_message: "TypeError: Cannot read property 'map' of undefined",
  affected_entities: ["file:src/components/List.tsx"]
})
// Automatically undoes the problematic change
```

### Example 3: Multi-File Changes

```javascript
// AI needs to rename a function used across multiple files

// Step 1: Predict impact
statecli_predict_impact({ 
  file: "src/utils/api.ts", 
  change_type: "rename",
  symbol: "fetchData",
  new_name: "fetchUserData"
})
// Output: { 
//   affectedFiles: 8, 
//   breakingChanges: 8,
//   riskScore: 65 
// }

// Step 2: Get safe change order
statecli_safe_change_order({ 
  files: ["src/utils/api.ts", "src/pages/Home.tsx", "src/pages/Profile.tsx"] 
})
// Output: { order: [...], reason: "Change leaf nodes first" }

// Step 3: Checkpoint the project
statecli_checkpoint({ entity: "project:myapp", name: "before-rename" })

// Step 4: Make changes in recommended order...
```

### Example 4: Debugging Session

```javascript
// AI made several changes and something broke

// Step 1: See all recent changes
statecli_log({ entity: "file:*" })
// Shows all file changes

// Step 2: Replay specific file
statecli_replay({ entity: "file:src/app.ts" })
// Output: Step-by-step changes with timestamps

// Step 3: Find the breaking change
statecli_preview_undo({ entity: "file:src/app.ts", steps: 3 })
// Preview rolling back 3 changes

// Step 4: Simulate before executing
statecli_simulate_undo({ entity: "file:src/app.ts", steps: 2 })
// Output: { wouldSucceed: true, sideEffects: [] }

// Step 5: Execute undo
statecli_undo({ entity: "file:src/app.ts", steps: 2 })
```

---

## 🐍 Python / LangChain Usage

```python
from statecli import StateCLI, get_statecli_tools

# Direct usage
cli = StateCLI()

# Track changes
cli.track("file", "src/main.py", {"action": "created"})

# Create checkpoint
cli.checkpoint("project:myapp", "v1.0")

# Replay
result = cli.replay("file:src/main.py")
print(result.summary)

# Undo
cli.undo("file:src/main.py", steps=1)

# LangChain integration
from langchain.agents import initialize_agent

tools = get_statecli_tools()
agent = initialize_agent(tools, llm, agent="zero-shot-react-description")

# Now the agent can use StateCLI tools automatically!
response = agent.run("Create a checkpoint before refactoring the auth module")
```

---

## 🛠️ All 27 Tools Reference

### Core (5)
| Tool | Description |
|------|-------------|
| `statecli_track` | Track a state change |
| `statecli_replay` | See step-by-step history |
| `statecli_undo` | Rollback changes |
| `statecli_checkpoint` | Save state before risky ops |
| `statecli_log` | View change history |

### File Tracking (2)
| Tool | Description |
|------|-------------|
| `statecli_track_file` | Track file edit with diff |
| `statecli_file_history` | Get file change history |

### Error Recovery (3)
| Tool | Description |
|------|-------------|
| `statecli_analyze_error` | Analyze error & suggest fix |
| `statecli_auto_recover` | Auto-rollback on error |
| `statecli_safe_execute` | Checkpoint + execute safely |

### Test Awareness (3)
| Tool | Description |
|------|-------------|
| `statecli_run_tests` | Run & track test results |
| `statecli_test_impact` | Which tests affected by file |
| `statecli_suggest_tests` | Suggest tests to run |

### Dependency Tracking (3)
| Tool | Description |
|------|-------------|
| `statecli_analyze_dependencies` | What depends on a file |
| `statecli_dependency_tree` | Visual dependency tree |
| `statecli_find_circular` | Find circular imports |

### Rollback Preview (2)
| Tool | Description |
|------|-------------|
| `statecli_preview_undo` | See undo result first |
| `statecli_simulate_undo` | Dry-run undo |

### Cross-File Impact (3)
| Tool | Description |
|------|-------------|
| `statecli_predict_impact` | Predict breaking changes |
| `statecli_is_safe` | Check if change is safe |
| `statecli_safe_change_order` | Best order for changes |

### Session Memory (3)
| Tool | Description |
|------|-------------|
| `statecli_memory_query` | Query past actions |
| `statecli_recent_activity` | Get recent activity |
| `statecli_session_info` | Session information |

### Git Integration (3)
| Tool | Description |
|------|-------------|
| `statecli_git_status` | Current git state |
| `statecli_git_history` | Compare commits |
| `statecli_git_checkpoint` | Checkpoint at commit |

---

## 💡 Best Practices

1. **Always checkpoint before major changes**
2. **Use `analyze_dependencies` before editing core files**
3. **Preview undo before executing**
4. **Run suggested tests after changes**
5. **Use `safe_change_order` for multi-file edits**

---

## 🔗 Links

- [GitHub](https://github.com/statecli/mcp-server)
- [NPM](https://www.npmjs.com/package/statecli-mcp-server)
- [PyPI](https://pypi.org/project/statecli/)
- [MCP Registry](https://github.com/modelcontextprotocol/servers)
