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
exports.FileTracker = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class FileTracker {
    constructor() {
        this.changes = [];
        this.checkpoints = [];
        this.fileSnapshots = new Map();
        this.isTracking = false;
        this.onChangeCallback = null;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'statecli.toggleTracking';
        this.updateStatusBar();
    }
    setOnChangeCallback(callback) {
        this.onChangeCallback = callback;
    }
    startTracking() {
        this.isTracking = true;
        this.updateStatusBar();
        // Snapshot all open files
        vscode.workspace.textDocuments.forEach(doc => {
            if (!doc.isUntitled && doc.uri.scheme === 'file') {
                this.fileSnapshots.set(doc.uri.fsPath, doc.getText());
            }
        });
        vscode.window.showInformationMessage('StateCLI: Auto-tracking enabled');
    }
    stopTracking() {
        this.isTracking = false;
        this.updateStatusBar();
        vscode.window.showInformationMessage('StateCLI: Auto-tracking disabled');
    }
    toggleTracking() {
        if (this.isTracking) {
            this.stopTracking();
        }
        else {
            this.startTracking();
        }
    }
    isActive() {
        return this.isTracking;
    }
    updateStatusBar() {
        if (this.isTracking) {
            this.statusBarItem.text = '$(eye) StateCLI: Tracking';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'Click to stop tracking';
        }
        else {
            this.statusBarItem.text = '$(eye-closed) StateCLI: Off';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 'Click to start tracking';
        }
        this.statusBarItem.show();
    }
    onDocumentSave(document) {
        if (!this.isTracking)
            return;
        if (document.isUntitled || document.uri.scheme !== 'file')
            return;
        const filePath = document.uri.fsPath;
        const beforeContent = this.fileSnapshots.get(filePath) || '';
        const afterContent = document.getText();
        // Only track if content changed
        if (beforeContent !== afterContent) {
            const change = {
                filePath,
                fileName: path.basename(filePath),
                timestamp: new Date(),
                beforeContent,
                afterContent,
                diff: this.generateDiff(beforeContent, afterContent)
            };
            this.changes.unshift(change); // Add to beginning
            // Keep last 100 changes
            if (this.changes.length > 100) {
                this.changes.pop();
            }
            // Update snapshot
            this.fileSnapshots.set(filePath, afterContent);
            // Notify callback
            if (this.onChangeCallback) {
                this.onChangeCallback();
            }
            console.log(`StateCLI: Tracked change to ${change.fileName}`);
        }
    }
    onDocumentOpen(document) {
        if (!this.isTracking)
            return;
        if (document.isUntitled || document.uri.scheme !== 'file')
            return;
        // Snapshot the file when opened
        if (!this.fileSnapshots.has(document.uri.fsPath)) {
            this.fileSnapshots.set(document.uri.fsPath, document.getText());
        }
    }
    createCheckpoint(name) {
        const files = new Map();
        // Snapshot all tracked files
        this.fileSnapshots.forEach((content, filePath) => {
            files.set(filePath, content);
        });
        const checkpoint = {
            name,
            timestamp: new Date(),
            files
        };
        this.checkpoints.unshift(checkpoint);
        // Keep last 20 checkpoints
        if (this.checkpoints.length > 20) {
            this.checkpoints.pop();
        }
        vscode.window.showInformationMessage(`StateCLI: Checkpoint "${name}" created`);
        if (this.onChangeCallback) {
            this.onChangeCallback();
        }
    }
    undoLastChange() {
        if (this.changes.length === 0) {
            vscode.window.showWarningMessage('StateCLI: No changes to undo');
            return null;
        }
        const lastChange = this.changes.shift();
        // Restore the file content
        const uri = vscode.Uri.file(lastChange.filePath);
        const edit = new vscode.WorkspaceEdit();
        // Get the document
        vscode.workspace.openTextDocument(uri).then(doc => {
            const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
            edit.replace(uri, fullRange, lastChange.beforeContent);
            vscode.workspace.applyEdit(edit).then(success => {
                if (success) {
                    // Update snapshot
                    this.fileSnapshots.set(lastChange.filePath, lastChange.beforeContent);
                    vscode.window.showInformationMessage(`StateCLI: Undid change to ${lastChange.fileName}`);
                    if (this.onChangeCallback) {
                        this.onChangeCallback();
                    }
                }
            });
        });
        return lastChange;
    }
    restoreCheckpoint(name) {
        const checkpoint = this.checkpoints.find(cp => cp.name === name);
        if (!checkpoint) {
            vscode.window.showWarningMessage(`StateCLI: Checkpoint "${name}" not found`);
            return false;
        }
        // Restore all files from checkpoint
        checkpoint.files.forEach(async (content, filePath) => {
            try {
                const uri = vscode.Uri.file(filePath);
                const edit = new vscode.WorkspaceEdit();
                const doc = await vscode.workspace.openTextDocument(uri);
                const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
                edit.replace(uri, fullRange, content);
                await vscode.workspace.applyEdit(edit);
                // Update snapshot
                this.fileSnapshots.set(filePath, content);
            }
            catch (error) {
                console.error(`Failed to restore ${filePath}:`, error);
            }
        });
        vscode.window.showInformationMessage(`StateCLI: Restored to checkpoint "${name}"`);
        if (this.onChangeCallback) {
            this.onChangeCallback();
        }
        return true;
    }
    getRecentChanges(limit = 20) {
        return this.changes.slice(0, limit);
    }
    getCheckpoints() {
        return this.checkpoints;
    }
    getChangeCount() {
        return this.changes.length;
    }
    generateDiff(before, after) {
        const beforeLines = before.split('\n');
        const afterLines = after.split('\n');
        let diff = '';
        const maxLen = Math.max(beforeLines.length, afterLines.length);
        let changesCount = 0;
        for (let i = 0; i < maxLen && changesCount < 10; i++) {
            if (beforeLines[i] !== afterLines[i]) {
                if (beforeLines[i])
                    diff += `- ${beforeLines[i]}\n`;
                if (afterLines[i])
                    diff += `+ ${afterLines[i]}\n`;
                changesCount++;
            }
        }
        if (changesCount >= 10) {
            diff += '... (more changes)\n';
        }
        return diff || '(no text changes)';
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.FileTracker = FileTracker;
//# sourceMappingURL=file-tracker.js.map