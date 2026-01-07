/**
 * Rollback Preview - Preview state before undoing
 * 
 * Shows what the state would look like after a rollback before executing it.
 */

import { StateCLI } from './statecli';
import { ReplayChange } from './types';

export interface RollbackStep {
  step: number;
  timestamp: string;
  entity: string;
  action: string;
  stateBefore: Record<string, unknown> | null;
  stateAfter: Record<string, unknown>;
  willBeUndone: boolean;
}

export interface RollbackPreviewResult {
  entity: string;
  currentState: Record<string, unknown> | null;
  targetState: Record<string, unknown> | null;
  stepsToUndo: number;
  changes: RollbackStep[];
  diff: StateDiff[];
  warnings: string[];
  estimatedImpact: 'minimal' | 'moderate' | 'significant';
}

export interface StateDiff {
  path: string;
  currentValue: unknown;
  targetValue: unknown;
  action: 'add' | 'remove' | 'modify';
}

export interface CheckpointPreview {
  checkpointName: string;
  checkpointTimestamp: string;
  currentState: Record<string, unknown> | null;
  checkpointState: Record<string, unknown>;
  changesSinceCheckpoint: number;
  diff: StateDiff[];
}

export class RollbackPreview {
  private statecli: StateCLI;

  constructor(statecli: StateCLI) {
    this.statecli = statecli;
  }

  /**
   * Preview what will happen if we undo N steps
   */
  previewUndo(entity: string, steps: number = 1): RollbackPreviewResult {
    const replay = this.statecli.replay(entity);
    const currentState = this.statecli.getCurrentState(entity);
    const changes = replay.changes;
    
    if (changes.length === 0) {
      return {
        entity,
        currentState,
        targetState: null,
        stepsToUndo: 0,
        changes: [],
        diff: [],
        warnings: ['No changes to undo for this entity.'],
        estimatedImpact: 'minimal'
      };
    }

    const actualSteps = Math.min(steps, changes.length);
    const targetIndex = changes.length - actualSteps - 1;
    const targetState = targetIndex >= 0 ? changes[targetIndex].after : null;

    // Build rollback steps
    const rollbackSteps: RollbackStep[] = changes.map((change, index) => ({
      step: change.step,
      timestamp: change.timestamp,
      entity: change.entity || entity,
      action: this.describeChange(change.before, change.after),
      stateBefore: change.before,
      stateAfter: change.after,
      willBeUndone: index >= changes.length - actualSteps
    }));

    // Calculate diff
    const diff = this.calculateDiff(currentState, targetState);

    // Generate warnings
    const warnings = this.generateWarnings(currentState, targetState, actualSteps, changes);

    // Estimate impact
    const estimatedImpact = this.estimateImpact(diff, actualSteps);

    // Track preview
    this.statecli.track('rollback', 'preview', {
      entity,
      stepsToUndo: actualSteps,
      diffCount: diff.length,
      estimatedImpact
    }, 'rollback-preview');

    return {
      entity,
      currentState,
      targetState,
      stepsToUndo: actualSteps,
      changes: rollbackSteps,
      diff,
      warnings,
      estimatedImpact
    };
  }

  /**
   * Preview restoring to a specific checkpoint
   */
  previewCheckpointRestore(entity: string, checkpointName: string): CheckpointPreview | null {
    const checkpoint = (this.statecli as any).getCheckpoint?.(entity, checkpointName) || null;
    
    if (!checkpoint) {
      return null;
    }

    const currentState = this.statecli.getCurrentState(entity);
    const replay = this.statecli.replay(entity);
    
    // Count changes since checkpoint
    const changesSince = replay.changes.filter(c => 
      new Date(c.timestamp) > new Date(checkpoint.timestamp)
    ).length;

    const diff = this.calculateDiff(currentState, checkpoint.state);

    return {
      checkpointName: checkpoint.name,
      checkpointTimestamp: checkpoint.timestamp,
      currentState,
      checkpointState: checkpoint.state,
      changesSinceCheckpoint: changesSince,
      diff
    };
  }

  /**
   * Compare two states and show differences
   */
  compareStates(
    state1: Record<string, unknown> | null,
    state2: Record<string, unknown> | null,
    label1: string = 'State 1',
    label2: string = 'State 2'
  ): {
    diff: StateDiff[];
    summary: string;
  } {
    const diff = this.calculateDiff(state1, state2);
    
    const adds = diff.filter(d => d.action === 'add').length;
    const removes = diff.filter(d => d.action === 'remove').length;
    const mods = diff.filter(d => d.action === 'modify').length;

    const summary = `Comparing ${label1} to ${label2}: ${adds} additions, ${removes} removals, ${mods} modifications`;

    return { diff, summary };
  }

