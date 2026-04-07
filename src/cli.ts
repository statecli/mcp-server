#!/usr/bin/env node

import { Command } from 'commander';
import { StateCLI } from './statecli';
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

const config = loadConfig();
const statecli = new StateCLI(config);

const program = new Command();

program
  .name('statecli')
  .description('State Replay & Self-Debugging CLI for AI Agents')
  .version('1.0.0');

program
  .command('replay <entity>')
  .description('Replay state changes for an entity')
  .option('-a, --actor <actor>', 'Filter by actor')
  .action((entity: string, options: { actor?: string }) => {
    const result = statecli.replay(entity, { actor: options.actor });
    console.log(JSON.stringify(result, null, 2));
    statecli.close();
  });

program
  .command('undo <entity>')
  .description('Undo state changes for an entity')
  .option('-s, --steps <steps>', 'Number of steps to undo', '1')
  .action((entity: string, options: { steps: string }) => {
    const result = statecli.undo(entity, parseInt(options.steps, 10));
    console.log(JSON.stringify(result, null, 2));
    statecli.close();
  });

program
  .command('checkpoint <entity> <name>')
  .description('Create a named checkpoint for an entity')
  .action((entity: string, name: string) => {
    const result = statecli.checkpoint(entity, name);
    console.log(JSON.stringify(result, null, 2));
    statecli.close();
  });

program
  .command('restore <entity> <name>')
  .description('Restore to a named checkpoint')
  .action((entity: string, name: string) => {
    const result = statecli.restoreCheckpoint(entity, name);
    console.log(JSON.stringify(result, null, 2));
    statecli.close();
  });

program
  .command('log <entity>')
  .description('View state change history for an entity')
  .option('-s, --since <since>', 'Time filter (e.g., "1h ago", "24h ago")')
  .option('-a, --actor <actor>', 'Filter by actor')
  .option('-l, --limit <limit>', 'Maximum number of entries')
  .action((entity: string, options: { since?: string; actor?: string; limit?: string }) => {
    const result = statecli.log(entity, {
      since: options.since,
      actor: options.actor,
      limit: options.limit ? parseInt(options.limit, 10) : undefined
    });
    console.log(JSON.stringify(result, null, 2));
    statecli.close();
  });

program
  .command('track <entityType> <entityId>')
  .description('Track a state change')
  .requiredOption('-d, --data <json>', 'State data as JSON string')
  .option('-a, --actor <actor>', 'Actor making the change', 'cli')
  .action((entityType: string, entityId: string, options: { data: string; actor: string }) => {
    try {
      const state = JSON.parse(options.data);
      const result = statecli.track(entityType, entityId, state, options.actor);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Error: Invalid JSON data');
      process.exit(1);
    }
    statecli.close();
  });

program
  .command('state <entity>')
  .description('Get current state of an entity')
  .action((entity: string) => {
    const state = statecli.getCurrentState(entity);
    if (state) {
      console.log(JSON.stringify({ entity, state }, null, 2));
    } else {
      console.log(JSON.stringify({ entity, state: null, message: 'No state found' }, null, 2));
    }
    statecli.close();
  });

program
  .command('list')
  .description('List all tracked entities')
  .action(() => {
    const entities = statecli.listEntities();
    console.log(JSON.stringify({ entities, count: entities.length }, null, 2));
    statecli.close();
  });

program
  .command('serve')
  .description('Start the MCP server (stdio by default, HTTP with --http or PORT env var)')
  .option('--http', 'Run as HTTP server instead of stdio')
  .option('-p, --port <port>', 'HTTP port (default: 3000)', '3000')
  .action(async (options: { http?: boolean; port: string }) => {
    const { EnhancedStateCLIMCPServer } = await import('./enhanced-mcp-server');
    const server = new EnhancedStateCLIMCPServer(config);

    process.on('SIGINT', () => { server.close(); process.exit(0); });
    process.on('SIGTERM', () => { server.close(); process.exit(0); });

    if (options.http || process.env.PORT || process.env.STATECLI_PORT) {
      const port = parseInt(process.env.PORT || process.env.STATECLI_PORT || options.port, 10);
      await server.runHttp(port);
    } else {
      await server.run();
    }
  });

