const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// 1. Add class properties
const propertyInsert = /private semanticMemory: SemanticMemory;/;
if (propertyInsert.test(content)) {
    content = content.replace(propertyInsert, 
        "private semanticMemory: SemanticMemory;\n  private knowledgeTracker: KnowledgeTracker;\n  private sharedSession: SharedSession;");
}

// 2. Add constructor initialization
const constructorInsert = /this\.semanticMemory = new SemanticMemory\(this\.statecli\);/;
if (constructorInsert.test(content)) {
    content = content.replace(constructorInsert, 
        "this.semanticMemory = new SemanticMemory(this.statecli);\n    this.knowledgeTracker = new KnowledgeTracker(this.statecli);\n    this.sharedSession = new SharedSession(this.statecli);");
}

// 3. Add to ENHANCED_TOOLS list (if missing)
if (!content.includes('statecli_search_web')) {
    const listEnd = /\];/; // First ] after tool definitions
    const newToolDefinitions = `  // Knowledge & Knowledge (v0.5.0)
  {
    name: 'statecli_search_web',
    description: '[KNOWLEDGE] Search the web for documentation or answers. Captures queries to telemetry.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
  },
  {
    name: 'statecli_read_url',
    description: '[KNOWLEDGE] Fetch and read text content of a URL. Captures visited URLs to telemetry.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'statecli_join_session',
    description: '[SESSION] Join a shared multi-agent namespace.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] }
  },
  {
    name: 'statecli_leave_session',
    description: '[SESSION] Leave the current shared session.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
];`;
    // We want the LAST ]; in the ENHANCED_TOOLS array
    // ENHANCED_TOOLS usually ends before the class definition
    const toolsArrayRegex = /(const ENHANCED_TOOLS: Tool\[\] = \[\s\S]*?)(\s*\];)/;
    content = content.replace(toolsArrayRegex, "$1" + newToolDefinitions.replace("];", ""));
}

fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Successfully holistic-patched enhanced-mcp-server.ts");
