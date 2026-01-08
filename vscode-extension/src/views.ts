import * as vscode from 'vscode';
import { FileTracker } from './file-tracker';

export class HistoryViewProvider implements vscode.TreeDataProvider<HistoryTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<HistoryTreeItem | undefined | null | void> = new vscode.EventEmitter<HistoryTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<HistoryTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private fileTracker: FileTracker | null = null;

    setFileTracker(tracker: FileTracker): void {
        this.fileTracker = tracker;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: HistoryTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: HistoryTreeItem): Promise<HistoryTreeItem[]> {
        if (!element && this.fileTracker) {
            const changes = this.fileTracker.getRecentChanges(20);
            
            if (changes.length === 0) {
                return [new HistoryTreeItem(
                    'No changes tracked yet',
                    'Save files to track changes',
                    vscode.TreeItemCollapsibleState.None,
                    'info'
                )];
            }
            
            return changes.map(change => new HistoryTreeItem(
                change.fileName,
                this.formatTime(change.timestamp),
                vscode.TreeItemCollapsibleState.None,
                'history',
                change.filePath
            ));
        }
        return [];
    }

    private formatTime(date: Date): string {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }
}

export class CheckpointsViewProvider implements vscode.TreeDataProvider<CheckpointTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CheckpointTreeItem | undefined | null | void> = new vscode.EventEmitter<CheckpointTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CheckpointTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private fileTracker: FileTracker | null = null;

    setFileTracker(tracker: FileTracker): void {
        this.fileTracker = tracker;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CheckpointTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: CheckpointTreeItem): Promise<CheckpointTreeItem[]> {
        if (!element && this.fileTracker) {
            const checkpoints = this.fileTracker.getCheckpoints();
            
            if (checkpoints.length === 0) {
                return [new CheckpointTreeItem(
                    'No checkpoints',
                    'Create a checkpoint to save state',
                    '',
                    vscode.TreeItemCollapsibleState.None
                )];
            }
            
            return checkpoints.map(cp => new CheckpointTreeItem(
                cp.name,
                `${cp.files.size} files`,
                this.formatTime(cp.timestamp),
                vscode.TreeItemCollapsibleState.None
            ));
        }
        return [];
    }

    private formatTime(date: Date): string {
        return date.toLocaleTimeString();
    }
}

export class ActionsViewProvider implements vscode.TreeDataProvider<ActionTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ActionTreeItem | undefined | null | void> = new vscode.EventEmitter<ActionTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ActionTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    private fileTracker: FileTracker | null = null;

    setFileTracker(tracker: FileTracker): void {
        this.fileTracker = tracker;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ActionTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: ActionTreeItem): Promise<ActionTreeItem[]> {
        if (!element) {
            const isTracking = this.fileTracker?.isActive() || false;
            
            return Promise.resolve([
                new ActionTreeItem(
                    isTracking ? '🔴 Stop Tracking' : '🟢 Start Tracking',
                    'statecli.toggleTracking',
                    isTracking ? 'Stop auto-tracking file changes' : 'Start auto-tracking file changes'
                ),
                new ActionTreeItem('📌 Create Checkpoint', 'statecli.checkpoint', 'Save current state before making changes'),
                new ActionTreeItem('⏪ Undo Last Change', 'statecli.undo', 'Rollback the most recent change'),
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
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconType: string = 'history',
        public readonly filePath?: string
    ) {
        super(label, collapsibleState);
        this.tooltip = filePath ? `${filePath}\n${description}` : description;
        this.iconPath = new vscode.ThemeIcon(iconType);
        
        if (filePath) {
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [vscode.Uri.file(filePath)]
            };
        }
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
