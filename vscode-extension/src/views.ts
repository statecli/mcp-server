import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HistoryItem {
    timestamp: string;
    entity: string;
    action: string;
}

interface Checkpoint {
    name: string;
    entity: string;
    timestamp: string;
}

export class HistoryViewProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryTreeItem): Promise<HistoryTreeItem[]> {
        if (!element) {
            try {
                const { stdout } = await execAsync('npx -y statecli-mcp-server log --json');
                const history: HistoryItem[] = JSON.parse(stdout);
                return history.slice(0, 20).map(item => new HistoryTreeItem(
                    `${item.entity} - ${item.action}`,
                    item.timestamp,
                    vscode.TreeItemCollapsibleState.None
                ));
            } catch (error) {
                return [new HistoryTreeItem('No history yet', 'Track changes to see them here', vscode.TreeItemCollapsibleState.None)];
            }
        }
        return [];
    }
}

export class CheckpointsViewProvider implements vscode.TreeDataProvider<CheckpointTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CheckpointTreeItem | undefined | null | void> = new vscode.EventEmitter<CheckpointTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CheckpointTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CheckpointTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CheckpointTreeItem): Promise<CheckpointTreeItem[]> {
        if (!element) {
            try {
                const { stdout } = await execAsync('npx -y statecli-mcp-server list-checkpoints --json');
                const checkpoints: Checkpoint[] = JSON.parse(stdout);
                return checkpoints.map(cp => new CheckpointTreeItem(
                    cp.name,
                    cp.entity,
                    cp.timestamp,
                    vscode.TreeItemCollapsibleState.None
                ));
            } catch (error) {
                return [new CheckpointTreeItem('No checkpoints', 'Create a checkpoint to save state', '', vscode.TreeItemCollapsibleState.None)];
            }
        }
        return [];
    }
}

export class ActionsViewProvider implements vscode.TreeDataProvider<ActionTreeItem> {
    getTreeItem(element: ActionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ActionTreeItem): Promise<ActionTreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new ActionTreeItem('📌 Create Checkpoint', 'statecli.checkpoint', 'Save current state before making changes'),
                new ActionTreeItem('👁️ Track Current File', 'statecli.trackCurrentFile', 'Start tracking changes to the active file'),
                new ActionTreeItem('⏪ Undo Last Change', 'statecli.undo', 'Rollback the most recent change'),
                new ActionTreeItem('📜 View History', 'statecli.viewHistory', 'See all tracked changes'),
                new ActionTreeItem('⚙️ Setup MCP Server', 'statecli.setup', 'Configure StateCLI for AI agents'),
                new ActionTreeItem('🔧 Show All Tools', 'statecli.showTools', 'View all 27 available tools')
            ]);
        }
        return Promise.resolve([]);
    }
}

class HistoryTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} - ${description}`;
        this.iconPath = new vscode.ThemeIcon('history');
    }
}

class CheckpointTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly entity: string,
        public readonly timestamp: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(label, collapsibleState);
        this.description = entity;
        this.tooltip = `${this.label} - ${entity} (${timestamp})`;
        this.iconPath = new vscode.ThemeIcon('bookmark');
        this.contextValue = 'checkpoint';
    }
}

class ActionTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly commandId: string,
        public readonly description: string
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.tooltip = description;
        this.command = {
            command: commandId,
            title: label,
            arguments: []
        };
    }
}
