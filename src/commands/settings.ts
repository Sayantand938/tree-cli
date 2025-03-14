// --- src/commands/settings.ts ---
import { Command } from 'commander';
import Conf from 'conf';
import type { Schema } from 'conf';
import envPaths from 'env-paths';

const paths = envPaths('tree-cli', { suffix: '' });

interface Config {
  excludeDirs: string[];
}

const configSchema: Schema<Config> = {
  excludeDirs: {
    type: 'array',
    items: {
      type: 'string',
    },
    default: ['node_modules', 'dist', '.git'],
  },
};

const config = new Conf<Config>({
  schema: configSchema,
  configName: 'config',
  cwd: paths.config,
});

export function getConfig(): Conf<Config> {
  return config;
}

async function handleAdd(dir: string) {
  const currentExclusions = config.get('excludeDirs');
  if (!currentExclusions.includes(dir)) {
    config.set('excludeDirs', [...currentExclusions, dir]);
    console.log(`✅ Added "${dir}" to excluded directories.`);
  } else {
    console.log(`⚠️ "${dir}" is already in excluded directories.`);
  }
}

async function handleRemove(dir: string) {
  const currentExclusions = config.get('excludeDirs');
  const newExclusions = currentExclusions.filter(
    (item: string) => item !== dir
  );
  if (newExclusions.length < currentExclusions.length) {
    config.set('excludeDirs', newExclusions);
    console.log(`✅ Removed "${dir}" from excluded directories.`);
  } else {
    console.log(`⚠️ "${dir}" is not in the excluded directories.`);
  }
}

function handleList() {
  const excludedDirs = config.get('excludeDirs');
  if (excludedDirs.length === 0) {
    console.log('ℹ️ No directories are currently excluded.');
  } else {
    console.log('📂 Excluded directories:');
    excludedDirs.forEach((dir) => console.log(`- ${dir}`));
  }
}

function handleReset() {
  config.clear();
  console.log('🔄 Settings reset to default.');
}

function handleCreate() {
  // getConfig() already handles creation if it doesn't exist
  getConfig(); // Access config to force creation if needed.
  console.log(`ℹ️ Configuration file location: ${config.path}`);
}

export async function settingsCommand(program: Command) {
  program
    .command('settings')
    .description('Manage tree-cli settings')
    .option('--create', 'Create the configuration file') // Add --create
    .option('--add <directory>', 'Add a directory to exclude')
    .option('--remove <directory>', 'Remove a directory from exclude')
    .option('--list', 'List excluded directories')
    .option('--reset', 'Reset to default settings')
    .action(async (options) => {
      if (options.create) {
        handleCreate();
      } else if (options.add) {
        await handleAdd(options.add);
      } else if (options.remove) {
        await handleRemove(options.remove);
      } else if (options.list) {
        handleList();
      } else if (options.reset) {
        handleReset();
      } else {
        // If no options are provided, show help and config path
        program.help();
        console.log(`\nℹ️ Configuration file location: ${config.path}`);
      }
    });
}
