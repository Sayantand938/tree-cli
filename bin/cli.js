#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { generateTree } = require('../lib/tree');
const pkg = require('../package.json');

program
    .name('tree-cli')
    .description(pkg.description)
    .version(pkg.version, '-V, --version', 'Display version')
    .argument('[directory]', 'Target directory to inspect', '.')
    .option('-d, --depth <number>', 'Maximum depth to traverse', (val) => parseInt(val, 10))
    .option(
        '-i, --ignore <dirs>',
        'Comma-separated names to ignore',
        (val) => val.split(',').map((s) => s.trim())
    )
    .option('-f, --full-path', 'Show full paths instead of relative', false)
    .option('-o, --output <file>', 'Output to file instead of console')
    .option('-l, --list-only', 'Show only directories, no files', false);

program.parse(process.argv);

const options = program.opts();
const [targetDir] = program.args;
const resolvedPath = path.resolve(process.cwd(), targetDir || '.');

if (!fs.existsSync(resolvedPath)) {
    console.error(`Error: Directory "${resolvedPath}" does not exist.`);
    process.exit(1);
}

// Generate the tree string
const treeOutput = generateTree(resolvedPath, {
    depth: options.depth,
    ignore: options.ignore,
    fullPath: options.fullPath,
    listOnly: options.listOnly,
    noColor: Boolean(options.output), // Strip ANSI escape sequences if saving to file
});

if (options.output) {
    const outputPath = path.resolve(process.cwd(), options.output);
    fs.writeFileSync(outputPath, treeOutput, 'utf8');
    console.log(`Saved tree to: ${outputPath}`);
} else {
    process.stdout.write(treeOutput);
}