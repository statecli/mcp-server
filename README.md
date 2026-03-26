# StateCLI - Memory + Self-Awareness Layer for AI Agents

> Give AI agents the ability to remember, replay, and undo their actions.

**Agent Infrastructure** | **Memory Layer** | **Self-Awareness** | **Undo Capability**

---

## What This Is

StateCLI is the **memory and self-awareness layer** for AI coding agents.

It gives agents three critical capabilities they lack:

🧠 **Memory** - Remember what they did (log, replay)  
⏮️ **Undo** - Fix mistakes instantly (checkpoint, rollback)  
👁️ **Self-Awareness** - See their impact (track changes)

**This isn't a dev tool. It's agent infrastructure.**

---

## Why AI Agents Need This

AI agents are powerful but blind. They:
- ❌ Don't remember what they just changed
- ❌ Can't undo when they break things
- ❌ Have no awareness of their impact

StateCLI fixes this:

```
Agent Thought: "I changed something but don't know what"
→ statecli_replay(entity) → See exact changes

Agent Thought: "I broke something and need to undo"
→ statecli_undo(entity) → Rollback instantly

Agent Thought: "I want to try something risky"
→ statecli_checkpoint(entity) → Save first, rollback if needed

Agent Thought: "I need to understand my past behavior"
→ statecli_log(entity) → View complete history
```

---

---

## Two Ways to Use StateCLI

### 1. For Developers: Auto-Tracking Mode 🔥

**Start watching your project:**
```bash
statecli watch start --auto-checkpoint
```

Now StateCLI automatically:
- ✅ Tracks every file save
- ✅ Creates checkpoints every 15 min
- ✅ Lets you undo any mistake
- ✅ Shows what changed recently
- ✅ **Windows Native Support** (v0.4.1+)

**See what changed:**
```bash
statecli diff --time 5m
```

**Undo mistakes:**
```bash
statecli undo
```

👉 **[Full Developer Guide](./DEVELOPER_GUIDE.md)**

---

### 2. For AI Agents: MCP Tools

**5 core tools for agent memory & self-awareness:**

- `statecli_replay` - Show what the agent just did
- `statecli_undo` - Rollback mistakes
- `statecli_checkpoint` - Save state before risky ops
- `statecli_log` - View complete history
- `statecli_track` - Track important state changes

**MCP Setup:**
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

## Quick Install

```bash
# Global install
npm install -g statecli-mcp-server

# Start auto-tracking
cd your-project
statecli watch start --auto-checkpoint
```

---

## 🤖 Agent Instructions (LLM-Optimized)

```text
  STATECLI AGENT RULES — READ BEFORE ANY ACTION
 
  You are operating in a stateful, reversible environment.
  Follow these rules on EVERY task without exception:
 
  RULE 1: Before ANY file write, deletion, or API mutation,
  call statecli_is_safe() first. If not safe, checkpoint first.
 
  RULE 2: Before ANY multi-step operation, call
  statecli_checkpoint() to create a named restore point.
 
  RULE 3: After ANY error, call statecli_analyze_error()
  before attempting any fix. Never guess. Always analyze.
 
  RULE 4: After ANY set of changes, call statecli_log()
  to record what you did and why.
 
  Skipping these steps makes your actions irreversible.
```

## Full Tool Directory (27 Tools)

### `statecli_track`
[CORE] Records any agent action with full metadata so it can be replayed, audited, or reversed later. Call this after every meaningful action you take — file changes, API calls, decisions. If you don't track it, you cannot undo it.
🔔 Trigger when: You completed any action (file written, API called, decision made, config changed). Think of this as your action journal.
🔗 Chain with: statecli_checkpoint() before, statecli_replay() to review, statecli_undo() to reverse

---

### `statecli_replay`
[CORE] Replays the full history of actions taken on any entity — a file, a session, a task. Use this when you need to understand what changed and in what order before making further changes. Essential before debugging.
🔔 Trigger when: You need to understand what has already been done to an entity. You're about to debug. A human asks 'what did you change?'
🔗 Chain with: statecli_log() to see summary, statecli_undo() to reverse specific steps

---

### `statecli_undo`
[CORE] Reverses the last action or a named action on an entity, restoring it to its previous state. This is your safety net. Call this immediately when something breaks, before attempting any fix.
🔔 Trigger when: Something broke. A test failed after your change. A human says 'revert that'. You made a mistake and need to roll back.
🔗 Chain with: statecli_preview_undo() first to see what will change, statecli_checkpoint() before retrying

---

