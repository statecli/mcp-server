/**
 * StateCLI Shared Sessions
 * Allows multiple agents to coordinate under a shared namespace,
 * share checkpoints, and see each other's action history.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SharedSessionOptions {
  namespace: string;         // e.g. "team:project-alpha"
  dataDir?: string;          // defaults to ~/.statecli/shared
  agentId?: string;          // unique ID for this agent instance
}

export interface SessionMember {
  agent_id: string;
  joined_at: number;
  last_seen: number;
  checkpoint_count: number;
}

export interface SharedCheckpoint {
  namespace: string;
  agent_id: string;
  name: string;
  entity: string;
  state: any;
  timestamp: number;
}

export class SharedSession {
  private namespace: string;
  private agentId: string;
  private sessionDir: string;
  private membersFile: string;
  private checkpointsFile: string;

  constructor(opts: SharedSessionOptions) {
    this.namespace = opts.namespace;
    this.agentId = opts.agentId || `agent-${Date.now()}`;
    const baseDir = opts.dataDir || path.join(os.homedir(), '.statecli', 'shared');
    // Sanitize namespace for use as directory name
    const safeName = this.namespace.replace(/[^a-zA-Z0-9\-_]/g, '_');
    this.sessionDir = path.join(baseDir, safeName);
    this.membersFile = path.join(this.sessionDir, 'members.json');
    this.checkpointsFile = path.join(this.sessionDir, 'checkpoints.json');
    fs.mkdirSync(this.sessionDir, { recursive: true });
  }

  // ─── Members ─────────────────────────────────────────────────

  join(): SessionMember {
    const members = this.readMembers();
    const existing = members.find(m => m.agent_id === this.agentId);
    if (existing) {
      existing.last_seen = Date.now();
    } else {
      members.push({
        agent_id: this.agentId,
        joined_at: Date.now(),
        last_seen: Date.now(),
        checkpoint_count: 0,
      });
    }
    this.writeMembers(members);
    return members.find(m => m.agent_id === this.agentId)!;
  }

  leave(): void {
    const members = this.readMembers().filter(m => m.agent_id !== this.agentId);
    this.writeMembers(members);
  }

  listMembers(): SessionMember[] {
    const now = Date.now();
    // Members are considered "active" if seen within last 5 minutes
    return this.readMembers().filter(m => now - m.last_seen < 300_000);
  }

  // ─── Shared Checkpoints ───────────────────────────────────────

  saveCheckpoint(entity: string, name: string, state: any): SharedCheckpoint {
    const checkpoints = this.readCheckpoints();
    const cp: SharedCheckpoint = {
      namespace: this.namespace,
      agent_id: this.agentId,
      name,
      entity,
      state,
      timestamp: Date.now(),
    };
    checkpoints.push(cp);
    this.writeCheckpoints(checkpoints);

    // Update member checkpoint count
    const members = this.readMembers();
    const member = members.find(m => m.agent_id === this.agentId);
    if (member) { member.checkpoint_count++; member.last_seen = Date.now(); }
    this.writeMembers(members);
    return cp;
  }

  listCheckpoints(entity?: string): SharedCheckpoint[] {
    const all = this.readCheckpoints();
    return entity ? all.filter(c => c.entity === entity) : all;
  }

  getLatestCheckpoint(entity: string): SharedCheckpoint | null {
    const cps = this.listCheckpoints(entity);
    if (!cps.length) return null;
    return cps.sort((a, b) => b.timestamp - a.timestamp)[0];
  }

  // ─── Shared History ───────────────────────────────────────────

  getSharedHistory(): { members: SessionMember[]; checkpoints: SharedCheckpoint[] } {
    return {
      members: this.listMembers(),
      checkpoints: this.readCheckpoints().slice(-100),
    };
  }

  // ─── Private Helpers ─────────────────────────────────────────

  private readMembers(): SessionMember[] {
    try {
      return JSON.parse(fs.readFileSync(this.membersFile, 'utf-8'));
    } catch { return []; }
  }

  private writeMembers(members: SessionMember[]) {
    fs.writeFileSync(this.membersFile, JSON.stringify(members, null, 2));
  }

  private readCheckpoints(): SharedCheckpoint[] {
    try {
      return JSON.parse(fs.readFileSync(this.checkpointsFile, 'utf-8'));
    } catch { return []; }
  }

  private writeCheckpoints(checkpoints: SharedCheckpoint[]) {
    fs.writeFileSync(this.checkpointsFile, JSON.stringify(checkpoints, null, 2));
  }
}
