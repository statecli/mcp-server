export interface StateChange {
  id: string;
  entity: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  actor: string;
  checkpointName?: string;
}

export interface Checkpoint {
  id: string;
  entity: string;
  name: string;
  timestamp: string;
  state: Record<string, unknown>;
}

export interface ReplayResult {
  entity: string;
  changes: Array<{
    timestamp: string;
    step: number;
    before: Record<string, unknown> | null;
    after: Record<string, unknown>;
    actor: string;
    checkpointName?: string;
  }>;
  summary: string;
  suggestedNextActions: string[];
}

export interface UndoResult {
  entity: string;
  stepsUndone: number;
  restoredState: Record<string, unknown> | null;
  summary: string;
}

export interface CheckpointResult {
  id: string;
  entity: string;
  name: string;
  timestamp: string;
  summary: string;
}

export interface LogResult {
  entity: string;
  changes: StateChange[];
  summary: string;
}

export interface TrackResult {
  id: string;
  entity: string;
  timestamp: string;
  summary: string;
}

export interface StateCLIConfig {
  storage: {
    type: 'local';
    path: string;
  };
  autoTrack: {
    enabled: boolean;
    patterns: string[];
  };
  retention: {
    days: number;
    maxChangesPerEntity: number;
  };
}

export const DEFAULT_CONFIG: StateCLIConfig = {
  storage: {
    type: 'local',
    path: '.statecli/state.db'
  },
  autoTrack: {
    enabled: true,
    patterns: ['*']
  },
  retention: {
    days: 30,
    maxChangesPerEntity: 1000
  }
};
