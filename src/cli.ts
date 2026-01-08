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
  .description('Start the MCP server')
  .action(async () => {
    const { StateCLIMCPServer } = await import('./mcp-server');
    const server = new StateCLIMCPServer(config);
    
    process.on('SIGINT', () => {
      server.close();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      server.close();
      process.exit(0);
    });

    await server.run();
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
