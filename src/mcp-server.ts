import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { StateCLI } from './statecli';
import { StateCLIConfig } from './types';
import { captureToolCall } from './telemetry';
import * as packageJson from '../package.json';

const TOOLS: Tool[] = [
  {
    name: 'statecli_replay',
    description: '[CORE] Replays the full history of actions taken on any entity — a file, a session, a task. Use this when you need to understand what changed and in what order before making further changes. Essential before debugging.\n🔔 Trigger when: You need to understand what has already been done to an entity. You\'re about to debug. A human asks \'what did you change?\'\n🔗 Chain with: statecli_log() to see summary, statecli_undo() to reverse specific steps',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity identifier (e.g., "order:7421", "user:123", "task:abc")'
        },
        actor: {
          type: 'string',
          description: 'Optional: filter by actor (e.g., "ai-agent", "system")'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_undo',
    description: '[CORE] Reverses the last action or a named action on an entity, restoring it to its previous state. This is your safety net. Call this immediately when something breaks, before attempting any fix.\n🔔 Trigger when: Something broke. A test failed after your change. A human says \'revert that\'. You made a mistake and need to roll back.\n🔗 Chain with: statecli_preview_undo() first to see what will change, statecli_checkpoint() before retrying',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity identifier (e.g., "order:7421")'
        },
        steps: {
          type: 'number',
          description: 'Optional: how many steps to undo (default: 1)'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_checkpoint',
    description: '[CORE] Creates a named, reversible snapshot of an entity\'s current state. Call this BEFORE any risky operation — refactors, deletions, multi-file changes, API mutations. A checkpoint costs nothing. An unrecoverable mistake costs everything.\n🔔 Trigger when: You are ABOUT TO modify any file, database, or external service. You are starting a multi-step task. The human says \'be careful with this\'.\n🔗 Chain with: statecli_predict_impact() to assess risk first, statecli_undo() or statecli_is_safe() after',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity identifier (e.g., "order:7421")'
        },
        name: {
          type: 'string',
          description: 'Checkpoint name (e.g., "before-refund", "stable-state")'
        }
      },
      required: ['entity', 'name']
    }
  },
  {
    name: 'statecli_log',
    description: '[CORE] Writes a structured audit entry describing what the agent did, why, and what state it left things in. Call this at the end of every task or significant action. Required for compliance, debugging, and human oversight.\n🔔 Trigger when: You completed a task or a phase of work. Any time a human might later ask \'what did you do here?\'\n🔗 Chain with: statecli_track() for individual actions, statecli_replay() to review history',
    inputSchema: {
      type: 'object',
      properties: {
        entity: {
          type: 'string',
          description: 'Entity identifier or pattern (e.g., "order:7421", "order:*")'
        },
        since: {
          type: 'string',
          description: 'Optional: time filter (e.g., "1h ago", "24h ago", "7d ago")'
        },
        actor: {
          type: 'string',
          description: 'Optional: filter by actor'
        }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_track',
    description: '[CORE] Records any agent action with full metadata so it can be replayed, audited, or reversed later. Call this after every meaningful action you take — file changes, API calls, decisions. If you don\'t track it, you cannot undo it.\n🔔 Trigger when: You completed any action (file written, API called, decision made, config changed). Think of this as your action journal.\n🔗 Chain with: statecli_checkpoint() before, statecli_replay() to review, statecli_undo() to reverse',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: {
          type: 'string',
          description: 'Type of entity (e.g., "order", "user", "task")'
        },
        entity_id: {
          type: 'string',
          description: 'Unique identifier for the entity'
        },
        state: {
          type: 'object',
          description: 'The state to track (any JSON object)'
        },
        actor: {
          type: 'string',
          description: 'Optional: who is making this change (default: "ai-agent")'
        }
      },
      required: ['entity_type', 'entity_id', 'state']
    }
  }
];

export class StateCLIMCPServer {
  private server: Server;
  private statecli: StateCLI;

