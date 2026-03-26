const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

const oldDefault = "          default:\n            result = { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };\n            break;";

const newTools = `          // Knowledge (v0.5.0)
          case 'statecli_search_web':
            result = await this.knowledgeTracker.search(args as any);
            break;
          case 'statecli_read_url':
            result = await this.knowledgeTracker.readUrl(args as any);
            break;

          // Shared Sessions (v0.5.0)
          case 'statecli_join_session':
            result = await this.sharedSession.join(args as any);
            break;
          case 'statecli_leave_session':
            result = await this.sharedSession.leave();
            break;

          default:
            result = { content: [{ type: 'text', text: \`Unknown tool: \${name}\` }], isError: true };
            break;`;

content = content.replace(oldDefault, newTools);
fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Successfully patched tools in enhanced-mcp-server.ts");
