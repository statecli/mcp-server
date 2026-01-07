import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { StateCLI } from './statecli';
import { StateCLIConfig } from './types';

const TOOLS: Tool[] = [
  {
    name: 'statecli_replay',
    description: 'Replay state changes for an entity. Shows step-by-step what happened. Use when debugging, understanding past behavior, or finding errors.',
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
    description: 'Undo state changes. Rollback when something went wrong. Use when you made a mistake, need to retry, or want to revert.',
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
    description: 'Create named checkpoint before making changes. Use when about to do something risky or want a rollback point.',
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
    description: 'View state change history for an entity. Use when you need to see past actions, audit trail, or understand behavior.',
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
    description: 'Explicitly track a state change. Use when making important state modifications.',
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

      try {
        switch (name) {
          case 'statecli_replay':
            return this.handleReplay(args as { entity: string; actor?: string });
          
          case 'statecli_undo':
            return this.handleUndo(args as { entity: string; steps?: number });
          
          case 'statecli_checkpoint':
            return this.handleCheckpoint(args as { entity: string; name: string });
          
          case 'statecli_log':
            return this.handleLog(args as { entity: string; since?: string; actor?: string });
          
          case 'statecli_track':
            return this.handleTrack(args as { 
              entity_type: string; 
              entity_id: string; 
              state: Record<string, unknown>;
              actor?: string;
            });
          
          default:
            return {
              content: [{ type: 'text', text: `Unknown tool: ${name}` }],
              isError: true
            };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text', text: `Error: ${message}` }],
          isError: true
        };
      }
    });
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
