const fs = require('fs');
let content = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');

// 1. Fix SharedSession initialization
content = content.replace(
    "this.sharedSession = new SharedSession(this.statecli);",
    "this.sharedSession = new SharedSession({ namespace: config?.sessionNamespace || 'default' });"
);

// 2. Fix KnowledgeTracker method calls in the switch block
content = content.replace(
    "result = await this.knowledgeTracker.search(args as any);",
    "result = await this.knowledgeTracker.searchWeb((args as any).query);"
);
content = content.replace(
    "result = await this.knowledgeTracker.readUrl(args as any);",
    "result = await this.knowledgeTracker.readUrl((args as any).url);"
);

// 3. Fix SharedSession method calls in the switch block
content = content.replace(
    "result = await this.sharedSession.join(args as any);",
    "result = { content: [{ type: 'text', text: JSON.stringify(this.sharedSession.join(), null, 2) }] };"
);
content = content.replace(
    "result = await this.sharedSession.leave();",
    "this.sharedSession.leave();\n            result = { content: [{ type: 'text', text: 'Left shared session' }] };"
);

fs.writeFileSync('src/enhanced-mcp-server.ts', content);
console.log("Successfully fixed initialization and methods in enhanced-mcp-server.ts");
