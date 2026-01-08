import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface FileChange {
    filePath: string;
    fileName: string;
    timestamp: Date;
    beforeContent: string;
    afterContent: string;
    diff: string;
}

interface Checkpoint {
    name: string;
    timestamp: Date;
    files: Map<string, string>;
}

export class FileTracker {
    private changes: FileChange[] = [];
    private checkpoints: Checkpoint[] = [];
    private fileSnapshots: Map<string, string> = new Map();
    private isTracking: boolean = false;
    private statusBarItem: vscode.StatusBarItem;
    private onChangeCallback: (() => void) | null = null;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusBarItem.command = 'statecli.toggleTracking';
        this.updateStatusBar();
    }

    setOnChangeCallback(callback: () => void) {
        this.onChangeCallback = callback;
    }

    startTracking(): void {
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

    stopTracking(): void {
        this.isTracking = false;
        this.updateStatusBar();
        vscode.window.showInformationMessage('StateCLI: Auto-tracking disabled');
    }

    toggleTracking(): void {
        if (this.isTracking) {
            this.stopTracking();
        } else {
            this.startTracking();
        }
    }

    isActive(): boolean {
        return this.isTracking;
    }

    private updateStatusBar(): void {
        if (this.isTracking) {
            this.statusBarItem.text = '$(eye) StateCLI: Tracking';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.tooltip = 'Click to stop tracking';
        } else {
            this.statusBarItem.text = '$(eye-closed) StateCLI: Off';
            this.statusBarItem.backgroundColor = undefined;
            this.statusBarItem.tooltip = 'Click to start tracking';
        }
        this.statusBarItem.show();
    }

    onDocumentSave(document: vscode.TextDocument): void {
        if (!this.isTracking) return;
        if (document.isUntitled || document.uri.scheme !== 'file') return;

        const filePath = document.uri.fsPath;
        const beforeContent = this.fileSnapshots.get(filePath) || '';
        const afterContent = document.getText();

        // Only track if content changed
        if (beforeContent !== afterContent) {
            const change: FileChange = {
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

    onDocumentOpen(document: vscode.TextDocument): void {
        if (!this.isTracking) return;
        if (document.isUntitled || document.uri.scheme !== 'file') return;

        // Snapshot the file when opened
        if (!this.fileSnapshots.has(document.uri.fsPath)) {
            this.fileSnapshots.set(document.uri.fsPath, document.getText());
        }
    }

    createCheckpoint(name: string): void {
        const files = new Map<string, string>();
        
        // Snapshot all tracked files
        this.fileSnapshots.forEach((content, filePath) => {
            files.set(filePath, content);
        });

        const checkpoint: Checkpoint = {
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

    undoLastChange(): FileChange | null {
        if (this.changes.length === 0) {
            vscode.window.showWarningMessage('StateCLI: No changes to undo');
            return null;
        }

        const lastChange = this.changes.shift()!;
        
        // Restore the file content
        const uri = vscode.Uri.file(lastChange.filePath);
        const edit = new vscode.WorkspaceEdit();
        
        // Get the document
        vscode.workspace.openTextDocument(uri).then(doc => {
            const fullRange = new vscode.Range(
                doc.positionAt(0),
                doc.positionAt(doc.getText().length)
            );
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

    restoreCheckpoint(name: string): boolean {
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
                const fullRange = new vscode.Range(
                    doc.positionAt(0),
                    doc.positionAt(doc.getText().length)
                );
                edit.replace(uri, fullRange, content);
                await vscode.workspace.applyEdit(edit);
                
                // Update snapshot
                this.fileSnapshots.set(filePath, content);
            } catch (error) {
                console.error(`Failed to restore ${filePath}:`, error);
            }
        });

        vscode.window.showInformationMessage(`StateCLI: Restored to checkpoint "${name}"`);
        
        if (this.onChangeCallback) {
            this.onChangeCallback();
        }
        
        return true;
    }

    getRecentChanges(limit: number = 20): FileChange[] {
        return this.changes.slice(0, limit);
    }

    getCheckpoints(): Checkpoint[] {
        return this.checkpoints;
    }

    getChangeCount(): number {
        return this.changes.length;
    }

    private generateDiff(before: string, after: string): string {
        const beforeLines = before.split('\n');
        const afterLines = after.split('\n');
        
        let diff = '';
        const maxLen = Math.max(beforeLines.length, afterLines.length);
        let changesCount = 0;
        
        for (let i = 0; i < maxLen && changesCount < 10; i++) {
            if (beforeLines[i] !== afterLines[i]) {
                if (beforeLines[i]) diff += `- ${beforeLines[i]}\n`;
                if (afterLines[i]) diff += `+ ${afterLines[i]}\n`;
                changesCount++;
            }
        }
        
        if (changesCount >= 10) {
            diff += '... (more changes)\n';
        }
        
        return diff || '(no text changes)';
    }

    dispose(): void {
        this.statusBarItem.dispose();
    }
}
