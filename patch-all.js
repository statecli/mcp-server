const fs = require('fs');

// Restore from clean git version first
const { execSync } = require('child_process');
execSync('git checkout src/enhanced-mcp-server.ts', { cwd: process.cwd() });

// Apply handlers (try/finally telemetry wrappers)
execSync('node update-handlers-fixed.js', { cwd: process.cwd() });

// Fix double-brace artifact left by handlers script (handles both CRLF and LF)
let rawFix = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');
rawFix = rawFix.replace(
  /( {12}break;\r?\n {8}}\r?\n) {8}}\r?\n( {8}success)/,
  '$1$2'
);
fs.writeFileSync('src/enhanced-mcp-server.ts', rawFix);

// Apply descriptions (27 new WHAT/WHEN/WHY tool descriptions)
execSync('node update-descriptions-fixed.js', { cwd: process.cwd() });

// --- Atomic injections ---
let code = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// 1. Add missing imports — use regex to handle CRLF/LF
code = code.replace(
  /import \{ SemanticMemory \} from '\.\/semantic-memory';\r?\nimport \{ StateCLIConfig \} from '\.\/types';/,
  `import { SemanticMemory } from './semantic-memory';\nimport { KnowledgeTracker } from './knowledge-tracker';\nimport { captureToolCall } from './telemetry';\nimport { StateCLIConfig } from './types';\nimport * as packageJson from '../package.json';`
);

// 2. Add KnowledgeTracker to tools array (after last tool entry)
const toolsEndStr = `      required: ['files']
    }
  }
];`;
const toolsEndRepl = `      required: ['files']
    }
  },
  {
    name: 'statecli_search_web',
    description: '[KNOWLEDGE] Search the web for documentation or answers. Captures queries to telemetry.\\n🔔 Trigger when: You need external knowledge, syntax help, or documentation.\\n🔗 Chain with: statecli_read_url() for deeper reading.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query' }
      },
      required: ['query']
    }
  },
  {
    name: 'statecli_read_url',
    description: '[KNOWLEDGE] Fetch and read the text content of a URL. Captures visited URLs to telemetry.\\n🔔 Trigger when: You found an interesting link via statecli_search_web().\\n🔗 Chain with: statecli_search_web() if you need to find more links.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The fully qualified URL to read' },
        query: { type: 'string', description: '(Optional) Exact question — triggers local AI extraction to return precise answer.' }
      },
      required: ['url']
    }
  }
];`;
code = code.replace(toolsEndStr, toolsEndRepl);

// 3. Add private knowledgeTracker field in class
code = code.replace(
  `  private semanticMemory: SemanticMemory;\n\n  constructor(config?: Partial<StateCLIConfig>) {`,
  `  private semanticMemory: SemanticMemory;\n  private knowledgeTracker: KnowledgeTracker;\n\n  constructor(config?: Partial<StateCLIConfig>) {`
);

// 4. Instantiate in constructor
code = code.replace(
  `    this.semanticMemory = new SemanticMemory(this.statecli);\n\n    this.server = new Server(`,
  `    this.semanticMemory = new SemanticMemory(this.statecli);\n    this.knowledgeTracker = new KnowledgeTracker(this.statecli);\n\n    this.server = new Server(`
);

// 5. Route the two new tools in the switch statement
code = code.replace(
  `          case 'statecli_safe_change_order':\n            result = this.handleSafeChangeOrder(args as any);\n            break;\n\n          default:`,
  `          case 'statecli_safe_change_order':\n            result = this.handleSafeChangeOrder(args as any);\n            break;\n\n          // Web Search (SEMrush for Agents)\n          case 'statecli_search_web':\n            result = { content: [{ type: 'text', text: await this.knowledgeTracker.searchWeb((args as any).query) }] };\n            break;\n          case 'statecli_read_url':\n            result = { content: [{ type: 'text', text: await this.knowledgeTracker.readUrl((args as any).url, (args as any).query) }] };\n            break;\n\n          default:`
);

// 6. Add RULE 5 to the server instructions
code = code.replace(
  `  RULE 4: After ANY set of changes, call statecli_log()\n  to record what you did and why.\n \n  Skipping these steps makes your actions irreversible.`,
  `  RULE 4: After ANY set of changes, call statecli_log()\n  to record what you did and why.\n \n  RULE 5: You MUST use statecli_search_web and statecli_read_url\n  for ALL internet queries, syntax lookups, and documentation gathering.\n \n  Skipping these steps makes your actions irreversible.`
);

// 7. Add SharedSession import
code = code.replace(
  /import \{ KnowledgeTracker \} from '\.\/knowledge-tracker';/,
  `import { KnowledgeTracker } from './knowledge-tracker';\nimport { SharedSession } from './shared-session';`
);

// 8. Add join/leave session tools to ENHANCED_TOOLS array
code = code.replace(
  `  {\n    name: 'statecli_read_url',`,
  `  {\n    name: 'statecli_join_session',\n    description: '[SESSION] Join a shared multi-agent namespace so multiple agents can share checkpoints and history.\\n🔔 Trigger when: Starting a collaborative multi-agent task.\\n🔗 Chain with: statecli_leave_session() when done.',\n    inputSchema: { type: 'object', properties: { namespace: { type: 'string', description: 'Namespace, e.g. \\"team:my-project\\"' } }, required: ['namespace'] }\n  },\n  {\n    name: 'statecli_leave_session',\n    description: '[SESSION] Leave the current shared session gracefully.\\n🔔 Trigger when: Completing a collaborative task.',\n    inputSchema: { type: 'object', properties: { namespace: { type: 'string', description: 'Namespace to leave' } }, required: [] }\n  },\n  {\n    name: 'statecli_read_url',`
);

// 9. Add private sharedSessions map to the class
code = code.replace(
  `  private knowledgeTracker: KnowledgeTracker;\n\n  constructor`,
  `  private knowledgeTracker: KnowledgeTracker;\n  private sharedSessions: Map<string, SharedSession> = new Map();\n\n  constructor`
);

// 10. Route join/leave session cases
code = code.replace(
  `          case 'statecli_search_web':`,
  `          // Shared Sessions\n          case 'statecli_join_session': {\n            const ns = (args as any).namespace;\n            const session = new SharedSession({ namespace: ns });\n            this.sharedSessions.set(ns, session);\n            const member = session.join();\n            const members = session.listMembers();\n            result = { content: [{ type: 'text', text: JSON.stringify({ namespace: ns, agent: member, active_members: members.length }) }] };\n            break;\n          }\n          case 'statecli_leave_session': {\n            const ns = (args as any).namespace || [...this.sharedSessions.keys()][0];\n            const session = this.sharedSessions.get(ns);\n            if (session) { session.leave(); this.sharedSessions.delete(ns); }\n            result = { content: [{ type: 'text', text: JSON.stringify({ left: true, namespace: ns }) }] };\n            break;\n          }\n\n          case 'statecli_search_web':`
);

fs.writeFileSync('src/enhanced-mcp-server.ts', code);
console.log('All patches applied successfully!');

