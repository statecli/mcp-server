import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { HistoryViewProvider, CheckpointsViewProvider, ActionsViewProvider } from './views';
import { FileTracker } from './file-tracker';

const MCP_CONFIG = {
    mcpServers: {
        statecli: {
            command: "npx",
            args: ["-y", "statecli-mcp-server"]
        }
    }
};

const TOOLS_INFO = `
# StateCLI Tools (27 total)

## Core Tools
- **statecli_track** - Track state changes
- **statecli_replay** - See what happened step-by-step
- **statecli_undo** - Rollback mistakes
- **statecli_checkpoint** - Save state before risky operations
- **statecli_log** - View history

## File Tracking
- **statecli_track_file** - Track file edits with diff
- **statecli_file_history** - Get file change history

## Error Recovery
- **statecli_analyze_error** - Analyze errors
- **statecli_auto_recover** - Auto-fix from error
- **statecli_safe_execute** - Checkpoint before risky op

## Test Awareness
- **statecli_run_tests** - Run and track tests
- **statecli_test_impact** - See which tests a file affects
- **statecli_suggest_tests** - Get test suggestions

## Dependency Analysis
- **statecli_analyze_dependencies** - Analyze dependencies
- **statecli_dependency_tree** - Visualize dependencies
- **statecli_find_circular** - Find circular imports

## Rollback Preview
- **statecli_preview_undo** - Preview undo before executing
- **statecli_simulate_undo** - Dry-run an undo

## Cross-File Impact
- **statecli_predict_impact** - Predict ripple effects
- **statecli_is_safe** - Check if change is safe
- **statecli_safe_change_order** - Best order for changes
`;