  /**
   * Get a visual diff as a string
   */
  formatDiff(diff: StateDiff[]): string {
    const lines: string[] = [];
    
    for (const d of diff) {
      switch (d.action) {
        case 'add':
          lines.push(`+ ${d.path}: ${JSON.stringify(d.targetValue)}`);
          break;
        case 'remove':
          lines.push(`- ${d.path}: ${JSON.stringify(d.currentValue)}`);
          break;
        case 'modify':
          lines.push(`~ ${d.path}:`);
          lines.push(`  - ${JSON.stringify(d.currentValue)}`);
          lines.push(`  + ${JSON.stringify(d.targetValue)}`);
          break;
      }
    }

    return lines.join('\n');
  }

  /**
   * Simulate undo without actually doing it
   */
  simulateUndo(entity: string, steps: number = 1): {
    preview: RollbackPreviewResult;
    wouldSucceed: boolean;
    resultingState: Record<string, unknown> | null;
    sideEffects: string[];
  } {
    const preview = this.previewUndo(entity, steps);
    
    const wouldSucceed = preview.warnings.length === 0 || 
      !preview.warnings.some((w: string) => w.includes('Cannot') || w.includes('Error'));
    
    const sideEffects: string[] = [];
    
    if (preview.stepsToUndo > 5) {
      sideEffects.push('Large rollback - may take longer to process');
    }
    
    if (preview.diff.some(d => d.path.includes('id') || d.path.includes('Id'))) {
      sideEffects.push('IDs will change - may affect relationships');
    }

    return {
      preview,
      wouldSucceed,
      resultingState: preview.targetState,
      sideEffects
    };
  }

  private calculateDiff(
    current: Record<string, unknown> | null,
    target: Record<string, unknown> | null
  ): StateDiff[] {
    const diff: StateDiff[] = [];
    
    if (!current && !target) return diff;
    if (!current && target) {
      // All target properties are additions
      this.flattenObject(target, '').forEach(([path, value]) => {
        diff.push({ path, currentValue: undefined, targetValue: value, action: 'add' });
      });
      return diff;
    }
    if (current && !target) {
      // All current properties are removals
      this.flattenObject(current, '').forEach(([path, value]) => {
        diff.push({ path, currentValue: value, targetValue: undefined, action: 'remove' });
      });
      return diff;
    }

    // Both exist - compare
    const currentFlat = new Map(this.flattenObject(current!, ''));
    const targetFlat = new Map(this.flattenObject(target!, ''));

    // Check for modifications and removals
    for (const [path, currentValue] of currentFlat) {
      if (targetFlat.has(path)) {
        const targetValue = targetFlat.get(path);
        if (JSON.stringify(currentValue) !== JSON.stringify(targetValue)) {
          diff.push({ path, currentValue, targetValue, action: 'modify' });
        }
      } else {
        diff.push({ path, currentValue, targetValue: undefined, action: 'remove' });
      }
    }

    // Check for additions
    for (const [path, targetValue] of targetFlat) {
      if (!currentFlat.has(path)) {
        diff.push({ path, currentValue: undefined, targetValue, action: 'add' });
      }
    }

    return diff;
  }

  private flattenObject(obj: Record<string, unknown>, prefix: string): [string, unknown][] {
    const result: [string, unknown][] = [];
    
    for (const [key, value] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result.push(...this.flattenObject(value as Record<string, unknown>, path));
      } else {
        result.push([path, value]);
      }
    }

    return result;
  }

  private describeChange(before: Record<string, unknown> | null, after: Record<string, unknown>): string {
    if (!before) return 'Created';
    
    const beforeKeys = Object.keys(before);
    const afterKeys = Object.keys(after);
    
    const added = afterKeys.filter(k => !beforeKeys.includes(k));
    const removed = beforeKeys.filter(k => !afterKeys.includes(k));
    const modified = afterKeys.filter(k => 
      beforeKeys.includes(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );

    const parts: string[] = [];
    if (added.length) parts.push(`Added: ${added.join(', ')}`);
    if (removed.length) parts.push(`Removed: ${removed.join(', ')}`);
    if (modified.length) parts.push(`Modified: ${modified.join(', ')}`);

    return parts.join('; ') || 'No visible changes';
  }

  private generateWarnings(
    currentState: Record<string, unknown> | null,
    targetState: Record<string, unknown> | null,
    steps: number,
    changes: ReplayChange[]
  ): string[] {
    const warnings: string[] = [];

    if (steps > 10) {
      warnings.push(`Rolling back ${steps} steps is a large change. Consider restoring to a checkpoint instead.`);
    }

    if (!targetState) {
      warnings.push('Target state is null - entity will be effectively reset.');
    }

    // Check for checkpoint in undo range
    const checkpointsInRange = changes
      .slice(-steps)
      .filter(c => c.checkpointName);
    
    if (checkpointsInRange.length > 0) {
      warnings.push(`This will undo past checkpoint(s): ${checkpointsInRange.map(c => c.checkpointName).join(', ')}`);
    }

    return warnings;
  }

  private estimateImpact(diff: StateDiff[], steps: number): 'minimal' | 'moderate' | 'significant' {
    const changeCount = diff.length;
    
    if (changeCount === 0 || steps === 1) return 'minimal';
    if (changeCount <= 5 && steps <= 3) return 'moderate';
    return 'significant';
  }
}
