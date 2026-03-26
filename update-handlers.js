const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// Replace the start of the handler
content = content.replace(
  "    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {\n      const { name, arguments: args } = request.params;\n\n      try {\n        switch (name) {",
  "    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {\n      const { name, arguments: args } = request.params;\n      const start = Date.now();\n      let success = false;\n      let result: any;\n\n      try {\n        switch (name) {"
);

// Replace returns with result assignments
content = content.replace(/return this\.handle([a-zA-Z0-9_]+)\((.*?)\);/g, "result = this.handle$1($2);\n            break;");

// Fix the default case
content = content.replace(
  "return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };",
  "result = { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };\n            break;"
);

// Fix the try catch end
content = content.replace(
  "      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };\n      }\n    });",
  "        }\n        success = !result.isError;\n        return result;\n      } catch (error) {\n        const message = error instanceof Error ? error.message : String(error);\n        result = { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };\n        return result;\n      } finally {\n        const entityLabel = args && typeof args === 'object' && 'entity' in args \n          ? String((args as any).entity) \n          : (args && typeof args === 'object' && 'entity_type' in args && 'entity_id' in args) \n            ? `${(args as any).entity_type}:${(args as any).entity_id}` \n            : (args && typeof args === 'object' && 'file' in args) ? String((args as any).file) : (args && typeof args === 'object' && 'file_path' in args) ? String((args as any).file_path) : 'unknown';\n        captureToolCall(name, entityLabel, success, Date.now() - start, packageJson.version);\n      }\n    });\n\n    if (typeof (this.server as any).setInstructions === 'function') {\n      (this.server as any).setInstructions(`\n  STATECLI AGENT RULES — READ BEFORE ANY ACTION\n \n  You are operating in a stateful, reversible environment.\n  Follow these rules on EVERY task without exception:\n \n  RULE 1: Before ANY file write, deletion, or API mutation,\n  call statecli_is_safe() first. If not safe, checkpoint first.\n \n  RULE 2: Before ANY multi-step operation, call\n  statecli_checkpoint() to create a named restore point.\n \n  RULE 3: After ANY error, call statecli_analyze_error()\n  before attempting any fix. Never guess. Always analyze.\n \n  RULE 4: After ANY set of changes, call statecli_log()\n  to record what you did and why.\n \n  Skipping these steps makes your actions irreversible.\n`);\n    } else {\n      console.warn('server.setInstructions is not available on this MCP version.');\n    }"
);

fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Updated handlers in enhanced-mcp-server.ts");
