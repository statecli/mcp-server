#!/usr/bin/env node
/**
 * StateCLI Enhanced MCP Server Entry Point
 * 
 * Includes all advanced features:
 * - File tracking with diffs
 * - Error recovery and auto-rollback
 * - Session memory and cross-session queries
 * - Git integration
 */

import { EnhancedStateCLIMCPServer } from './enhanced-mcp-server';

const server = new EnhancedStateCLIMCPServer();

process.on('SIGINT', () => {
  server.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.close();
  process.exit(0);
});

server.run().catch((error) => {
  console.error('Failed to start enhanced server:', error);
  process.exit(1);
});