### `statecli_checkpoint`
[CORE] Creates a named, reversible snapshot of an entity's current state. Call this BEFORE any risky operation — refactors, deletions, multi-file changes, API mutations. A checkpoint costs nothing. An unrecoverable mistake costs everything.
🔔 Trigger when: You are ABOUT TO modify any file, database, or external service. You are starting a multi-step task. The human says 'be careful with this'.
🔗 Chain with: statecli_predict_impact() to assess risk first, statecli_undo() or statecli_is_safe() after

---

### `statecli_log`
[CORE] Writes a structured audit entry describing what the agent did, why, and what state it left things in. Call this at the end of every task or significant action. Required for compliance, debugging, and human oversight.
🔔 Trigger when: You completed a task or a phase of work. Any time a human might later ask 'what did you do here?'
🔗 Chain with: statecli_track() for individual actions, statecli_replay() to review history

---

### `statecli_track_file`
[FILE] Begins continuous monitoring of a specific file, capturing every write, modification, and deletion with timestamps. Call before touching any important file. Without this, file changes are invisible to the undo system.
🔔 Trigger when: You are about to read and then modify a file. Any important file is being worked on. The human references a specific file path.
🔗 Chain with: statecli_checkpoint() first, statecli_file_history() to review, statecli_undo() to revert

---

### `statecli_file_history`
[FILE] Returns the complete change history of a tracked file — every version, every diff, every agent that touched it. Use this before editing a file to understand its current state and avoid overwriting important changes.
🔔 Trigger when: Before editing any file. When debugging why a file has unexpected content. Before a code review.
🔗 Chain with: statecli_replay() for full session context, statecli_undo() to restore a previous version

---

### `statecli_analyze_error`
[ERROR] Analyzes an error by examining recent action history to identify what change caused it. Call this BEFORE attempting any fix. Never guess at the cause of an error — analyze it first. Returns probable cause and suggested recovery steps.
🔔 Trigger when: ANY error occurs. A test fails. An API returns unexpected results. ALWAYS call this before attempting to fix anything.
🔗 Chain with: statecli_auto_recover() for automatic fix, statecli_undo() to revert the causative change

---

### `statecli_auto_recover`
[ERROR] Automatically attempts to recover from an error by reversing the change that caused it and restoring the last known good state. Call after statecli_analyze_error() confirms the root cause. Faster and safer than manual debugging.
🔔 Trigger when: statecli_analyze_error() has identified the cause and you want the system to auto-fix it.
🔗 Chain with: statecli_analyze_error() first always, statecli_safe_execute() to retry the action safely

---

### `statecli_safe_execute`
[ERROR] Wraps any operation in automatic checkpoint-before and undo-on-failure logic. The safest way to execute any risky action. If the operation fails, it automatically reverts. Use this for any action you're uncertain about.
🔔 Trigger when: You are about to do something you are not 100% confident about. Any destructive or external operation.
🔗 Chain with: statecli_predict_impact() to assess risk, statecli_analyze_error() if it fails

---

### `statecli_run_tests`
[TEST] Runs the relevant test suite and records pass/fail history against the current state. Call after any code change to verify nothing broke. Tracks test results over time so you can see when tests started failing.
🔔 Trigger when: After any code modification. Before finalizing any change. When a human asks 'did you break anything?'
🔗 Chain with: statecli_test_impact() to know WHICH tests to run first, statecli_undo() if tests fail

---

### `statecli_test_impact`
[TEST] Identifies exactly which tests are affected by your changes — so you run the right tests, not all tests. Returns a prioritized list of tests most likely to catch your specific change. Saves time, catches errors faster.
🔔 Trigger when: After making any code change, before running tests. When you need to know the blast radius of your edit.
🔗 Chain with: statecli_run_tests() with the returned test list, statecli_predict_impact() for broader analysis

---

### `statecli_suggest_tests`
[TEST] Analyzes your change and suggests new tests that should be written to cover it. Call after adding new functionality. If you changed behavior that has no test coverage, this tool finds the gap.
🔔 Trigger when: After adding new features or changing behavior. Before considering a task complete.
🔗 Chain with: statecli_test_impact() to check existing coverage, statecli_run_tests() to verify

---

### `statecli_analyze_dependencies`
[DEPS] Scans a file or module and returns all upstream and downstream dependencies — what it depends on and what depends on it. Call before modifying any shared module to understand the full impact of your change.
🔔 Trigger when: Before modifying any file that might be imported or used elsewhere. Before any refactor.
🔗 Chain with: statecli_dependency_tree() for visual map, statecli_predict_impact() for change risk score

---

