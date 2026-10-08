'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { formatError, run, writeOutputFile } = require('../lib/reporter');
const { TreeCliError } = require('../lib/errors');
const { createFixture, removeFixture } = require('./fixtures/helpers');

/**
 * Creates a minimal writable stream that records everything written to it.
 *
 * @returns {{ chunks: string[], write: (text: string) => boolean, text: () => string }}
 */
function captureStream() {
    const chunks = [];

    return {
        chunks,
        write(text) {
            chunks.push(String(text));
            return true;
        },
        text() {
            return chunks.join('');
        },
    };
}

test('run prints the tree on stdout and stays silent on stderr', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const stdout = captureStream();
        const stderr = captureStream();
        const result = run(root, { ignore: [], useDefaultIgnore: false, color: false }, { stdout, stderr });

        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, `${path.basename(root)}/\n└── a.txt\n`);
        assert.equal(result.stderr, '');
        assert.equal(stdout.text(), '', 'run only reports, the caller prints');
    } finally {
        removeFixture(root);
    }
});

test('run appends the summary when asked', () => {
    const root = createFixture({ 'a.txt': 'x', 'b.txt': 'y' });
    try {
        const result = run(root, { ignore: [], useDefaultIgnore: false, summary: true }, {});

        assert.match(result.stdout, /2 files, 2 B\n$/);
        assert.match(result.stdout, /0 directories/);
    } finally {
        removeFixture(root);
    }
});

test('run writes a plain file and reports it on stderr', () => {
    const root = createFixture({ 'a.txt': 'x' });
    const outDir = createFixture({});
    try {
        const outputPath = path.join(outDir, 'nested', 'tree.txt');
        const result = run(root, { ignore: [], useDefaultIgnore: false, outputPath, color: true }, {});

        assert.equal(result.exitCode, 0);
        assert.equal(result.stdout, '', 'nothing goes to stdout when writing a file');
        assert.match(result.stderr, /^Saved tree to: /);
        assert.ok(fs.existsSync(outputPath), 'missing parent directories are created');
        assert.equal(fs.readFileSync(outputPath, 'utf8').includes('\u001B['), false);
    } finally {
        removeFixture(root);
        removeFixture(outDir);
    }
});

test('run writes the summary into the file as well', () => {
    const root = createFixture({ 'a.txt': 'x' });
    const outDir = createFixture({});
    try {
        const outputPath = path.join(outDir, 'tree.txt');
        run(root, { ignore: [], useDefaultIgnore: false, outputPath, summary: true }, {});

        assert.match(fs.readFileSync(outputPath, 'utf8'), /1 file, 1 B\n$/);
    } finally {
        removeFixture(root);
        removeFixture(outDir);
    }
});

test('run turns a missing directory into a single stderr line and a non-zero code', () => {
    const root = createFixture({});
    try {
        const result = run(path.join(root, 'nope'), {}, {});

        assert.equal(result.exitCode, 1);
        assert.equal(result.stdout, '');
        assert.match(result.stderr, /^Error: .*does not exist\.\n$/);
        assert.equal(result.stderr.includes('at '), false, 'no stack trace leaks out');
    } finally {
        removeFixture(root);
    }
});

test('run reports an unwritable output path without throwing', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const directoryAsTarget = path.join(root, 'a.txt');
        const result = run(
            root,
            { ignore: [], useDefaultIgnore: false, outputPath: path.join(directoryAsTarget, 'x.txt') },
            {}
        );

        assert.equal(result.exitCode, 1);
        assert.match(result.stderr, /^Error: Cannot write "/);
    } finally {
        removeFixture(root);
    }
});

test('writeOutputFile returns the absolute path it wrote', () => {
    const dir = createFixture({});
    try {
        const target = path.join(dir, 'out.txt');
        const written = writeOutputFile(target, 'content');

        assert.equal(written, path.resolve(target));
        assert.equal(fs.readFileSync(target, 'utf8'), 'content');
    } finally {
        removeFixture(dir);
    }
});

test('writeOutputFile strips escapes even if the caller did not', () => {
    const dir = createFixture({});
    try {
        const target = path.join(dir, 'out.txt');
        writeOutputFile(target, '\u001B[32mgreen\u001B[0m');

        assert.equal(fs.readFileSync(target, 'utf8'), 'green');
    } finally {
        removeFixture(dir);
    }
});

test('formatError keeps the message of a known error and stringifies the rest', () => {
    assert.equal(formatError(new TreeCliError('boom')), 'Error: boom');
    assert.equal(formatError(new Error('plain')), 'Error: plain');
    assert.equal(formatError('text'), 'Error: text');
    assert.equal(formatError(undefined), 'Error: undefined');
});
