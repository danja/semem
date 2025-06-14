#!/usr/bin/env node

/**
 * Semem CLI Entry Point
 * 
 * Main command-line interface for the Semem semantic memory system
 */

import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Get version from package.json
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(__dirname, '..', 'package.json');
const { version } = JSON.parse(readFileSync(packagePath, 'utf8'));

const program = new Command();

program
  .name('semem')
  .description('Semantic Memory System - AI-powered memory management')
  .version(version);

program
  .command('mcp')
  .description('Start MCP (Model Context Protocol) server')
  .option('-p, --port <port>', 'HTTP port for MCP server', '3000')
  .option('-t, --transport <type>', 'Transport type (stdio|http|sse)', 'stdio')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const { startMCPServer } = await import('../mcp/index.js');
      await startMCPServer({
        transport: options.transport,
        port: options.port ? parseInt(options.port) : undefined,
        configPath: options.config
      });
    } catch (error) {
      console.error('Failed to start MCP server:', error.message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize a new Semem configuration')
  .option('-d, --dir <directory>', 'Target directory', process.cwd())
  .action(async (options) => {
    try {
      const { initializeProject } = await import('../src/cli/init.js');
      await initializeProject(options.dir);
    } catch (error) {
      console.error('Failed to initialize project:', error.message);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Start Semem HTTP server')
  .option('-p, --port <port>', 'Server port', '4100')
  .option('-c, --config <path>', 'Configuration file path')
  .action(async (options) => {
    try {
      const { startServer } = await import('../src/servers/http-server.js');
      await startServer({
        port: parseInt(options.port),
        configPath: options.config
      });
    } catch (error) {
      console.error('Failed to start server:', error.message);
      process.exit(1);
    }
  });

program
  .command('example <name>')
  .description('Run an example')
  .action(async (name) => {
    try {
      const examplePath = path.join(__dirname, '..', 'examples', name);
      const { default: runExample } = await import(examplePath);
      await runExample();
    } catch (error) {
      console.error(`Failed to run example '${name}':`, error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}