program
  .command('setup')
  .description('Auto-configure StateCLI for your AI agent (cursor, claude, windsurf, vscode, all)')
  .argument('[agent]', 'Agent to configure: cursor | claude | windsurf | vscode | all', 'all')
  .option('--http', 'Configure to use HTTP transport instead of stdio')
  .option('-p, --port <port>', 'HTTP port for remote mode', '3000')
  .action((agent: string, options: { http?: boolean; port: string }) => {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const cwd = process.cwd();
    const useHttp = options.http || false;
    const port = options.port;

    // MCP server command to inject
    const mcpEntry = useHttp
      ? null  // HTTP mode: user runs `statecli serve --http` separately
      : {
          command: 'npx',
          args: ['-y', 'statecli-mcp-server']
        };

    const mcpConfig = mcpEntry
      ? { command: mcpEntry.command, args: mcpEntry.args }
      : { url: `http://localhost:${port}/mcp` };

    let configured: string[] = [];

    // ── Cursor ──────────────────────────────────────────────
    if (agent === 'cursor' || agent === 'all') {
      const cursorPaths = [
        path.join(home, '.cursor', 'mcp.json'),
        path.join(cwd, '.cursor', 'mcp.json')
      ];
      for (const p of cursorPaths) {
        try {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          let existing: any = {};
          if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf-8'));
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.statecli = mcpConfig;
          fs.writeFileSync(p, JSON.stringify(existing, null, 2));
          configured.push(`Cursor: ${p}`);
        } catch { /* skip if no access */ }
      }
    }

    // ── Claude Code / Claude Desktop ────────────────────────
    if (agent === 'claude' || agent === 'all') {
      const claudePaths = [
        path.join(home, '.claude', 'mcp.json'),
        path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
        path.join(home, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json')
      ];
      for (const p of claudePaths) {
        try {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          let existing: any = {};
          if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf-8'));
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.statecli = mcpConfig;
          fs.writeFileSync(p, JSON.stringify(existing, null, 2));
          configured.push(`Claude: ${p}`);
        } catch { /* skip if no access */ }
      }
      // Also write CLAUDE.md hint into current project
      const claudeMd = path.join(cwd, 'CLAUDE.md');
      const hint = '\n## StateCLI\nstatecli MCP server is active. Before any file edit, call `statecli_checkpoint`. After errors, call `statecli_analyze_error`.\n';
      try {
        const existing = fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf-8') : '';
        if (!existing.includes('StateCLI')) {
          fs.appendFileSync(claudeMd, hint);
          configured.push(`CLAUDE.md updated`);
        }
      } catch { /* skip */ }
    }

    // ── Windsurf ────────────────────────────────────────────
    if (agent === 'windsurf' || agent === 'all') {
      const windsurfPaths = [
        path.join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        path.join(cwd, '.windsurf', 'mcp.json')
      ];
      for (const p of windsurfPaths) {
        try {
          fs.mkdirSync(path.dirname(p), { recursive: true });
          let existing: any = {};
          if (fs.existsSync(p)) existing = JSON.parse(fs.readFileSync(p, 'utf-8'));
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.statecli = mcpConfig;
          fs.writeFileSync(p, JSON.stringify(existing, null, 2));
          configured.push(`Windsurf: ${p}`);
        } catch { /* skip */ }
      }
    }

    // ── VS Code (Copilot) ───────────────────────────────────
    if (agent === 'vscode' || agent === 'all') {
      const vscodePath = path.join(cwd, '.vscode', 'mcp.json');
      try {
        fs.mkdirSync(path.dirname(vscodePath), { recursive: true });
        let existing: any = {};
        if (fs.existsSync(vscodePath)) existing = JSON.parse(fs.readFileSync(vscodePath, 'utf-8'));
        existing.servers = existing.servers || {};
        existing.servers.statecli = mcpConfig;
        fs.writeFileSync(vscodePath, JSON.stringify(existing, null, 2));
        configured.push(`VS Code: ${vscodePath}`);
      } catch { /* skip */ }
    }

    if (configured.length === 0) {
      console.log('No agent config files found to update. Try running in your project root.');
    } else {
      console.log('StateCLI configured for:');
      configured.forEach(c => console.log('  ✓', c));
      if (useHttp) {
        console.log(`\nHTTP mode: start the server with:\n  statecli serve --http --port ${port}`);
      } else {
        console.log('\nStdio mode: agents will auto-start statecli via npx.');
      }
      console.log('\nDone. Restart your agent to pick up the changes.');
    }
    statecli.close();
  });

// Import new commands
import { createWatchCommand } from './commands/watch';
import { createDiffCommand } from './commands/diff';

// Register new commands
createWatchCommand(program);
createDiffCommand(program);

program
  .command('init')
  .description('Initialize StateCLI configuration')
  .action(() => {
    const configDir = path.join(process.cwd(), '.statecli');
    const configFile = path.join(configDir, 'config.json');
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (fs.existsSync(configFile)) {
      console.log('Configuration already exists at', configFile);
    } else {
      const defaultConfig = {
        storage: {
          type: 'local',
          path: '.statecli/state.db'
        },
        autoTrack: {
          enabled: true,
          patterns: ['*']
        },
        retention: {
          days: 30,
          maxChangesPerEntity: 1000
        }
      };
      
      fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));
      console.log('Created configuration at', configFile);
    }
    
    statecli.close();
  });

program.parse();