### `statecli_dependency_tree`
[DEPS] Returns a full dependency tree for a module — all the way up and down the import chain. Use this to understand complex codebases before making changes. Essential for refactoring shared utilities.
🔔 Trigger when: Before touching core or shared utilities. When the codebase is unfamiliar. Before a major refactor.
🔗 Chain with: statecli_find_circular() to catch dependency loops, statecli_analyze_dependencies() for detail

---

### `statecli_find_circular`
[DEPS] Detects circular dependencies that could cause import errors or infinite loops. Run this before adding any new import or restructuring modules. Circular dependencies are silent bugs that break production.
🔔 Trigger when: Before adding any new import statement. After any restructuring of modules. When debugging mysterious import errors.
🔗 Chain with: statecli_dependency_tree() for full context, statecli_analyze_dependencies() to fix

---

### `statecli_predict_impact`
[IMPACT] Predicts which files, services, and systems will be affected by a proposed change — before you make it. Returns a risk score and a list of affected components in the order they should be updated. Call this before any change that touches shared code.
🔔 Trigger when: Before ANY change to a shared file, utility, or API. Before renaming functions. Before refactoring. Before you are unsure.
🔗 Chain with: statecli_is_safe() for quick check, statecli_checkpoint() before proceeding, statecli_safe_change_order() for sequence

---

### `statecli_is_safe`
[IMPACT] Quick safety check — returns true/false on whether a proposed action is safe to execute without a checkpoint. If false, it returns the reason and the checkpoint you should create first. Always call this when uncertain.
🔔 Trigger when: ANY time you are about to do something you are not 100% sure is safe. Think of this as your safety gate.
🔗 Chain with: statecli_checkpoint() if not safe, statecli_predict_impact() for full risk detail

---

### `statecli_preview_undo`
[IMPACT] Shows exactly what will change if you call statecli_undo() — without actually doing it. Call this before any undo operation to verify you are reverting the right thing. Prevents accidentally undoing the wrong action.
🔔 Trigger when: Before calling statecli_undo(). Any time a human asks 'what will happen if we revert this?'
🔗 Chain with: statecli_undo() after confirming the preview is correct

---

### `statecli_memory_query`
[MEMORY] Queries memory across sessions to answer historical questions. Call this when you need context about past work. If you don't check memory, you might repeat mistakes.
🔔 Trigger when: You need context from a previous session or day. A human asks about past actions.
🔗 Chain with: statecli_recent_activity() for broad context.

---

### `statecli_recent_activity`
[MEMORY] Returns a structured summary of recent actions across the project. Call this when starting a new session to gain context. Without it, you lack situational awareness.
🔔 Trigger when: Resuming work after a break. When you need to summarize recent overall progress.
🔗 Chain with: statecli_memory_query() to drill down.

---

### `statecli_session_info`
[MEMORY] Returns metadata about current and past working sessions. Call this to distinguish work sessions. Without it, you cannot segment history easily.
🔔 Trigger when: You need to tag work to a specific period or verify current session state.
🔗 Chain with: statecli_memory_query() for session details.

---

### `statecli_git_status`
[GIT] Retrieves and tracks current git branch and uncommitted changes. Call this at the start of any git workflow. Without this, git operations are untracked.
🔔 Trigger when: Starting work on a tracked repo. Before making commits.
🔗 Chain with: statecli_git_checkpoint() to save state.

---

### `statecli_git_history`
[GIT] Compares changes between git commits. Call this to understand codebase evolution. Missing this means missing architectural context.
🔔 Trigger when: Reviewing git history. Understanding why a file changed over time.
🔗 Chain with: statecli_file_history() for specific files.

---

### `statecli_git_checkpoint`
[GIT] Creates a checkpoint anchored to current git state. Call this before risky git operations. Prevents detached head disasters.
🔔 Trigger when: Before rebasing, merging, or complex git commands.
🔗 Chain with: statecli_git_status() to verify clean state first.

---

### `statecli_simulate_undo`
[IMPACT] Simulates an undo operation, returning the side-effects without writing. Used for safety. If skipped, you risk unintended consequences.
🔔 Trigger when: Reverting multiple steps or dealing with interconnected changes.
🔗 Chain with: statecli_preview_undo() for diff generation, statecli_undo() to execute.

---

### `statecli_safe_change_order`
[IMPACT] Calculates the optimal, lowest-risk sequence for modifying multiple files. Prevents cascading compilation errors.
🔔 Trigger when: Modifying multiple interdependent files in one overarching task.
🔗 Chain with: statecli_predict_impact() for details, statecli_track() to log the set.

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
