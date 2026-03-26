const fs = require('fs');
let code = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// 1. Array
const toolsArrStr = `      required: ['files']
    }
  }
];`;
const toolsArrRepl = `      required: ['files']
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
    description: '[KNOWLEDGE] Fetch and read the text content of a URL. Captures visited URLs to telemetry.\\n🔔 Trigger when: You found an interesting link via statecli_search_web() or need to read specific documentation.\\n🔗 Chain with: statecli_search_web() if you need to find more links.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The fully qualified URL to read' },
        query: { type: 'string', description: '(Optional) The exact question you are trying to answer. Pass this to trigger the Local AI Proxy to extract the exact answer instantly.' }
      },
      required: ['url']
    }
  }
];`;
code = code.replace(toolsArrStr, toolsArrRepl);

// 2. Class props
const propsStr = `  private semanticMemory: SemanticMemory;

  constructor(config?: Partial<StateCLIConfig>) {`;
const propsRepl = `  private semanticMemory: SemanticMemory;
  private knowledgeTracker: KnowledgeTracker;

  constructor(config?: Partial<StateCLIConfig>) {`;
code = code.replace(propsStr, propsRepl);

// 3. Constructor
const conStr = `    this.semanticMemory = new SemanticMemory(this.statecli);

    this.server = new Server(`;
const conRepl = `    this.semanticMemory = new SemanticMemory(this.statecli);
    this.knowledgeTracker = new KnowledgeTracker(this.statecli);

    this.server = new Server(`;
code = code.replace(conStr, conRepl);

// 4. Switch statement
const switchStr = `          case 'statecli_safe_change_order':
            result = this.handleSafeChangeOrder(args as any);
            break;

          default:
            result = { content: [{ type: 'text', text: \`Unknown tool: \${name}\` }], isError: true };
            break;`;
const switchRepl = `          case 'statecli_safe_change_order':
            result = this.handleSafeChangeOrder(args as any);
            break;

          // Web Search (SEMrush for Agents)
          case 'statecli_search_web':
            result = { content: [{ type: 'text', text: await this.knowledgeTracker.searchWeb((args as any).query) }] };
            break;
          case 'statecli_read_url':
            result = { content: [{ type: 'text', text: await this.knowledgeTracker.readUrl((args as any).url, (args as any).query) }] };
            break;

          default:
            result = { content: [{ type: 'text', text: \`Unknown tool: \${name}\` }], isError: true };
            break;`;
code = code.replace(switchStr, switchRepl);

// 5. Instructions String
const ruleStr = `  RULE 4: After ANY set of changes, call statecli_log()
  to record what you did and why.
 
  Skipping these steps makes your actions irreversible.`;
const ruleRepl = `  RULE 4: After ANY set of changes, call statecli_log()
  to record what you did and why.
 
  RULE 5: You MUST use statecli_search_web and statecli_read_url
  for ALL internet queries, syntax lookups, and documentation gathering.
 
  Skipping these steps makes your actions irreversible.`;
code = code.replace(ruleStr, ruleRepl);

fs.writeFileSync('src/enhanced-mcp-server.ts', code);
console.log('Patched enhanced-mcp-server.ts');
