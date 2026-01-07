/**
 * Session Memory - Cross-session persistence and memory
 * 
 * Remembers what happened across sessions and provides memory queries
 */

import * as fs from 'fs';
import * as path from 'path';
import { StateCLI } from './statecli';
import { StateChange, ReplayChange } from './types';

export interface SessionInfo {
  id: string;
  startTime: string;
  endTime?: string;
  summary: string;
  changesCount: number;
  entities: string[];
}

export interface MemoryQuery {
  entity?: string;
  entityPattern?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  actor?: string;
  keyword?: string;
}

export interface MemoryResult {
  query: MemoryQuery;
  sessions: SessionInfo[];
  changes: StateChange[];
  summary: string;
}

export class SessionMemory {
  private statecli: StateCLI;
  private sessionId: string;
  private sessionStartTime: string;
  private memoryDir: string;

  constructor(statecli: StateCLI, memoryDir?: string) {
    this.statecli = statecli;
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = new Date().toISOString();
    this.memoryDir = memoryDir || path.join(process.cwd(), '.statecli', 'memory');
    
    this.ensureMemoryDir();
    this.recordSessionStart();
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Query memory across sessions
   */
  queryMemory(query: MemoryQuery): MemoryResult {
    const sessions = this.getSessions();
    const matchingSessions: SessionInfo[] = [];
    const matchingChanges: StateChange[] = [];

    for (const session of sessions) {
      // Load session data
      const sessionData = this.loadSessionData(session.id);
      if (!sessionData) continue;

      let sessionMatches = false;

      for (const change of sessionData.changes) {
        if (this.changeMatchesQuery(change, query)) {
          matchingChanges.push(change);
          sessionMatches = true;
        }
      }

      if (sessionMatches) {
        matchingSessions.push(session);
      }
    }

    const summary = this.createQuerySummary(query, matchingSessions, matchingChanges);

    return {
      query,
      sessions: matchingSessions,
      changes: matchingChanges,
      summary
    };
  }

  /**
   * Ask a natural language question about past actions
   */
  ask(question: string): MemoryResult {
    // Parse question into query
    const query = this.parseQuestion(question);
    return this.queryMemory(query);
  }

  /**
   * Get all recorded sessions
   */
  getSessions(): SessionInfo[] {
    const sessions: SessionInfo[] = [];
    
    try {
      const files = fs.readdirSync(this.memoryDir);
      for (const file of files) {
        if (file.endsWith('.session.json')) {
          const sessionPath = path.join(this.memoryDir, file);
          const data = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
          sessions.push(data.info);
        }
      }
    } catch {
      // Memory dir might not exist yet
    }

    return sessions.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }

  /**
   * Get session data by ID
   */
  getSession(sessionId: string): { info: SessionInfo; changes: StateChange[] } | null {
    return this.loadSessionData(sessionId);
  }

  /**
   * Save current session data
   */
  saveSession(): void {
    // Get all changes from current session
    const allEntities = this.statecli.listEntities();
    const allChanges: StateChange[] = [];

    for (const entity of allEntities) {
      const replay = this.statecli.replay(entity);
      for (const change of replay.changes) {
        // Only include changes from current session
        if (change.timestamp >= this.sessionStartTime) {
          allChanges.push({
            id: change.id || `${entity}-${change.step}`,
            entity,
            entityType: entity.split(':')[0],
            entityId: entity.split(':')[1] || '',
            timestamp: change.timestamp,
            before: change.before,
            after: change.after,
            actor: change.actor
          } as StateChange);
        }
      }
    }

    const sessionInfo: SessionInfo = {
      id: this.sessionId,
      startTime: this.sessionStartTime,
      endTime: new Date().toISOString(),
      summary: `Session with ${allChanges.length} changes across ${allEntities.length} entities`,
      changesCount: allChanges.length,
      entities: allEntities
    };

    const sessionData = {
      info: sessionInfo,
      changes: allChanges
    };

    const sessionPath = path.join(this.memoryDir, `${this.sessionId}.session.json`);
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
  }

  /**
   * End current session
   */
  endSession(): SessionInfo {
    this.saveSession();
    
    const sessions = this.getSessions();
    return sessions.find(s => s.id === this.sessionId) || {
      id: this.sessionId,
      startTime: this.sessionStartTime,
      endTime: new Date().toISOString(),
      summary: 'Session ended',
      changesCount: 0,
      entities: []
    };
  }

  /**
   * Get recent activity summary
   */
  getRecentActivity(hours: number = 24): MemoryResult {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    return this.queryMemory({
      timeRange: {
        start: cutoff,
        end: new Date().toISOString()
      }
    });
  }

  /**
   * Get activity for a specific entity across all sessions
   */
  getEntityHistory(entityPattern: string): MemoryResult {
    return this.queryMemory({ entityPattern });
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  private ensureMemoryDir(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private recordSessionStart(): void {
    this.statecli.track('session', this.sessionId, {
      event: 'start',
      startTime: this.sessionStartTime
    }, 'session-memory');
  }

  private loadSessionData(sessionId: string): { info: SessionInfo; changes: StateChange[] } | null {
    const sessionPath = path.join(this.memoryDir, `${sessionId}.session.json`);
    
    try {
      if (fs.existsSync(sessionPath)) {
        return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
      }
    } catch {
      // File might be corrupted
    }
    
    return null;
  }

  private changeMatchesQuery(change: StateChange, query: MemoryQuery): boolean {
    // Entity filter
    if (query.entity && change.entity !== query.entity) {
      return false;
    }

    // Entity pattern filter
    if (query.entityPattern) {
      const pattern = query.entityPattern.replace('*', '.*');
      const regex = new RegExp(pattern);
      if (!regex.test(change.entity)) {
        return false;
      }
    }

    // Time range filter
    if (query.timeRange) {
      const changeTime = new Date(change.timestamp).getTime();
      const startTime = new Date(query.timeRange.start).getTime();
      const endTime = new Date(query.timeRange.end).getTime();
      
      if (changeTime < startTime || changeTime > endTime) {
        return false;
      }
    }

    // Actor filter
    if (query.actor && change.actor !== query.actor) {
      return false;
    }

    // Keyword filter (search in state values)
    if (query.keyword) {
      const stateStr = JSON.stringify(change.after).toLowerCase();
      if (!stateStr.includes(query.keyword.toLowerCase())) {
        return false;
      }
    }

    return true;
  }

  private parseQuestion(question: string): MemoryQuery {
    const query: MemoryQuery = {};
    const lowerQ = question.toLowerCase();

    // Parse time references
    if (lowerQ.includes('yesterday')) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      query.timeRange = {
        start: yesterday.toISOString(),
        end: new Date().toISOString()
      };
    } else if (lowerQ.includes('last week')) {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      query.timeRange = {
        start: lastWeek.toISOString(),
        end: new Date().toISOString()
      };
    } else if (lowerQ.includes('today')) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      query.timeRange = {
        start: today.toISOString(),
        end: new Date().toISOString()
      };
    }

    // Parse entity references
    const entityMatch = question.match(/(?:to|on|for|in)\s+(\w+[:\w]*)/i);
    if (entityMatch) {
      query.entityPattern = entityMatch[1].includes(':') 
        ? entityMatch[1] 
        : `${entityMatch[1]}:*`;
    }

    // Parse actor references
    if (lowerQ.includes('i did') || lowerQ.includes('my ')) {
      query.actor = 'ai-agent';
    }

    return query;
  }

  private createQuerySummary(
    query: MemoryQuery,
    sessions: SessionInfo[],
    changes: StateChange[]
  ): string {
    const lines: string[] = [];
    
    lines.push(`Memory Query Results`);
    lines.push(`====================`);
    lines.push(`Found ${changes.length} changes across ${sessions.length} sessions`);
    
    if (query.timeRange) {
      lines.push(`Time range: ${query.timeRange.start} to ${query.timeRange.end}`);
    }
    
    if (query.entityPattern) {
      lines.push(`Entity pattern: ${query.entityPattern}`);
    }

    if (changes.length > 0) {
      lines.push(``);
      lines.push(`Recent changes:`);
      for (const change of changes.slice(-5)) {
        lines.push(`  - ${change.timestamp}: ${change.entity} (${change.actor})`);
      }
    }

    return lines.join('\n');
  }
}
