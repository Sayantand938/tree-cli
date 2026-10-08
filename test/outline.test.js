'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
    ASCII_GLYPHS,
    UNICODE_GLYPHS,
    buildLabel,
    computeLabelWidth,
    formatSize,
    getGlyphs,
    renderNodes,
} = require('../lib/outline');

test('formatSize uses metric units and one decimal place', () => {
    assert.equal(formatSize(0), '0 B');
    assert.equal(formatSize(1), '1 B');
    assert.equal(formatSize(999), '999 B');
    assert.equal(formatSize(1000), '1.0 kB');
    assert.equal(formatSize(1500), '1.5 kB');
    assert.equal(formatSize(1_000_000), '1.0 MB');
    assert.equal(formatSize(2_500_000_000), '2.5 GB');
});

test('formatSize falls back to 0 B for values it cannot measure', () => {
    assert.equal(formatSize(-1), '0 B');
    assert.equal(formatSize(Number.NaN), '0 B');
    assert.equal(formatSize(undefined), '0 B');
});

test('getGlyphs returns the requested set and defaults to unicode', () => {
    assert.deepEqual(getGlyphs('ascii'), ASCII_GLYPHS);
    assert.deepEqual(getGlyphs('unicode'), UNICODE_GLYPHS);
    assert.deepEqual(getGlyphs('nonsense'), UNICODE_GLYPHS);
    assert.deepEqual(getGlyphs(), UNICODE_GLYPHS);
});

test('buildLabel marks directories with a trailing slash', () => {
    const dir = { name: 'src', relativePath: 'src', isDirectory: true, size: 0 };
    const file = { name: 'index.js', relativePath: 'src/index.js', isDirectory: false, size: 10 };

    assert.equal(buildLabel(dir), 'src/');
    assert.equal(buildLabel(file), 'index.js');
});

test('buildLabel prefers the relative path when fullPath is set', () => {
    const file = { name: 'index.js', relativePath: 'src/index.js', isDirectory: false, size: 10 };

    assert.equal(buildLabel(file, { fullPath: true }), 'src/index.js');
});

test('buildLabel renders symlink targets and file sizes', () => {
    const link = {
        name: 'link',
        relativePath: 'link',
        isDirectory: false,
        isSymbolicLink: true,
        linkTarget: 'target',
        size: 0,
    };
    const file = { name: 'a.js', relativePath: 'a.js', isDirectory: false, size: 1500 };

    assert.equal(buildLabel(link, { showSymlinkTarget: true }), 'link -> target');
    assert.equal(buildLabel(file, { showSizes: true, labelWidth: 10 }), 'a.js        1.5 kB');
    assert.equal(buildLabel(link, {}), 'link');
});

test('renderNodes draws the classic box drawing output', () => {
    const nodes = [
        {
            name: 'src',
            relativePath: 'src',
            isDirectory: true,
            size: 0,
            children: [{ name: 'index.js', relativePath: 'src/index.js', isDirectory: false, size: 0, children: [] }],
        },
        { name: 'README.md', relativePath: 'README.md', isDirectory: false, size: 0, children: [] },
    ];

    assert.deepEqual(renderNodes(nodes), ['├── src/', '│   └── index.js', '└── README.md']);
});

test('renderNodes draws ascii output when asked', () => {
    const nodes = [
        { name: 'a.js', relativePath: 'a.js', isDirectory: false, size: 0, children: [] },
        { name: 'b.js', relativePath: 'b.js', isDirectory: false, size: 0, children: [] },
    ];

    assert.deepEqual(renderNodes(nodes, { style: 'ascii' }), ['|-- a.js', '`-- b.js']);
});

test('renderNodes surfaces a nested read error in place of the directory', () => {
    const nodes = [
        {
            name: 'locked',
            relativePath: 'locked',
            isDirectory: true,
            size: 0,
            children: [{ name: '', relativePath: '', isDirectory: false, size: 0, children: [], error: 'EACCES' }],
        },
    ];

    assert.deepEqual(renderNodes(nodes), ['└── locked/', '    └── [error: EACCES]']);
});

test('renderNodes skips error placeholders without printing an empty label', () => {
    const nodes = [
        { name: '', relativePath: '', isDirectory: false, size: 0, children: [], error: 'EACCES' },
        { name: 'ok.txt', relativePath: 'ok.txt', isDirectory: false, size: 1, children: [] },
    ];

    assert.deepEqual(renderNodes(nodes), ['└── ok.txt', '└── [error: EACCES]']);
});

test('renderNodes pads labels so size columns line up', () => {
    const nodes = [
        { name: 'a.js', relativePath: 'a.js', isDirectory: false, size: 1, children: [] },
        {
            name: 'much-longer-name.js',
            relativePath: 'much-longer-name.js',
            isDirectory: false,
            size: 2000,
            children: [],
        },
    ];

    const lines = renderNodes(nodes, { showSizes: true });
    const sizeColumns = lines.map((line) => line.search(/\d+(?:\.\d+)? [kMGTP]?B$/));

    assert.equal(sizeColumns[0], sizeColumns[1]);
    assert.deepEqual(lines, ['├── a.js                 1 B', '└── much-longer-name.js  2.0 kB']);
});

test('computeLabelWidth measures only file labels', () => {
    const nodes = [
        {
            name: 'a-very-long-directory-name',
            relativePath: 'a-very-long-directory-name',
            isDirectory: true,
            size: 0,
            children: [],
        },
        { name: 'a.js', relativePath: 'a.js', isDirectory: false, size: 0, children: [] },
    ];

    assert.equal(computeLabelWidth(nodes, {}), 4);
});

test('renderNodes returns an empty list for an empty tree', () => {
    assert.deepEqual(renderNodes([]), []);
});
