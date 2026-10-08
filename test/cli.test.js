'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { createProgram, execute } = require('../lib/cli');
const pkg = require('../package.json');
const { createFixture, removeFixture } = require('./fixtures/helpers');

/**
 * Creates a minimal writable stream that records everything written to it.
 *
 * @param {boolean} [isTTY]
 * @returns {{ write: (text: string) => boolean, text: () => string }}
 */
function captureStream(isTTY = false) {
    const chunks = [];

    return {
        isTTY,
        write(text) {
            chunks.push(String(text));
            return true;
        },
        text() {
            return chunks.join('');
        },
    };
}

/**
 * Runs the CLI in-process and captures both streams.
 *
 * @param {string[]} args Arguments after the script name.
 * @param {{ isTTY?: boolean, env?: NodeJS.ProcessEnv }} [context]
 */
function runCli(args, context = {}) {
    const stdout = captureStream(context.isTTY);
    const stderr = captureStream(context.isTTY);
    const exitCode = execute(['node', 'tree', ...args], {
        stdout,
        stderr,
        isTTY: context.isTTY,
        env: context.env || {},
    });

    return { exitCode, stdout: stdout.text(), stderr: stderr.text() };
}

test('cli prints the usage and exits successfully for --help', () => {
    const result = runCli(['--help']);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Usage: tree \[options\] \[directory\]/);
    assert.match(result.stdout, /--dirs-only/);
    assert.match(result.stdout, /Default ignores/);
    assert.equal(result.stderr, '');
});

test('cli prints the package version for --version', () => {
    const result = runCli(['--version']);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.trim(), pkg.version);
});

test('cli prints a tree for the current directory by default', () => {
    const result = runCli(['lib', '--depth', '1', '--no-color']);

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.split('\n')[0], 'lib/');
    assert.equal(result.stderr, '');
});

test('cli accepts the directory as a positional argument', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const result = runCli([root, '--no-color']);

        assert.equal(result.exitCode, 0);
        assert.match(result.stdout, /a\.txt/);
    } finally {
        removeFixture(root);
    }
});

test('cli disables colour with --no-color and can force it with --color', () => {
    const plain = runCli(['lib', '--depth', '1', '--no-color']);
    const forced = runCli(['lib', '--depth', '1', '--color']);

    assert.equal(plain.stdout.includes('\u001B['), false);
    assert.equal(forced.stdout.includes('\u001B['), true);
});

test('cli uses colour by default only when stdout is a TTY', () => {
    assert.equal(runCli(['lib', '--depth', '1'], { isTTY: false }).stdout.includes('\u001B['), false);
    assert.equal(runCli(['lib', '--depth', '1'], { isTTY: true }).stdout.includes('\u001B['), true);
    assert.equal(
        runCli(['lib', '--depth', '1'], { isTTY: true, env: { NO_COLOR: '1' } }).stdout.includes('\u001B['),
        false
    );
});

test('cli reports an invalid depth on stderr and exits non-zero', () => {
    const result = runCli(['lib', '--depth', 'abc']);

    assert.equal(result.exitCode, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Error: --depth expects a whole number/);
});

test('cli reports a missing directory without a stack trace', () => {
    const result = runCli(['definitely-not-here']);

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /^Error: Path .*does not exist\.\n$/);
});

test('cli rejects unknown options', () => {
    const result = runCli(['--not-a-flag']);

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /unknown option '--not-a-flag'/);
});

test('cli writes to a file with -o and keeps stdout clean', () => {
    const root = createFixture({ 'a.txt': 'x' });
    const outDir = createFixture({});
    try {
        const outputPath = path.join(outDir, 'tree.txt');
        const result = runCli([root, '-o', outputPath]);

        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /Saved tree to: /);
        assert.ok(fs.readFileSync(outputPath, 'utf8').includes('a.txt'));
    } finally {
        removeFixture(root);
        removeFixture(outDir);
    }
});

test('cli hides default noise directories and --all brings them back', () => {
    const root = createFixture({ node_modules: { pkg: { 'index.js': 'x' } }, 'a.txt': 'y' });
    try {
        const hidden = runCli([root, '--no-color']);
        const shown = runCli([root, '--all', '--no-color']);

        assert.equal(hidden.stdout.includes('node_modules'), false);
        assert.equal(shown.stdout.includes('node_modules'), true);
    } finally {
        removeFixture(root);
    }
});

test('cli combines --dirs-only with a depth limit', () => {
    const root = createFixture({ src: { nested: { 'deep.js': 'x' }, 'a.js': 'y' }, 'top.txt': 'z' });
    try {
        const result = runCli([root, '--dirs-only', '--depth', '2', '--no-color']);

        assert.match(result.stdout, /src\//);
        assert.match(result.stdout, /nested\//);
        assert.equal(result.stdout.includes('a.js'), false);
        assert.equal(result.stdout.includes('deep.js'), false);
    } finally {
        removeFixture(root);
    }
});

test('cli supports ascii output, sizes, and the summary line', () => {
    const root = createFixture({ 'a.txt': 'hello' });
    try {
        const result = runCli([root, '--charset', 'ascii', '--sizes', '--summary', '--no-color']);

        assert.match(result.stdout, /`-- a\.txt\s+5 B/);
        assert.match(result.stdout, /0 directories, 1 file, 5 B\n$/);
        assert.equal(/[├└│─]/.test(result.stdout), false);
    } finally {
        removeFixture(root);
    }
});

test('cli applies --ignore to nested paths', () => {
    const root = createFixture({ keep: { 'a.txt': 'x' }, drop: { 'b.txt': 'y' } });
    try {
        const result = runCli([root, '--ignore', 'drop', '--no-color']);

        assert.equal(result.stdout.includes('drop'), false);
        assert.match(result.stdout, /keep\//);
    } finally {
        removeFixture(root);
    }
});

test('createProgram exposes the documented options', () => {
    const program = createProgram();
    const flags = program.options.map((option) => option.long);

    for (const flag of [
        '--depth',
        '--ignore',
        '--all',
        '--full-path',
        '--dirs-only',
        '--sizes',
        '--charset',
        '--summary',
        '--output',
        '--color',
        '--no-color',
    ]) {
        assert.ok(flags.includes(flag), `missing ${flag}`);
    }
    assert.equal(program.name(), 'tree');
});