export function activate(context: vscode.ExtensionContext) {
    console.log('StateCLI extension activated');

    // Create file tracker
    const fileTracker = new FileTracker();
    context.subscriptions.push({ dispose: () => fileTracker.dispose() });

    // Register tree view providers
    const historyProvider = new HistoryViewProvider();
    const checkpointsProvider = new CheckpointsViewProvider();
    const actionsProvider = new ActionsViewProvider();

    // Connect file tracker to providers
    historyProvider.setFileTracker(fileTracker);
    checkpointsProvider.setFileTracker(fileTracker);
    actionsProvider.setFileTracker(fileTracker);

    // Auto-refresh views when changes happen
    fileTracker.setOnChangeCallback(() => {
        historyProvider.refresh();
        checkpointsProvider.refresh();
    });

    vscode.window.registerTreeDataProvider('statecli.historyView', historyProvider);
    vscode.window.registerTreeDataProvider('statecli.checkpointsView', checkpointsProvider);
    vscode.window.registerTreeDataProvider('statecli.actionsView', actionsProvider);

    // Listen for file saves
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(doc => {
            fileTracker.onDocumentSave(doc);
        })
    );

    // Listen for file opens
    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(doc => {
            fileTracker.onDocumentOpen(doc);
        })
    );

    // Auto-setup MCP if enabled
    const config = vscode.workspace.getConfiguration('statecli');
    if (config.get('autoSetup')) {
        setupMCPConfig(false);
    }

    // Auto-start tracking if enabled
    if (config.get('autoTrack')) {
        fileTracker.startTracking();
    }

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('statecli.setup', () => setupMCPConfig(true)),
        vscode.commands.registerCommand('statecli.showTools', showTools),
        vscode.commands.registerCommand('statecli.checkpoint', () => {
            createCheckpointWithTracker(fileTracker, checkpointsProvider);
        }),
        vscode.commands.registerCommand('statecli.replay', replayChanges),
        vscode.commands.registerCommand('statecli.undo', () => {
            fileTracker.undoLastChange();
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('statecli.trackCurrentFile', () => {
            if (!fileTracker.isActive()) {
                fileTracker.startTracking();
            }
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('statecli.viewHistory', () => {
            historyProvider.refresh();
        }),
        vscode.commands.registerCommand('statecli.toggleTracking', () => {
            fileTracker.toggleTracking();
            actionsProvider.refresh();
        }),
        vscode.commands.registerCommand('statecli.refresh', () => {
            historyProvider.refresh();
            checkpointsProvider.refresh();
            actionsProvider.refresh();
        })
    );

    // Show welcome message on first install
    const hasShownWelcome = context.globalState.get('hasShownWelcome');
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('hasShownWelcome', true);
    }
}

async function createCheckpointWithTracker(fileTracker: FileTracker, checkpointsProvider: CheckpointsViewProvider) {
    const name = await vscode.window.showInputBox({
        prompt: 'Checkpoint name',
        placeHolder: 'e.g., before-refactor'
    });
    
    if (name) {
        fileTracker.createCheckpoint(name);
        checkpointsProvider.refresh();
    }
}

function getMCPConfigPath(): string {
    const config = vscode.workspace.getConfiguration('statecli');
    const customPath = config.get<string>('mcpConfigPath');
    
    if (customPath) {
        return customPath;
    }

    // Default paths for different tools
    const homeDir = os.homedir();
    
    // Check for Windsurf/Codeium
    const codeiumPath = path.join(homeDir, '.codeium', 'mcp_config.json');
    if (fs.existsSync(path.dirname(codeiumPath))) {
        return codeiumPath;
    }

    // Check for Claude Desktop
    const claudePath = process.platform === 'darwin'
        ? path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
        : path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
    if (fs.existsSync(path.dirname(claudePath))) {
        return claudePath;
    }

    // Default to Codeium
    return codeiumPath;
}

async function setupMCPConfig(showMessage: boolean) {
    const configPath = getMCPConfigPath();
    
    try {
        let existingConfig: any = {};
        
        // Read existing config if it exists
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            existingConfig = JSON.parse(content);
        } else {
            // Create directory if needed
            const dir = path.dirname(configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        // Check if already configured
        if (existingConfig.mcpServers?.statecli) {
            if (showMessage) {
                vscode.window.showInformationMessage('StateCLI is already configured!');
            }
            return;
        }

        // Merge config
        existingConfig.mcpServers = existingConfig.mcpServers || {};
        existingConfig.mcpServers.statecli = MCP_CONFIG.mcpServers.statecli;

        // Write config
        fs.writeFileSync(configPath, JSON.stringify(existingConfig, null, 2));

        if (showMessage) {
            const action = await vscode.window.showInformationMessage(
                'StateCLI MCP server configured! Reload window to activate.',
                'Reload Window'
            );
            if (action === 'Reload Window') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to configure StateCLI: ${error}`);
    }
}

function showTools() {
    const panel = vscode.window.createWebviewPanel(
        'statecliTools',
        'StateCLI Tools',
        vscode.ViewColumn.One,
        {}
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                h1 { color: var(--vscode-editor-foreground); }
                h2 { color: var(--vscode-textLink-foreground); margin-top: 20px; }
                ul { list-style-type: none; padding: 0; }
                li { margin: 8px 0; }
                strong { color: var(--vscode-textPreformat-foreground); }
            </style>
        </head>
        <body>
            <h1>🔧 StateCLI Tools (27 total)</h1>
            
            <h2>Core Tools</h2>
            <ul>
                <li><strong>statecli_track</strong> - Track state changes</li>
                <li><strong>statecli_replay</strong> - See what happened step-by-step</li>
                <li><strong>statecli_undo</strong> - Rollback mistakes</li>
                <li><strong>statecli_checkpoint</strong> - Save state before risky operations</li>
                <li><strong>statecli_log</strong> - View history</li>
            </ul>

            <h2>File Tracking</h2>
            <ul>
                <li><strong>statecli_track_file</strong> - Track file edits with diff</li>
                <li><strong>statecli_file_history</strong> - Get file change history</li>
            </ul>

            <h2>Error Recovery</h2>
            <ul>
                <li><strong>statecli_analyze_error</strong> - Analyze errors</li>
                <li><strong>statecli_auto_recover</strong> - Auto-fix from error</li>
                <li><strong>statecli_safe_execute</strong> - Checkpoint before risky op</li>
            </ul>

            <h2>Test Awareness</h2>
            <ul>
                <li><strong>statecli_run_tests</strong> - Run and track tests</li>
                <li><strong>statecli_test_impact</strong> - See which tests a file affects</li>
                <li><strong>statecli_suggest_tests</strong> - Get test suggestions</li>
            </ul>

            <h2>Dependency Analysis</h2>
            <ul>
                <li><strong>statecli_analyze_dependencies</strong> - Analyze dependencies</li>
                <li><strong>statecli_dependency_tree</strong> - Visualize dependencies</li>
                <li><strong>statecli_find_circular</strong> - Find circular imports</li>
            </ul>

            <h2>Rollback Preview</h2>
            <ul>
                <li><strong>statecli_preview_undo</strong> - Preview undo before executing</li>
                <li><strong>statecli_simulate_undo</strong> - Dry-run an undo</li>
            </ul>

            <h2>Cross-File Impact</h2>
            <ul>
                <li><strong>statecli_predict_impact</strong> - Predict ripple effects</li>
                <li><strong>statecli_is_safe</strong> - Check if change is safe</li>
                <li><strong>statecli_safe_change_order</strong> - Best order for changes</li>
            </ul>
        </body>
        </html>
    `;
}

async function createCheckpoint(checkpointsProvider: CheckpointsViewProvider) {
    const name = await vscode.window.showInputBox({
        prompt: 'Checkpoint name',
        placeHolder: 'e.g., before-refactor'
    });
    
    if (name) {
        vscode.window.showInformationMessage(`Creating checkpoint "${name}"...`);
        checkpointsProvider.refresh();
    }
}

async function replayChanges() {
    const entity = await vscode.window.showInputBox({
        prompt: 'Entity to replay',
        placeHolder: 'e.g., file:src/index.ts'
    });
    
    if (entity) {
        vscode.window.showInformationMessage(
            `To replay, use: statecli_replay({ entity: "${entity}" })`
        );
    }
}

async function undoLastChange(historyProvider: HistoryViewProvider) {
    const entity = await vscode.window.showInputBox({
        prompt: 'Entity to undo',
        placeHolder: 'e.g., file:src/index.ts'
    });
    
    if (entity) {
        vscode.window.showInformationMessage(`Undoing changes to ${entity}...`);
        historyProvider.refresh();
    }
}

async function trackCurrentFile(historyProvider: HistoryViewProvider) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage('No file is currently open');
        return;
    }
    
    const filePath = editor.document.fileName;
    vscode.window.showInformationMessage(`Tracking changes to ${path.basename(filePath)}...`);
    historyProvider.refresh();
}

async function viewHistory(historyProvider: HistoryViewProvider) {
    historyProvider.refresh();
    vscode.commands.executeCommand('statecli.historyView.focus');
}

function showWelcomeMessage() {
    vscode.window.showInformationMessage(
        'StateCLI installed! AI agents now have memory, replay, and undo capabilities.',
        'Show Tools',
        'Setup MCP'
    ).then(selection => {
        if (selection === 'Show Tools') {
            showTools();
        } else if (selection === 'Setup MCP') {
            setupMCPConfig(true);
        }
    });
}

export function deactivate() {}
