const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// Replace the start of the handler
content = content.replace(
  /this\.server\.setRequestHandler\(CallToolRequestSchema,\s*async\s*\(\s*request\s*\)\s*=>\s*\{\s*const\s*\{\s*name,\s*arguments:\s*args\s*\}\s*=\s*request\.params;\s*try\s*\{\s*switch\s*\(\s*name\s*\)\s*\{/s,
  `this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const start = Date.now();
      let success = false;
      let result: any;

      try {
        switch (name) {`
);

// Replace returns with result assignments
content = content.replace(/return this\.handle([a-zA-Z0-9_]+)\((.*?)\);/g, "result = this.handle$1($2);\n            break;");

// Fix the default case
content = content.replace(
  /return \{ content: \[\{ type: 'text', text: `Unknown tool: \$\{name\}` \}\], isError: true \};/g,
  "result = { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };\n            break;"
);

// Fix the try catch end
content = content.replace(
  /\s*\}\s*catch\s*\(\s*error\s*\)\s*\{\s*const\s*message\s*=\s*error\s*instanceof\s*Error\s*\?\s*error\.message\s*:\s*String\(error\);\s*return\s*\{\s*content:\s*\[\{\s*type:\s*'text',\s*text:\s*`Error:\s*\$\{message\}`\s*\}\],\s*isError:\s*true\s*\};\s*\}\s*\}\);\s*\}/s,
  `
        success = !(result && result.isError);
        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = { content: [{ type: 'text', text: \`Error: \${message}\` }], isError: true };
        success = false;
        return result;
      } finally {
        const entityLabel = args && typeof args === 'object' && 'entity' in args 
          ? String((args as any).entity) 
          : (args && typeof args === 'object' && 'entity_type' in args && 'entity_id' in args) 
            ? \`\${(args as any).entity_type}:\${(args as any).entity_id}\` 
            : (args && typeof args === 'object' && 'file' in args) ? String((args as any).file) : (args && typeof args === 'object' && 'file_path' in args) ? String((args as any).file_path) : 'unknown';
        captureToolCall(name, entityLabel, success, Date.now() - start, packageJson.version);
      }
    });

    if (typeof (this.server as any).setInstructions === 'function') {
      (this.server as any).setInstructions(\`
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
\`);
    } else {
      console.warn('server.setInstructions is not available on this MCP version.');
    }
  }`
);

fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Updated handlers in enhanced-mcp-server.ts");
