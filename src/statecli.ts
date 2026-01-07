import { StateStorage } from './storage';
import {
  StateCLIConfig,
  ReplayResult,
  UndoResult,
  CheckpointResult,
  LogResult,
  TrackResult,
  DEFAULT_CONFIG
} from './types';

export class StateCLI {
  private storage: StateStorage;

  constructor(config: Partial<StateCLIConfig> = {}) {
    this.storage = new StateStorage(config);
  }

  replay(
    entity: string,
    options: { actor?: string } = {}
  ): ReplayResult {
    const changes = this.storage.getChanges(entity, { actor: options.actor });
    
    const formattedChanges = changes.map((change, index) => ({
      timestamp: change.timestamp,
      step: index + 1,
      before: change.before,
      after: change.after,
      actor: change.actor,
      checkpointName: change.checkpointName
    }));

    const suggestedNextActions: string[] = [];
    
    if (changes.length === 0) {
      suggestedNextActions.push('track initial state for this entity');
    } else {
      suggestedNextActions.push('investigate latest change');
      if (changes.length > 1) {
        suggestedNextActions.push('compare first and last state');
      }
      suggestedNextActions.push('create checkpoint if state is stable');
    }

    return {
      entity,
      changes: formattedChanges,
      summary: `${changes.length} state change${changes.length !== 1 ? 's' : ''} found`,
      suggestedNextActions
    };
  }

  undo(
    entity: string,
    steps: number = 1
  ): UndoResult {
    const { undone, restoredState } = this.storage.undo(entity, steps);

    return {
      entity,
      stepsUndone: undone.length,
      restoredState,
      summary: undone.length > 0
        ? `Undid ${undone.length} step${undone.length !== 1 ? 's' : ''}. State restored.`
        : 'No changes to undo.'
    };
  }

  checkpoint(
    entity: string,
    name: string
  ): CheckpointResult {
    const checkpoint = this.storage.createCheckpoint(entity, name);

    return {
      id: checkpoint.id,
      entity: checkpoint.entity,
      name: checkpoint.name,
      timestamp: checkpoint.timestamp,
      summary: `Checkpoint "${name}" created for ${entity}`
    };
  }

  restoreCheckpoint(
    entity: string,
    name: string
  ): { success: boolean; summary: string } {
    const { restored, checkpoint } = this.storage.restoreCheckpoint(entity, name);

    if (restored && checkpoint) {
      return {
        success: true,
        summary: `Restored to checkpoint "${name}" from ${checkpoint.timestamp}`
      };
    }

    return {
      success: false,
      summary: `Checkpoint "${name}" not found for ${entity}`
    };
  }

  log(
    entity: string,
    options: { since?: string; actor?: string; limit?: number } = {}
  ): LogResult {
    let changes;
    
    if (entity.includes('*')) {
      changes = this.storage.getChangesByPattern(entity, options);
    } else {
      changes = this.storage.getChanges(entity, options);
    }

    return {
      entity,
      changes,
      summary: `${changes.length} change${changes.length !== 1 ? 's' : ''} in log`
    };
  }

  track(
    entityType: string,
    entityId: string,
    state: Record<string, unknown>,
    actor: string = 'system'
  ): TrackResult {
    const change = this.storage.track(entityType, entityId, state, actor);

    return {
      id: change.id,
      entity: change.entity,
      timestamp: change.timestamp,
      summary: `State tracked for ${change.entity}`
    };
  }

  getCurrentState(entity: string): Record<string, unknown> | null {
    return this.storage.getCurrentState(entity);
  }

  listEntities(): string[] {
    return this.storage.listEntities();
  }

  close(): void {
    this.storage.close();
  }
}

let instance: StateCLI | null = null;

export function getStateCLI(config?: Partial<StateCLIConfig>): StateCLI {
  if (!instance) {
    instance = new StateCLI(config);
  }
  return instance;
}

export function resetStateCLI(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
