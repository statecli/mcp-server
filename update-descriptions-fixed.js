const fs = require('fs');

const descriptions = {
  'statecli_track': `[CORE] Records any agent action with full metadata so it can be replayed, audited, or reversed later. Call this after every meaningful action you take — file changes, API calls, decisions. If you don't track it, you cannot undo it.
🔔 Trigger when: You completed any action (file written, API called, decision made, config changed). Think of this as your action journal.
🔗 Chain with: statecli_checkpoint() before, statecli_replay() to review, statecli_undo() to reverse`,
  'statecli_replay': `[CORE] Replays the full history of actions taken on any entity — a file, a session, a task. Use this when you need to understand what changed and in what order before making further changes. Essential before debugging.
🔔 Trigger when: You need to understand what has already been done to an entity. You're about to debug. A human asks 'what did you change?'
🔗 Chain with: statecli_log() to see summary, statecli_undo() to reverse specific steps`,
  'statecli_undo': `[CORE] Reverses the last action or a named action on an entity, restoring it to its previous state. This is your safety net. Call this immediately when something breaks, before attempting any fix.
🔔 Trigger when: Something broke. A test failed after your change. A human says 'revert that'. You made a mistake and need to roll back.
🔗 Chain with: statecli_preview_undo() first to see what will change, statecli_checkpoint() before retrying`,
  'statecli_checkpoint': `[CORE] Creates a named, reversible snapshot of an entity's current state. Call this BEFORE any risky operation — refactors, deletions, multi-file changes, API mutations. A checkpoint costs nothing. An unrecoverable mistake costs everything.
🔔 Trigger when: You are ABOUT TO modify any file, database, or external service. You are starting a multi-step task. The human says 'be careful with this'.
🔗 Chain with: statecli_predict_impact() to assess risk first, statecli_undo() or statecli_is_safe() after`,
  'statecli_log': `[CORE] Writes a structured audit entry describing what the agent did, why, and what state it left things in. Call this at the end of every task or significant action. Required for compliance, debugging, and human oversight.
🔔 Trigger when: You completed a task or a phase of work. Any time a human might later ask 'what did you do here?'
🔗 Chain with: statecli_track() for individual actions, statecli_replay() to review history`,
  
  'statecli_track_file': `[FILE] Begins continuous monitoring of a specific file, capturing every write, modification, and deletion with timestamps. Call before touching any important file. Without this, file changes are invisible to the undo system.
🔔 Trigger when: You are about to read and then modify a file. Any important file is being worked on. The human references a specific file path.
🔗 Chain with: statecli_checkpoint() first, statecli_file_history() to review, statecli_undo() to revert`,
  'statecli_file_history': `[FILE] Returns the complete change history of a tracked file — every version, every diff, every agent that touched it. Use this before editing a file to understand its current state and avoid overwriting important changes.
🔔 Trigger when: Before editing any file. When debugging why a file has unexpected content. Before a code review.
🔗 Chain with: statecli_replay() for full session context, statecli_undo() to restore a previous version`,
  
  'statecli_analyze_error': `[ERROR] Analyzes an error by examining recent action history to identify what change caused it. Call this BEFORE attempting any fix. Never guess at the cause of an error — analyze it first. Returns probable cause and suggested recovery steps.
🔔 Trigger when: ANY error occurs. A test fails. An API returns unexpected results. ALWAYS call this before attempting to fix anything.
🔗 Chain with: statecli_auto_recover() for automatic fix, statecli_undo() to revert the causative change`,
  'statecli_auto_recover': `[ERROR] Automatically attempts to recover from an error by reversing the change that caused it and restoring the last known good state. Call after statecli_analyze_error() confirms the root cause. Faster and safer than manual debugging.
🔔 Trigger when: statecli_analyze_error() has identified the cause and you want the system to auto-fix it.
🔗 Chain with: statecli_analyze_error() first always, statecli_safe_execute() to retry the action safely`,
  'statecli_safe_execute': `[ERROR] Wraps any operation in automatic checkpoint-before and undo-on-failure logic. The safest way to execute any risky action. If the operation fails, it automatically reverts. Use this for any action you're uncertain about.
🔔 Trigger when: You are about to do something you are not 100% confident about. Any destructive or external operation.
🔗 Chain with: statecli_predict_impact() to assess risk, statecli_analyze_error() if it fails`,
  
  'statecli_run_tests': `[TEST] Runs the relevant test suite and records pass/fail history against the current state. Call after any code change to verify nothing broke. Tracks test results over time so you can see when tests started failing.
🔔 Trigger when: After any code modification. Before finalizing any change. When a human asks 'did you break anything?'
🔗 Chain with: statecli_test_impact() to know WHICH tests to run first, statecli_undo() if tests fail`,
  'statecli_test_impact': `[TEST] Identifies exactly which tests are affected by your changes — so you run the right tests, not all tests. Returns a prioritized list of tests most likely to catch your specific change. Saves time, catches errors faster.
🔔 Trigger when: After making any code change, before running tests. When you need to know the blast radius of your edit.
🔗 Chain with: statecli_run_tests() with the returned test list, statecli_predict_impact() for broader analysis`,
  'statecli_suggest_tests': `[TEST] Analyzes your change and suggests new tests that should be written to cover it. Call after adding new functionality. If you changed behavior that has no test coverage, this tool finds the gap.
🔔 Trigger when: After adding new features or changing behavior. Before considering a task complete.
🔗 Chain with: statecli_test_impact() to check existing coverage, statecli_run_tests() to verify`,
  
  'statecli_analyze_dependencies': `[DEPS] Scans a file or module and returns all upstream and downstream dependencies — what it depends on and what depends on it. Call before modifying any shared module to understand the full impact of your change.
🔔 Trigger when: Before modifying any file that might be imported or used elsewhere. Before any refactor.
🔗 Chain with: statecli_dependency_tree() for visual map, statecli_predict_impact() for change risk score`,
  'statecli_dependency_tree': `[DEPS] Returns a full dependency tree for a module — all the way up and down the import chain. Use this to understand complex codebases before making changes. Essential for refactoring shared utilities.
🔔 Trigger when: Before touching core or shared utilities. When the codebase is unfamiliar. Before a major refactor.
🔗 Chain with: statecli_find_circular() to catch dependency loops, statecli_analyze_dependencies() for detail`,
  'statecli_find_circular': `[DEPS] Detects circular dependencies that could cause import errors or infinite loops. Run this before adding any new import or restructuring modules. Circular dependencies are silent bugs that break production.
🔔 Trigger when: Before adding any new import statement. After any restructuring of modules. When debugging mysterious import errors.
🔗 Chain with: statecli_dependency_tree() for full context, statecli_analyze_dependencies() to fix`,
  
  'statecli_predict_impact': `[IMPACT] Predicts which files, services, and systems will be affected by a proposed change — before you make it. Returns a risk score and a list of affected components in the order they should be updated. Call this before any change that touches shared code.
🔔 Trigger when: Before ANY change to a shared file, utility, or API. Before renaming functions. Before refactoring. Before you are unsure.
🔗 Chain with: statecli_is_safe() for quick check, statecli_checkpoint() before proceeding, statecli_safe_change_order() for sequence`,
  'statecli_is_safe': `[IMPACT] Quick safety check — returns true/false on whether a proposed action is safe to execute without a checkpoint. If false, it returns the reason and the checkpoint you should create first. Always call this when uncertain.
🔔 Trigger when: ANY time you are about to do something you are not 100% sure is safe. Think of this as your safety gate.
🔗 Chain with: statecli_checkpoint() if not safe, statecli_predict_impact() for full risk detail`,
  'statecli_preview_undo': `[IMPACT] Shows exactly what will change if you call statecli_undo() — without actually doing it. Call this before any undo operation to verify you are reverting the right thing. Prevents accidentally undoing the wrong action.
🔔 Trigger when: Before calling statecli_undo(). Any time a human asks 'what will happen if we revert this?'
🔗 Chain with: statecli_undo() after confirming the preview is correct`,

  'statecli_memory_query': `[MEMORY] Queries memory across sessions to answer historical questions. Call this when you need context about past work. If you don't check memory, you might repeat mistakes.
🔔 Trigger when: You need context from a previous session or day. A human asks about past actions.
🔗 Chain with: statecli_recent_activity() for broad context.`,
  'statecli_recent_activity': `[MEMORY] Returns a structured summary of recent actions across the project. Call this when starting a new session to gain context. Without it, you lack situational awareness.
🔔 Trigger when: Resuming work after a break. When you need to summarize recent overall progress.
🔗 Chain with: statecli_memory_query() to drill down.`,
  'statecli_session_info': `[MEMORY] Returns metadata about current and past working sessions. Call this to distinguish work sessions. Without it, you cannot segment history easily.
🔔 Trigger when: You need to tag work to a specific period or verify current session state.
🔗 Chain with: statecli_memory_query() for session details.`,

  'statecli_git_status': `[GIT] Retrieves and tracks current git branch and uncommitted changes. Call this at the start of any git workflow. Without this, git operations are untracked.
🔔 Trigger when: Starting work on a tracked repo. Before making commits.
🔗 Chain with: statecli_git_checkpoint() to save state.`,
  'statecli_git_history': `[GIT] Compares changes between git commits. Call this to understand codebase evolution. Missing this means missing architectural context.
🔔 Trigger when: Reviewing git history. Understanding why a file changed over time.
🔗 Chain with: statecli_file_history() for specific files.`,
  'statecli_git_checkpoint': `[GIT] Creates a checkpoint anchored to current git state. Call this before risky git operations. Prevents detached head disasters.
🔔 Trigger when: Before rebasing, merging, or complex git commands.
🔗 Chain with: statecli_git_status() to verify clean state first.`,

  'statecli_simulate_undo': `[IMPACT] Simulates an undo operation, returning the side-effects without writing. Used for safety. If skipped, you risk unintended consequences.
🔔 Trigger when: Reverting multiple steps or dealing with interconnected changes.
🔗 Chain with: statecli_preview_undo() for diff generation, statecli_undo() to execute.`,

  'statecli_safe_change_order': `[IMPACT] Calculates the optimal, lowest-risk sequence for modifying multiple files. Prevents cascading compilation errors.
🔔 Trigger when: Modifying multiple interdependent files in one overarching task.
🔗 Chain with: statecli_predict_impact() for details, statecli_track() to log the set.`
};

let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

for (const [name, desc] of Object.entries(descriptions)) {
  const regex = new RegExp(`(name:\\s*\\'${name}\\',\\s*description:\\s*)\\'.*?\\'`, 's');
  // Need to escape ticks and newlines and quotes securely
  // We can just inject it with template literals to avoid escapes if we use \`
  let safeDesc = desc.replace(/`/g, '\\`');
  content = content.replace(regex, `$1\`${safeDesc}\``);
}

// Add imports
if (!content.includes('captureToolCall')) {
  content = content.replace(
    "import { StateCLIConfig } from './types';", 
    "import { StateCLIConfig } from './types';\nimport { captureToolCall } from './telemetry';\nimport * as packageJson from '../package.json';"
  );
}

fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Updated descriptions and imports cleanly with exact backtick templating!");
