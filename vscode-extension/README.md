# StateCLI VS Code Extension

**One-click setup** for StateCLI MCP Server - gives AI coding agents memory, replay, and undo capabilities.

## Features

- 🚀 **Auto-configures** MCP server on install
- 🔧 **27 tools** for AI agents
- ⏪ **Undo/Replay** capabilities
- 📊 **Dependency tracking**
- 🧪 **Test awareness**

## Installation

1. Install from VS Code Marketplace: `ext install statecli.statecli`
2. Reload VS Code
3. StateCLI is automatically configured!

## Commands

- `StateCLI: Setup MCP Server` - Configure MCP (auto-runs on install)
- `StateCLI: Show Available Tools` - View all 27 tools
- `StateCLI: Create Checkpoint` - Quick checkpoint helper
- `StateCLI: Replay Changes` - Quick replay helper
- `StateCLI: Undo Last Change` - Quick undo helper

## Supported AI Tools

- ✅ Windsurf / Cascade
- ✅ Cursor
- ✅ Continue
- ✅ Claude Desktop

## What AI Agents Can Do

Once installed, AI agents can:

```javascript
// Before risky changes
statecli_checkpoint({ entity: "file:src/index.ts", name: "before-refactor" })

// Track edits
statecli_track_file({ file_path: "src/index.ts", before_content: "...", after_content: "..." })

// If something breaks
statecli_replay({ entity: "file:src/index.ts" })  // See what happened
statecli_undo({ entity: "file:src/index.ts" })    // Roll it back

// Smart analysis
statecli_analyze_dependencies({ file: "src/utils.ts" })  // Before editing core files
statecli_predict_impact({ file: "src/utils.ts", change_type: "modify" })
```

## Links

- [GitHub](https://github.com/statecli/mcp-server)
- [NPM](https://www.npmjs.com/package/statecli-mcp-server)
- [Documentation](https://github.com/statecli/mcp-server#readme)