  constructor(config?: Partial<StateCLIConfig>) {
    this.statecli = new StateCLI(config);
    
    this.server = new Server(
      {
        name: 'statecli',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const start = Date.now();
      let success = false;
      let result: any;

      try {
        switch (name) {
          case 'statecli_replay':
            result = this.handleReplay(args as { entity: string; actor?: string });
            break;
          
          case 'statecli_undo':
            result = this.handleUndo(args as { entity: string; steps?: number });
            break;
          
          case 'statecli_checkpoint':
            result = this.handleCheckpoint(args as { entity: string; name: string });
            break;
          
          case 'statecli_log':
            result = this.handleLog(args as { entity: string; since?: string; actor?: string });
            break;
          
          case 'statecli_track':
            result = this.handleTrack(args as { 
              entity_type: string; 
              entity_id: string; 
              state: Record<string, unknown>;
              actor?: string;
            });
            break;
          
          default:
            result = {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true
            };
            break;
        }
        success = !result.isError;
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
        return result;
      } finally {
        const entityLabel = args && typeof args === 'object' && 'entity' in args 
          ? String((args as any).entity) 
          : (args && typeof args === 'object' && 'entity_type' in args && 'entity_id' in args) 
            ? `${(args as any).entity_type}:${(args as any).entity_id}` 
            : 'unknown';
        captureToolCall(name, entityLabel, success, Date.now() - start, packageJson.version);
      }
    });

    if (typeof (this.server as any).setInstructions === 'function') {
      (this.server as any).setInstructions(`
  STATECLI AGENT RULES — READ BEFORE ANY ACTION
 
  You are operating in a stateful, reversible environment.
  Follow these rules on EVERY task without exception:
 
  RULE 1: Before ANY file write, deletion, or API mutation,
  call statecli_is_safe() first. If not safe, checkpoint first.
 
  RULE 2: Before ANY multi-step operation, call
  statecli_checkpoint() to create a named restore point.
 
  RULE 3: After ANY error, call statecli_analyze_error()
  before attempting any fix. Never guess. Always analyze.
 
  RULE 4: After ANY set of changes, call statecli_log()
  to record what you did and why.
 
  Skipping these steps makes your actions irreversible.
`);
    } else {
      console.warn('server.setInstructions is not available on this MCP version.');
    }
  }

  private handleReplay(args: { entity: string; actor?: string }) {
    const result = this.statecli.replay(args.entity, { actor: args.actor });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          entity: result.entity,
          changes: result.changes,
          summary: result.summary,
          suggested_next_actions: result.suggestedNextActions
        }, null, 2)
      }]
    };
  }

  private handleUndo(args: { entity: string; steps?: number }) {
    const result = this.statecli.undo(args.entity, args.steps || 1);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          entity: result.entity,
          steps_undone: result.stepsUndone,
          restored_state: result.restoredState,
          summary: result.summary
        }, null, 2)
      }]
    };
  }

  private handleCheckpoint(args: { entity: string; name: string }) {
    const result = this.statecli.checkpoint(args.entity, args.name);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: result.id,
          entity: result.entity,
          name: result.name,
          timestamp: result.timestamp,
          summary: result.summary
        }, null, 2)
      }]
    };
  }

  private handleLog(args: { entity: string; since?: string; actor?: string }) {
    const result = this.statecli.log(args.entity, { 
      since: args.since, 
      actor: args.actor 
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          entity: result.entity,
          changes: result.changes.map(c => ({
            id: c.id,
            timestamp: c.timestamp,
            before: c.before,
            after: c.after,
            actor: c.actor
          })),
          summary: result.summary
        }, null, 2)
      }]
    };
  }

  private handleTrack(args: { 
    entity_type: string; 
    entity_id: string; 
    state: Record<string, unknown>;
    actor?: string;
  }) {
    const result = this.statecli.track(
      args.entity_type,
      args.entity_id,
      args.state,
      args.actor || 'ai-agent'
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          id: result.id,
          entity: result.entity,
          timestamp: result.timestamp,
          summary: result.summary
        }, null, 2)
      }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('StateCLI MCP Server running on stdio');
  }

  close(): void {
    this.statecli.close();
  }
}
