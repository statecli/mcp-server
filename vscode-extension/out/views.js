"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionsViewProvider = exports.CheckpointsViewProvider = exports.HistoryViewProvider = void 0;
const vscode = __importStar(require("vscode"));
class HistoryViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.fileTracker = null;
    }
    setFileTracker(tracker) {
        this.fileTracker = tracker;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element && this.fileTracker) {
            const changes = this.fileTracker.getRecentChanges(20);
            if (changes.length === 0) {
                return [new HistoryTreeItem('No changes tracked yet', 'Save files to track changes', vscode.TreeItemCollapsibleState.None, 'info')];
            }
            return changes.map(change => new HistoryTreeItem(change.fileName, this.formatTime(change.timestamp), vscode.TreeItemCollapsibleState.None, 'history', change.filePath));
        }
        return [];
    }
    formatTime(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        if (diff < 60000)
            return 'just now';
        if (diff < 3600000)
            return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000)
            return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }
}
exports.HistoryViewProvider = HistoryViewProvider;
class CheckpointsViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.fileTracker = null;
    }
    setFileTracker(tracker) {
        this.fileTracker = tracker;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element && this.fileTracker) {
            const checkpoints = this.fileTracker.getCheckpoints();
            if (checkpoints.length === 0) {
                return [new CheckpointTreeItem('No checkpoints', 'Create a checkpoint to save state', '', vscode.TreeItemCollapsibleState.None)];
            }
            return checkpoints.map(cp => new CheckpointTreeItem(cp.name, `${cp.files.size} files`, this.formatTime(cp.timestamp), vscode.TreeItemCollapsibleState.None));
        }
        return [];
    }
    formatTime(date) {
        return date.toLocaleTimeString();
    }
}
exports.CheckpointsViewProvider = CheckpointsViewProvider;
class ActionsViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.fileTracker = null;
    }
    setFileTracker(tracker) {
        this.fileTracker = tracker;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!element) {
            const isTracking = this.fileTracker?.isActive() || false;
            return Promise.resolve([
                new ActionTreeItem(isTracking ? '🔴 Stop Tracking' : '🟢 Start Tracking', 'statecli.toggleTracking', isTracking ? 'Stop auto-tracking file changes' : 'Start auto-tracking file changes'),
                new ActionTreeItem('📌 Create Checkpoint', 'statecli.checkpoint', 'Save current state before making changes'),
                new ActionTreeItem('⏪ Undo Last Change', 'statecli.undo', 'Rollback the most recent change'),
                new ActionTreeItem('⚙️ Setup MCP Server', 'statecli.setup', 'Configure StateCLI for AI agents'),
                new ActionTreeItem('🔧 Show All Tools', 'statecli.showTools', 'View all 27 available tools')
            ]);
        }
        return Promise.resolve([]);
    }
}
exports.ActionsViewProvider = ActionsViewProvider;
class HistoryTreeItem extends vscode.TreeItem {
    constructor(label, description, collapsibleState, iconType = 'history', filePath) {
        super(label, collapsibleState);
        this.label = label;
        this.description = description;
        this.collapsibleState = collapsibleState;
        this.iconType = iconType;
        this.filePath = filePath;
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
    constructor(label, entity, timestamp, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.entity = entity;
        this.timestamp = timestamp;
        this.collapsibleState = collapsibleState;
        this.description = entity;
        this.tooltip = `${this.label} - ${entity} (${timestamp})`;
        this.iconPath = new vscode.ThemeIcon('bookmark');
        this.contextValue = 'checkpoint';
    }
}
class ActionTreeItem extends vscode.TreeItem {
    constructor(label, commandId, description) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.label = label;
        this.commandId = commandId;
        this.description = description;
        this.tooltip = description;
        this.command = {
            command: commandId,
            title: label,
            arguments: []
        };
    }
}
//# sourceMappingURL=views.js.map