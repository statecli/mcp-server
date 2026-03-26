const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// Use regex to find the end of the switch block before default
const switchEndRegex = /(case 'statecli_safe_change_order':[\s\S]*?break;)/;

const newTools = `$1

          // Knowledge (v0.5.0)
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
            break;`;

if (switchEndRegex.test(content)) {
    content = content.replace(switchEndRegex, newTools);
    fs.writeFileSync('src/enhanced-mcp-server.ts', content);
    console.log("Successfully regex-patched tools in enhanced-mcp-server.ts");
} else {
    console.error("Could not find the insertion point for tool handlers");
    process.exit(1);
}
