#!/usr/bin/env node
// --- bin/cli.ts ---
import { Command } from 'commander';
import { treeCommand } from './commands/tree.js';
import { settingsCommand } from './commands/settings.js';

const program = new Command();

program
  .name('tree-cli')
  .description('A CLI tool to display directory structures as a tree.')
  .version('1.0.0');

settingsCommand(program);
program
  .command('tree')
  .description('Display the directory tree')
  .action(treeCommand);

program.parse(process.argv);
