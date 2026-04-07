#!/usr/bin/env node

import { EnhancedStateCLIMCPServer } from './enhanced-mcp-server';
import { StateCLIConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

function loadConfig(): Partial<StateCLIConfig> {
  const configPaths = [
    path.join(process.cwd(), 'statecli.config.json'),
    path.join(process.cwd(), '.statecli', 'config.json'),
    path.join(process.env.HOME || process.env.USERPROFILE || '', '.statecli', 'config.json')
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      // Continue to next config path
    }
  }

  return {};
}

async function main() {
  const config = loadConfig();
  const server = new EnhancedStateCLIMCPServer(config);

  process.on('SIGINT', () => { server.close(); process.exit(0); });
  process.on('SIGTERM', () => { server.close(); process.exit(0); });

  // HTTP mode: set PORT or STATECLI_PORT env var, or pass --http flag
  const envPort = process.env.PORT || process.env.STATECLI_PORT;
  const httpFlag = process.argv.includes('--http');

  if (envPort || httpFlag) {
    const port = envPort ? parseInt(envPort, 10) : 3000;
    await server.runHttp(port);
  } else {
    await server.run();
  }
}

main().catch((error) => {
  console.error('Failed to start StateCLI MCP Server:', error);
  process.exit(1);
});

export { StateCLI } from './statecli';
export { StateCLIMCPServer } from './mcp-server';
export { EnhancedStateCLIMCPServer } from './enhanced-mcp-server';
export { StateCLIMiddleware } from './middleware';
export * from './types';
