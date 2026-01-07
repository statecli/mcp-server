import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import {
  StateChange,
  Checkpoint,
  StateCLIConfig,
  DEFAULT_CONFIG
} from './types';

export class StateStorage {
  private db: Database.Database;
  private config: StateCLIConfig;

  constructor(config: Partial<StateCLIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    const dbPath = this.config.storage.path;
    const dbDir = path.dirname(dbPath);
    
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state_changes (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        before_state TEXT,
        after_state TEXT NOT NULL,
        actor TEXT DEFAULT 'system',
        checkpoint_name TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_entity ON state_changes(entity);
      CREATE INDEX IF NOT EXISTS idx_entity_type ON state_changes(entity_type);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON state_changes(timestamp);
      CREATE INDEX IF NOT EXISTS idx_actor ON state_changes(actor);

      CREATE TABLE IF NOT EXISTS checkpoints (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        name TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_checkpoint_entity ON checkpoints(entity);
      CREATE INDEX IF NOT EXISTS idx_checkpoint_name ON checkpoints(name);
    `);
  }

  track(
    entityType: string,
    entityId: string,
    state: Record<string, unknown>,
    actor: string = 'system',
    checkpointName?: string
  ): StateChange {
    const entity = `${entityType}:${entityId}`;
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const lastChange = this.getLastChange(entity);
    const before = lastChange?.after || null;
    
    const stmt = this.db.prepare(`
      INSERT INTO state_changes (id, entity, entity_type, entity_id, timestamp, before_state, after_state, actor, checkpoint_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      entity,
      entityType,
      entityId,
      timestamp,
      before ? JSON.stringify(before) : null,
      JSON.stringify(state),
      actor,
      checkpointName || null
    );
    
    this.enforceRetention(entity);
    
    return {
      id,
      entity,
      entityType,
      entityId,
      timestamp,
      before,
      after: state,
      actor,
      checkpointName
    };
  }

  private getLastChange(entity: string): StateChange | null {
    const stmt = this.db.prepare(`
      SELECT * FROM state_changes 
      WHERE entity = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    const row = stmt.get(entity) as any;
    if (!row) return null;
    
    return this.rowToStateChange(row);
  }

  private rowToStateChange(row: any): StateChange {
    return {
      id: row.id,
      entity: row.entity,
      entityType: row.entity_type,
      entityId: row.entity_id,
      timestamp: row.timestamp,
      before: row.before_state ? JSON.parse(row.before_state) : null,
      after: JSON.parse(row.after_state),
      actor: row.actor,
      checkpointName: row.checkpoint_name || undefined
    };
  }

  getChanges(
    entity: string,
    options: {
      actor?: string;
      since?: string;
      limit?: number;
    } = {}
  ): StateChange[] {
    let query = 'SELECT * FROM state_changes WHERE entity = ?';
    const params: any[] = [entity];
    
    if (options.actor) {
      query += ' AND actor = ?';
      params.push(options.actor);
    }
    
    if (options.since) {
      const sinceDate = this.parseSince(options.since);
      query += ' AND timestamp >= ?';
      params.push(sinceDate.toISOString());
    }
    
    query += ' ORDER BY timestamp ASC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.rowToStateChange(row));
  }

  getChangesByPattern(
    pattern: string,
    options: {
      actor?: string;
      since?: string;
      limit?: number;
    } = {}
  ): StateChange[] {
    const sqlPattern = pattern.replace(/\*/g, '%');
    
    let query = 'SELECT * FROM state_changes WHERE entity LIKE ?';
    const params: any[] = [sqlPattern];
    
    if (options.actor) {
      query += ' AND actor = ?';
      params.push(options.actor);
    }
    
    if (options.since) {
      const sinceDate = this.parseSince(options.since);
      query += ' AND timestamp >= ?';
      params.push(sinceDate.toISOString());
    }
    
    query += ' ORDER BY timestamp ASC';
    
    if (options.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    
    return rows.map(row => this.rowToStateChange(row));
  }

  private parseSince(since: string): Date {
    const now = new Date();
    const match = since.match(/^(\d+)\s*(h|hour|hours|d|day|days|m|min|minutes?|s|sec|seconds?)\s*ago$/i);
    
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();
      
      if (unit.startsWith('h')) {
        now.setHours(now.getHours() - value);
      } else if (unit.startsWith('d')) {
        now.setDate(now.getDate() - value);
      } else if (unit.startsWith('m')) {
        now.setMinutes(now.getMinutes() - value);
      } else if (unit.startsWith('s')) {
        now.setSeconds(now.getSeconds() - value);
      }
      
      return now;
    }
    
    return new Date(since);
  }

  undo(entity: string, steps: number = 1): { undone: StateChange[]; restoredState: Record<string, unknown> | null } {
    const changes = this.getChanges(entity);
    
    if (changes.length === 0) {
      return { undone: [], restoredState: null };
    }
    
    const toUndo = changes.slice(-steps);
    const ids = toUndo.map(c => c.id);
    
    const deleteStmt = this.db.prepare(`
      DELETE FROM state_changes WHERE id IN (${ids.map(() => '?').join(',')})
    `);
    deleteStmt.run(...ids);
    
    const lastRemaining = this.getLastChange(entity);
    const restoredState = lastRemaining?.after || null;
    
    return { undone: toUndo, restoredState };
  }

  createCheckpoint(entity: string, name: string): Checkpoint {
    const id = uuidv4();
    const timestamp = new Date().toISOString();
    
    const lastChange = this.getLastChange(entity);
    const state = lastChange?.after || {};
    
    const stmt = this.db.prepare(`
      INSERT INTO checkpoints (id, entity, name, timestamp, state)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(id, entity, name, timestamp, JSON.stringify(state));
    
    return { id, entity, name, timestamp, state };
  }

  getCheckpoint(entity: string, name: string): Checkpoint | null {
    const stmt = this.db.prepare(`
      SELECT * FROM checkpoints 
      WHERE entity = ? AND name = ? 
      ORDER BY timestamp DESC 
      LIMIT 1
    `);
    
    const row = stmt.get(entity, name) as any;
    if (!row) return null;
    
    return {
      id: row.id,
      entity: row.entity,
      name: row.name,
      timestamp: row.timestamp,
      state: JSON.parse(row.state)
    };
  }

  restoreCheckpoint(entity: string, name: string): { restored: boolean; checkpoint: Checkpoint | null } {
    const checkpoint = this.getCheckpoint(entity, name);
    if (!checkpoint) {
      return { restored: false, checkpoint: null };
    }
    
    const deleteStmt = this.db.prepare(`
      DELETE FROM state_changes 
      WHERE entity = ? AND timestamp > ?
    `);
    deleteStmt.run(entity, checkpoint.timestamp);
    
    return { restored: true, checkpoint };
  }

  listEntities(): string[] {
    const stmt = this.db.prepare(`
      SELECT DISTINCT entity FROM state_changes ORDER BY entity
    `);
    
    const rows = stmt.all() as any[];
    return rows.map(row => row.entity);
  }

  private enforceRetention(entity: string): void {
    const maxChanges = this.config.retention.maxChangesPerEntity;
    
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM state_changes WHERE entity = ?
    `);
    const { count } = countStmt.get(entity) as any;
    
    if (count > maxChanges) {
      const deleteCount = count - maxChanges;
      const deleteStmt = this.db.prepare(`
        DELETE FROM state_changes 
        WHERE id IN (
          SELECT id FROM state_changes 
          WHERE entity = ? 
          ORDER BY timestamp ASC 
          LIMIT ?
        )
      `);
      deleteStmt.run(entity, deleteCount);
    }
    
    const retentionDays = this.config.retention.days;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const cleanupStmt = this.db.prepare(`
      DELETE FROM state_changes 
      WHERE timestamp < ?
    `);
    cleanupStmt.run(cutoffDate.toISOString());
  }

  getCurrentState(entity: string): Record<string, unknown> | null {
    const lastChange = this.getLastChange(entity);
    return lastChange?.after || null;
  }

  close(): void {
    this.db.close();
  }
}
