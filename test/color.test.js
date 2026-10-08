'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { ANSI, colorizeLine, colorizeTree, shouldUseColor, stripAnsi, styleLabel } = require('../lib/color');

test('shouldUseColor gives an explicit flag priority over everything else', () => {
    assert.equal(shouldUseColor({ color: true, isTTY: false, env: {} }), true);
    assert.equal(shouldUseColor({ color: false, isTTY: true, env: {} }), false);
    assert.equal(shouldUseColor({ color: false, isTTY: true, env: { FORCE_COLOR: '1' } }), false);
});

test('shouldUseColor honours the NO_COLOR and FORCE_COLOR conventions', () => {
    assert.equal(shouldUseColor({ isTTY: true, env: { NO_COLOR: '1' } }), false);
    assert.equal(shouldUseColor({ isTTY: false, env: { FORCE_COLOR: '1' } }), true);
    assert.equal(shouldUseColor({ isTTY: false, env: { FORCE_COLOR: '0' } }), false);
    assert.equal(shouldUseColor({ isTTY: true, env: { NO_COLOR: '' } }), true, 'an empty NO_COLOR means unset');
});

test('shouldUseColor disables colour for a dumb terminal and follows the TTY', () => {
    assert.equal(shouldUseColor({ isTTY: true, env: { TERM: 'dumb' } }), false);
    assert.equal(shouldUseColor({ isTTY: true, env: {} }), true);
    assert.equal(shouldUseColor({ isTTY: false, env: {} }), false);
    assert.equal(shouldUseColor(), false);
});

test('colorizeLine returns the input untouched when colour is off', () => {
    const line = '├── index.js';

    assert.equal(colorizeLine(line, { useColor: false }), line);
    assert.equal(colorizeLine('', { useColor: true }), '');
});

test('colorizeLine tints the header, directories, files, and errors differently', () => {
    const header = colorizeLine('project/', { useColor: true, header: true, lineIndex: 0 });
    const dir = colorizeLine('├── src/', { useColor: true, header: true, lineIndex: 1 });
    const file = colorizeLine('│   └── index.js', { useColor: true, header: true, lineIndex: 2 });
    const error = colorizeLine('└── [error: EACCES]', { useColor: true, header: true, lineIndex: 3 });

    assert.ok(header.startsWith(ANSI.green));
    assert.ok(dir.includes(ANSI.cyan));
    assert.ok(file.includes(ANSI.white));
    assert.ok(error.startsWith(ANSI.red));
});

test('colorizeLine never changes the visible text', () => {
    const lines = ['project/', '├── src/', '│   └── index.js', '└── [error: nope]'];

    for (const [index, line] of lines.entries()) {
        const coloured = colorizeLine(line, { useColor: true, header: true, lineIndex: index });
        assert.equal(stripAnsi(coloured), line);
    }
});

test('colorizeLine dims the box drawing guides', () => {
    const coloured = colorizeLine('├── index.js', { useColor: true });

    assert.ok(coloured.includes(`${ANSI.dim}├── ${ANSI.reset}`));
});

test('colorizeLine leaves summary like lines untouched', () => {
    assert.equal(colorizeLine('3 directories, 4 files', { useColor: true }), '3 directories, 4 files');
});

test('styleLabel picks a colour from the label text alone', () => {
    assert.ok(styleLabel('src/').includes(ANSI.cyan));
    assert.ok(styleLabel('link -> target').includes(ANSI.magenta));
    assert.ok(styleLabel('index.js').includes(ANSI.white));
});

test('colorizeTree colours a whole document and round-trips through stripAnsi', () => {
    const text = ['project/', '├── src/', '└── index.js', ''].join('\n');
    const coloured = colorizeTree(text, { useColor: true });

    assert.ok(coloured.includes('\u001B['));
    assert.equal(stripAnsi(coloured), text);
    assert.equal(colorizeTree(text, { useColor: false }), text);
    assert.equal(colorizeTree('', { useColor: true }), '');
});

test('stripAnsi removes every escape sequence', () => {
    assert.equal(stripAnsi(`${ANSI.red}bad${ANSI.reset}`), 'bad');
    assert.equal(stripAnsi('plain'), 'plain');
    assert.equal(stripAnsi(''), '');
});
