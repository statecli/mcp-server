# StateCLI Developer Guide

> **Auto-tracking system for developers** - StateCLI watches your every move and helps at every step.

## 🚀 Quick Start: Auto-Tracking Mode

### 1. Start Watching Your Project

```bash
cd your-project
statecli watch start
```

**What happens:**
- ✅ Every file save is automatically tracked
- ✅ Auto-checkpoint every 15 minutes
- ✅ Live change detection
- ✅ Full undo capability

### 2. Work Normally

Just code as usual. StateCLI is watching:

```bash
# You edit src/index.ts
📝 Changed: src/index.ts

# You create new file
➕ Added: src/utils/helper.ts

# You delete old file
🗑️ Deleted: src/old-file.ts

# Auto-checkpoint every 15 minutes
💾 Auto-checkpoint (15 min elapsed)
```

### 3. See What Changed

```bash
# What changed in last 5 minutes?
statecli diff --time 5m

# What changed in last hour?
statecli diff --time 1h

# What changed to specific file?
statecli diff --file src/index.ts
```

### 4. Undo Mistakes

```bash
# Undo last change
statecli undo

# Undo specific file
statecli undo src/index.ts

# Undo last 3 steps
statecli undo --steps 3

# Preview before undoing
statecli undo --steps 2  # Shows preview, asks for confirmation
```

---

## 💡 Real Developer Workflows

### Workflow 1: Safe Refactoring

```bash
# Start watching
statecli watch start --auto-checkpoint

# Refactor your code
# (StateCLI tracks every change automatically)

# Something broke? See what changed
statecli diff --time 10m

# Undo the breaking change
statecli undo --steps 1
```

### Workflow 2: Experiment Safely

```bash
# Try risky experiment
statecli checkpoint create "before-experiment"

# Make changes...
# (auto-tracked)

# Didn't work? Rollback
statecli undo --checkpoint before-experiment
```

### Workflow 3: Track Dependencies

```bash
# Before npm install
statecli checkpoint create "before-deps"

# Install package
npm install some-package

# Track the install
statecli track npm:install --data '{"package":"some-package"}'

# Something broke? Rollback
statecli undo --checkpoint before-deps
```

---

## 🎯 CLI Commands Reference

### Watch Commands

```bash
# Start watching
statecli watch start

# Start with auto-checkpoints
statecli watch start --auto-checkpoint

# Custom checkpoint interval (30 min)
statecli watch start --auto-checkpoint --interval 30

# Watch specific paths
statecli watch start --path src tests

# Ignore patterns
statecli watch start --ignore "*.test.ts" "*.spec.ts"

# Stop watching
statecli watch stop

# Check status
statecli watch status
```

### Diff Commands

```bash
# Last hour changes
statecli diff --time 1h

# Last 5 minutes
statecli diff --time 5m

# Last 2 days
statecli diff --time 2d

# Specific file
statecli diff --file src/index.ts

# Limit results
statecli diff --time 1h --limit 10
```

### Undo Commands

```bash
# Undo last change (with preview)
statecli undo

# Undo without confirmation
statecli undo --yes

# Undo specific file
statecli undo src/index.ts

# Undo multiple steps
statecli undo --steps 3

# Undo to checkpoint
statecli undo --checkpoint before-refactor
```

### Checkpoint Commands

```bash
# Create checkpoint
statecli checkpoint create "my-checkpoint"

# List checkpoints
statecli checkpoint list

# Restore checkpoint
statecli checkpoint restore "my-checkpoint"
```

---

## 🔥 Advanced: Git Integration

StateCLI can auto-track git operations:

```bash
# Track git commits automatically
statecli watch start --track-git

# Now every commit is tracked
git commit -m "feat: add feature"
✅ Tracked git commit: abc1234
```

---

## 🧠 For AI Agents

AI agents can use StateCLI through MCP tools:

```javascript
// Agent thinks: "This is risky"
statecli_checkpoint({ entity: "file:src/index.ts", name: "before-refactor" })

// Agent makes changes
// (auto-tracked by watcher)

// Agent checks what it did
statecli_replay({ entity: "file:src/index.ts" })

// Something broke? Agent undoes
statecli_undo({ entity: "file:src/index.ts" })
```

---

## 📊 Configuration

Create `.statecli/config.json`:

```json
{
  "watch": {
    "enabled": true,
    "autoCheckpoint": true,
    "checkpointInterval": 15,
    "ignore": [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**"
    ]
  },
  "retention": {
    "days": 30,
    "maxChangesPerEntity": 1000
  }
}
```

---

## 🎯 Why This Changes Everything

### Before StateCLI:
- ❌ "What did I just change?"
- ❌ "I broke something, can't remember what"
- ❌ "Wish I could undo that refactor"
- ❌ "Lost 2 hours of work"

### With StateCLI:
- ✅ Every change tracked automatically
- ✅ Instant replay of what happened
- ✅ One-command undo
- ✅ Auto-checkpoints every 15 min
- ✅ Never lose work again

---

## 🚀 Installation

```bash
# Global install
npm install -g statecli-mcp-server

# Start watching your project
cd your-project
statecli watch start --auto-checkpoint

# That's it! You're protected.
```

---

## 💡 Pro Tips

1. **Always run `statecli watch start`** when starting work
2. **Use `--auto-checkpoint`** for automatic safety nets
3. **Check `statecli diff`** before committing to see what changed
4. **Create manual checkpoints** before risky operations
5. **Use `statecli undo`** fearlessly - it shows preview first

---

## 🎬 Example Session

```bash
$ cd my-project

$ statecli watch start --auto-checkpoint
🔍 StateCLI watching: .
   Auto-checkpoint: every 15 minutes
   Press Ctrl+C to stop

# Work for 30 minutes...
📝 Changed: src/index.ts
📝 Changed: src/utils.ts
➕ Added: src/new-feature.ts
💾 Auto-checkpoint (15 min elapsed)
📝 Changed: src/index.ts
💾 Auto-checkpoint (15 min elapsed)

# Check what changed
$ statecli diff --time 30m

📊 Changes in the last 30m:

1. [10:15:23] modified
   📁 src/index.ts

2. [10:18:45] modified
   📁 src/utils.ts

3. [10:22:10] created
   📁 src/new-feature.ts

4. [10:35:00] modified
   📁 src/index.ts

Total: 4 changes

# Oops, last change broke something
$ statecli undo

🔍 Preview of undo operation:

Entity: project:current
Steps to undo: 1
Changes that will be undone:
  1. modified - 1/8/2026, 10:35:00 AM

Do you want to proceed with undo? (y/N): y

✅ Undo completed!
Rolled back 1 step(s)
📁 Restored: src/index.ts
```

---

**StateCLI: Your safety net for every line of code.** 🛡️
