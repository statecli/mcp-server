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
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class HistoryViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            try {
                const { stdout } = await execAsync('npx -y statecli-mcp-server log --json');
                const history = JSON.parse(stdout);
                return history.slice(0, 20).map(item => new HistoryTreeItem(`${item.entity} - ${item.action}`, item.timestamp, vscode.TreeItemCollapsibleState.None));
            }
            catch (error) {
                return [new HistoryTreeItem('No history yet', 'Track changes to see them here', vscode.TreeItemCollapsibleState.None)];
            }
        }
        return [];
    }
}
exports.HistoryViewProvider = HistoryViewProvider;
class CheckpointsViewProvider {
    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            try {
                const { stdout } = await execAsync('npx -y statecli-mcp-server list-checkpoints --json');
                const checkpoints = JSON.parse(stdout);
                return checkpoints.map(cp => new CheckpointTreeItem(cp.name, cp.entity, cp.timestamp, vscode.TreeItemCollapsibleState.None));
            }
            catch (error) {
                return [new CheckpointTreeItem('No checkpoints', 'Create a checkpoint to save state', '', vscode.TreeItemCollapsibleState.None)];
            }
        }
        return [];
    }
}
exports.CheckpointsViewProvider = CheckpointsViewProvider;
class ActionsViewProvider {
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
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
exports.ActionsViewProvider = ActionsViewProvider;
class HistoryTreeItem extends vscode.TreeItem {
    constructor(label, description, collapsibleState) {
        super(label, collapsibleState);
        this.label = label;
        this.description = description;
        this.collapsibleState = collapsibleState;
        this.tooltip = `${this.label} - ${description}`;
        this.iconPath = new vscode.ThemeIcon('history');
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