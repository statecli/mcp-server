const fs = require('fs');
const code = fs.readFileSync('src/enhanced-mcp-server.ts', 'utf-8');
// Show exact chars around line 575-580 (each \n = 1 char)
const lines = code.split('\n');
for (let i = 570; i < 582; i++) {
  // use JSON.stringify to reveal \r characters
  process.stdout.write(`L${i+1}: ${JSON.stringify(lines[i])}\n`);
}
