/**
 * Enhanced MCP Server - All advanced StateCLI tools
 * 
 * Includes: file tracking, error recovery, session memory, git integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
import { StateCLI } from './statecli';
import { FileTracker } from './file-tracker';
import { ErrorRecovery } from './error-recovery';
import { SessionMemory } from './session-memory';
import { GitIntegration } from './git-integration';
import { StateCLIConfig } from './types';

const ENHANCED_TOOLS: Tool[] = [
  // Original tools
  {
    name: 'statecli_replay',
    description: 'Replay state changes for an entity. Shows step-by-step what happened with diffs.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity identifier (e.g., "order:7421", "file:src/index.ts")' },
        actor: { type: 'string', description: 'Optional: filter by actor' }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_undo',
    description: 'Undo state changes. Rollback when something went wrong.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity identifier' },
        steps: { type: 'number', description: 'How many steps to undo (default: 1)' }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_checkpoint',
    description: 'Create named checkpoint before making changes. Use before risky operations.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity identifier' },
        name: { type: 'string', description: 'Checkpoint name' }
      },
      required: ['entity', 'name']
    }
  },
  {
    name: 'statecli_log',
    description: 'View state change history for an entity.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity identifier or pattern (e.g., "order:*")' },
        since: { type: 'string', description: 'Time filter (e.g., "1h ago", "24h ago")' },
        actor: { type: 'string', description: 'Filter by actor' }
      },
      required: ['entity']
    }
  },
  {
    name: 'statecli_track',
    description: 'Explicitly track a state change.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', description: 'Type of entity' },
        entity_id: { type: 'string', description: 'Entity ID' },
        state: { type: 'object', description: 'State to track' },
        actor: { type: 'string', description: 'Who is making this change' }
      },
      required: ['entity_type', 'entity_id', 'state']
    }
  },
  
  // NEW: File tracking tools
  {
    name: 'statecli_track_file',
    description: 'Track a file edit with before/after content. Auto-generates diff.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file' },
        before_content: { type: 'string', description: 'Content before edit' },
        after_content: { type: 'string', description: 'Content after edit' },
        actor: { type: 'string', description: 'Who made the edit' }
      },
      required: ['file_path', 'before_content', 'after_content']
    }
  },
  {
    name: 'statecli_file_history',
    description: 'Get change history for a specific file.',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file' }
      },
      required: ['file_path']
    }
  },

  // NEW: Error recovery tools
  {
    name: 'statecli_analyze_error',
    description: 'Analyze an error and get recovery suggestions. Use when something goes wrong.',
    inputSchema: {
      type: 'object',
      properties: {
        error_message: { type: 'string', description: 'The error message' },
        error_type: { type: 'string', description: 'Type of error (optional)' },
        affected_entities: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Entities that might be affected'
        }
      },
      required: ['error_message']
    }
  },
  {
    name: 'statecli_auto_recover',
    description: 'Automatically recover from an error using the best suggestion.',
    inputSchema: {
      type: 'object',
      properties: {
        error_message: { type: 'string', description: 'The error message' },
        affected_entities: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Entities that might be affected'
        }
      },
      required: ['error_message']
    }
  },
  {
    name: 'statecli_safe_execute',
    description: 'Create checkpoint, execute operation, auto-rollback on error.',
    inputSchema: {
      type: 'object',
      properties: {
        entity: { type: 'string', description: 'Entity to checkpoint' },
        operation_name: { type: 'string', description: 'Name of the operation' }
      },
      required: ['entity', 'operation_name']
    }
  },

  // NEW: Session memory tools
  {
    name: 'statecli_memory_query',
    description: 'Query memory across sessions. Ask about past actions.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question (e.g., "What did I change yesterday?")' },
        entity_pattern: { type: 'string', description: 'Entity pattern to filter' },
        hours_ago: { type: 'number', description: 'Look back this many hours' }
      },
      required: []
    }
  },
  {
    name: 'statecli_recent_activity',
    description: 'Get summary of recent activity.',
    inputSchema: {
      type: 'object',
      properties: {
        hours: { type: 'number', description: 'How many hours to look back (default: 24)' }
      },
      required: []
    }
  },
  {
    name: 'statecli_session_info',
    description: 'Get information about current and past sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Specific session ID (optional)' }
      },
      required: []
    }
  },

  // NEW: Git integration tools  
  {
    name: 'statecli_git_status',
    description: 'Get current git status and track it.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'statecli_git_history',
    description: 'Compare changes between two commits.',
    inputSchema: {
      type: 'object',
      properties: {
        from_commit: { type: 'string', description: 'Starting commit hash' },
        to_commit: { type: 'string', description: 'Ending commit hash (default: HEAD)' }
      },
      required: ['from_commit']
    }
  },
  {
    name: 'statecli_git_checkpoint',
    description: 'Create a checkpoint at current git state.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Checkpoint name' }
      },
      required: []
    }
  }
];

export class EnhancedStateCLIMCPServer {
  private server: Server;
  private statecli: StateCLI;
  private fileTracker: FileTracker;
  private errorRecovery: ErrorRecovery;
  private sessionMemory: SessionMemory;
  private gitIntegration: GitIntegration;

  constructor(config?: Partial<StateCLIConfig>) {
    this.statecli = new StateCLI(config);
    this.fileTracker = new FileTracker(this.statecli);
    this.errorRecovery = new ErrorRecovery(this.statecli);
    this.sessionMemory = new SessionMemory(this.statecli);
    this.gitIntegration = new GitIntegration(this.statecli);
    
    this.server = new Server(
      { name: 'statecli-enhanced', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: ENHANCED_TOOLS };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          // Original tools
          case 'statecli_replay':
            return this.handleReplay(args as any);
          case 'statecli_undo':
            return this.handleUndo(args as any);
          case 'statecli_checkpoint':
            return this.handleCheckpoint(args as any);
          case 'statecli_log':
            return this.handleLog(args as any);
          case 'statecli_track':
            return this.handleTrack(args as any);

          // File tracking
          case 'statecli_track_file':
            return this.handleTrackFile(args as any);
          case 'statecli_file_history':
            return this.handleFileHistory(args as any);

          // Error recovery
          case 'statecli_analyze_error':
            return this.handleAnalyzeError(args as any);
          case 'statecli_auto_recover':
            return this.handleAutoRecover(args as any);
          case 'statecli_safe_execute':
            return this.handleSafeExecute(args as any);

          // Session memory
          case 'statecli_memory_query':
            return this.handleMemoryQuery(args as any);
          case 'statecli_recent_activity':
            return this.handleRecentActivity(args as any);
          case 'statecli_session_info':
            return this.handleSessionInfo(args as any);

          // Git integration
          case 'statecli_git_status':
            return this.handleGitStatus();
          case 'statecli_git_history':
            return this.handleGitHistory(args as any);
          case 'statecli_git_checkpoint':
            return this.handleGitCheckpoint(args as any);

          default:
            return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
      }
    });
  }

  // Original tool handlers
  private handleReplay(args: { entity: string; actor?: string }) {
    const result = this.statecli.replay(args.entity, { actor: args.actor });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleUndo(args: { entity: string; steps?: number }) {
    const result = this.statecli.undo(args.entity, args.steps || 1);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleCheckpoint(args: { entity: string; name: string }) {
    const result = this.statecli.checkpoint(args.entity, args.name);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleLog(args: { entity: string; since?: string; actor?: string }) {
    const result = this.statecli.log(args.entity, { since: args.since, actor: args.actor });
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleTrack(args: { entity_type: string; entity_id: string; state: any; actor?: string }) {
    const result = this.statecli.track(args.entity_type, args.entity_id, args.state, args.actor || 'ai-agent');
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  // File tracking handlers
  private handleTrackFile(args: { file_path: string; before_content: string; after_content: string; actor?: string }) {
    const result = this.fileTracker.trackEdit(args.file_path, args.before_content, args.after_content, args.actor);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleFileHistory(args: { file_path: string }) {
    const result = this.fileTracker.getFileHistory(args.file_path);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  // Error recovery handlers
  private handleAnalyzeError(args: { error_message: string; error_type?: string; affected_entities?: string[] }) {
    const error = new Error(args.error_message);
    if (args.error_type) error.name = args.error_type;
    const result = this.errorRecovery.analyzeError(error, args.affected_entities || []);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleAutoRecover(args: { error_message: string; affected_entities?: string[] }) {
    const analysis = this.errorRecovery.analyzeError(new Error(args.error_message), args.affected_entities || []);
    const result = this.errorRecovery.autoRecover(analysis);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleSafeExecute(args: { entity: string; operation_name: string }) {
    // Create checkpoint - the actual execution would be done by the caller
    const checkpoint = this.statecli.checkpoint(args.entity, `before-${args.operation_name}`);
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({
          checkpoint_created: true,
          checkpoint_id: checkpoint.id,
          entity: args.entity,
          operation: args.operation_name,
          message: `Checkpoint created. Proceed with ${args.operation_name}. Call statecli_undo if it fails.`
        }, null, 2) 
      }] 
    };
  }

  // Session memory handlers
  private handleMemoryQuery(args: { question?: string; entity_pattern?: string; hours_ago?: number }) {
    let result;
    if (args.question) {
      result = this.sessionMemory.ask(args.question);
    } else if (args.hours_ago) {
      result = this.sessionMemory.getRecentActivity(args.hours_ago);
    } else if (args.entity_pattern) {
      result = this.sessionMemory.getEntityHistory(args.entity_pattern);
    } else {
      result = this.sessionMemory.getRecentActivity(24);
    }
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleRecentActivity(args: { hours?: number }) {
    const result = this.sessionMemory.getRecentActivity(args.hours || 24);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleSessionInfo(args: { session_id?: string }) {
    if (args.session_id) {
      const result = this.sessionMemory.getSession(args.session_id);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } else {
      const sessions = this.sessionMemory.getSessions();
      const currentId = this.sessionMemory.getSessionId();
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ currentSession: currentId, recentSessions: sessions.slice(0, 10) }, null, 2) 
        }] 
      };
    }
  }

  // Git integration handlers
  private handleGitStatus() {
    if (!this.gitIntegration.isGitRepo()) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Not a git repository' }) }] };
    }
    
    const status = {
      branch: this.gitIntegration.getCurrentBranch(),
      commit: this.gitIntegration.getCurrentCommit(),
      uncommittedChanges: this.gitIntegration.getUncommittedChanges(),
      recentCommits: this.gitIntegration.getRecentCommits(5)
    };
    
    this.gitIntegration.trackGitState();
    return { content: [{ type: 'text', text: JSON.stringify(status, null, 2) }] };
  }

  private handleGitHistory(args: { from_commit: string; to_commit?: string }) {
    const toCommit = args.to_commit || 'HEAD';
    const result = this.gitIntegration.getCommitHistory(args.from_commit, toCommit);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  private handleGitCheckpoint(args: { name?: string }) {
    const result = this.gitIntegration.createGitCheckpoint(args.name);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('StateCLI Enhanced MCP Server running on stdio');
  }

  close(): void {
    this.sessionMemory.endSession();
    this.statecli.close();
  }
}
