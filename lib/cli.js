'use strict';

const { Command } = require('commander');

const pkg = require('../package.json');
const { defaultIgnoreHint, parseCliOptions } = require('./options');
const { formatError, run } = require('./reporter');

/**
 * Builds the command line definition.
 *
 * Kept in a function, separate from execution, so tests and documentation
 * tools can render `--help` without spawning a process.
 *
 * @returns {Command}
 */
function createProgram() {
    const program = new Command();

    program
        .name('tree')
        .description('Print a directory tree, like the Unix tree command.')
        .version(pkg.version, '-V, --version', 'print the version number')
        .argument('[directory]', 'directory to inspect', '.')
        .option('-d, --depth <number>', 'maximum levels to descend, 0 for unlimited')
        .option('-i, --ignore <names>', 'extra names or paths to ignore, comma separated')
        .option('-a, --all', `do not hide ${defaultIgnoreHint()}`)
        .option('-f, --full-path', 'print the path of each entry from the root')
        .option('--dirs-only', 'list directories only')
        .option('-s, --sizes', 'show the size of each file')
        .option('-c, --charset <style>', 'drawing style: unicode or ascii', 'unicode')
        .option('--summary', 'print a total count of directories and files')
        .option('--follow-symlinks', 'descend into symlinked directories')
        .option('--color', 'force colour output')
        .option('--no-color', 'disable colour output')
        .option('-o, --output <file>', 'write the tree to a file instead of stdout')
        .addHelpText(
            'after',
            [
                '',
                'Examples:',
                '  $ tree',
                '  $ tree src --depth 2',
                '  $ tree --dirs-only --ignore "dist,coverage"',
                '  $ tree . --sizes --summary',
                '  $ tree --charset ascii -o structure.txt',
                '',
                `Default ignores, use --all to include them: ${defaultIgnoreHint()}`,
            ].join('\n')
        );

    return program;
}

/**
 * Runs the CLI in the current process.
 *
 * Everything is written through the supplied streams instead of
 * `process.stdout` so the whole command can be exercised in-process by the
 * test suite. No explicit `process.exit` is ever called: the returned code is
 * assigned to `process.exitCode` by {@link main}.
 *
 * @param {string[]} argv Arguments after `node script`, e.g. `process.argv`.
 * @param {object} [context]
 * @param {NodeJS.WriteStream} [context.stdout]
 * @param {NodeJS.WriteStream} [context.stderr]
 * @param {boolean} [context.isTTY] Whether the destination supports colour.
 * @param {NodeJS.ProcessEnv} [context.env]
 * @returns {number} Process exit code.
 */
function execute(argv, { stdout = process.stdout, stderr = process.stderr, isTTY, env } = {}) {
    const program = createProgram();

    // Commander would print and exit on its own; taking over keeps every
    // message routed through the streams above.
    program.exitOverride();
    program.configureOutput({
        writeOut: (text) => stdout.write(text),
        writeErr: (text) => stderr.write(text),
    });

    try {
        program.parse(argv);
    } catch (error) {
        // `--help` and `--version` land here after commander has written their
        // output, and mean success.
        if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') return 0;
        if (error.code === 'commander.help') return 0;

        stderr.write(`${error.message}\n`);
        return typeof error.exitCode === 'number' ? error.exitCode : 1;
    }

    const [directory] = program.args;

    try {
        const options = parseCliOptions(program.opts(), {
            isTTY: isTTY === undefined ? Boolean(stdout.isTTY) : isTTY,
            env,
        });
        const result = run(directory, options, { stdout, stderr });

        if (result.stdout) stdout.write(result.stdout);
        if (result.stderr) stderr.write(result.stderr);

        return result.exitCode;
    } catch (error) {
        stderr.write(`${formatError(error)}\n`);
        return 1;
    }
}

/** Entry point used by `bin/cli.js`. */
function main() {
    process.exitCode = execute(process.argv);
}

module.exports = { createProgram, execute, main };
