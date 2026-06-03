#!/usr/bin/env node

const { program } = require('commander');
const { generateTree } = require('../lib/tree-generator');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs');
const os = require('os');

const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.tree-clirc.json');
const DEFAULT_IGNORES = ['node_modules', '.git', 'dist', 'build', 'coverage', '.cache', '.DS_Store'];

/**
 * Ensures global config exists on first run and loads it safely
 */
function ensureAndLoadConfig() {
    if (!fs.existsSync(GLOBAL_CONFIG_PATH)) {
        try {
            const defaultConfig = {
                $schema: "https://json.schemastore.org/rc",
                description: "Global configuration for tree-cli",
                ignoreDirs: DEFAULT_IGNORES
            };
            fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log(chalk.cyan.bold(`✨ Initialized global configuration file at: ${GLOBAL_CONFIG_PATH}\n`));
        } catch (error) {
            console.warn(chalk.yellow(`⚠️ Warning: Could not create global configuration file: ${error.message}`));
        }
    }

    try {
        const configFile = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8');
        const config = JSON.parse(configFile);
        if (config.ignoreDirs && Array.isArray(config.ignoreDirs)) {
            return config.ignoreDirs;
        }
    } catch (error) {
        console.warn(chalk.yellow(`⚠️ Warning: Failed to parse global config at ${GLOBAL_CONFIG_PATH}. Using fallback defaults.`));
    }

    return DEFAULT_IGNORES;
}

const globalIgnoreDirs = ensureAndLoadConfig();

program
    .name('tree-cli')
    .description('Generate a beautiful tree view of directories and files')
    .version('1.0.0')
    .option(
        '-d, --depth <number>',
        'Maximum depth to traverse',
        (val) => {
            const depth = Number.parseInt(val, 10);
            if (Number.isNaN(depth) || depth < 0) {
                throw new Error('Depth must be a non-negative integer');
            }
            return depth;
        },
        Infinity
    )
    .option('-i, --ignore <dirs>', 'Comma-separated directories to ignore (overrides global config)', null)
    .option('-f, --full-path', 'Show full paths instead of relative names', false)
    .option('-o, --output <file>', 'Output the tree structure directly to a file')
    .option('-l, --list-only', 'Show only directories, hiding files', false)
    // New Configuration Flag
    .option('--config', 'Show the path to the global configuration file and exit', false)
    .argument('[directory]', 'Directory to traverse', process.cwd())
    .action((directory, options) => {
        // Handle --config flag immediately and short-circuit execution
        if (options.config) {
            console.log(chalk.blue.bold('\n⚙️  Global Configuration Details:'));
            console.log(`Path: ${chalk.cyan(GLOBAL_CONFIG_PATH)}`);

            if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
                console.log(`Status: ${chalk.green('Active and accessible')}`);
            } else {
                console.log(`Status: ${chalk.red('Not found (will auto-generate on next tree run)')}`);
            }
            console.log(); // Trailing blank line for visual breathing room
            process.exit(0);
        }

        const targetPath = path.resolve(directory);
        const ignoreDirs = options.ignore
            ? options.ignore.split(',').map(d => d.trim())
            : globalIgnoreDirs;

        if (!fs.existsSync(targetPath)) {
            program.error(chalk.red(`Error: The directory "${directory}" does not exist.`));
        }

        try {
            const tree = generateTree(targetPath, {
                depth: options.depth,
                ignoreDirs,
                fullPath: options.fullPath,
                listOnly: options.listOnly
            });

            if (options.output) {
                const outputPath = path.resolve(options.output);
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });

                const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
                const cleanOutput = tree.replace(ansiRegex, '');

                fs.writeFileSync(outputPath, cleanOutput, 'utf8');
                console.log(chalk.green.bold(`\n✓ Tree successfully saved to: ${outputPath}`));
            } else {
                console.log(tree);
            }
        } catch (error) {
            program.error(chalk.red(`Execution Error: ${error.message}`));
        }
    });

program.parse();