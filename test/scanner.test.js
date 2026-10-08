'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { DEFAULT_IGNORE } = require('../lib/constants');
const { TreeCliError } = require('../lib/errors');
const { getDirectoryItems, isIgnored, normalizeIgnore, scanDirectory, toPosix } = require('../lib/scanner');
const { canCreateSymlinks, createFixture, removeFixture, sampleTree } = require('./fixtures/helpers');

test('normalizeIgnore accepts arrays, comma separated strings, and sets', () => {
    assert.deepEqual([...normalizeIgnore(['a', 'b'])], ['a', 'b']);
    assert.deepEqual([...normalizeIgnore('a, b ,c')], ['a', 'b', 'c']);
    assert.deepEqual([...normalizeIgnore(new Set(['a']))], ['a']);
    assert.deepEqual([...normalizeIgnore(null)], []);
    assert.deepEqual([...normalizeIgnore(undefined)], []);
    assert.deepEqual([...normalizeIgnore('')], []);
});

test('normalizeIgnore strips trailing separators and whitespace', () => {
    assert.deepEqual([...normalizeIgnore(' dist/ , build\\ ')], ['dist', 'build']);
});

test('isIgnored matches entry names and root relative paths', () => {
    const patterns = normalizeIgnore(['node_modules', 'src/generated']);

    assert.equal(isIgnored('node_modules', 'node_modules', patterns), true);
    assert.equal(isIgnored('nested', 'a/b/node_modules', patterns), false);
    assert.equal(isIgnored('node_modules', 'a/node_modules', patterns), true, 'name match applies at any depth');
    assert.equal(isIgnored('anything', 'src/generated/file.js', patterns), true, 'path patterns cover children');
    assert.equal(isIgnored('index.js', 'src/index.js', patterns), false);
});

test('isIgnored returns false when there is nothing to ignore', () => {
    assert.equal(isIgnored('node_modules', 'node_modules', new Set()), false);
});

test('scanDirectory lists directories first, then files, each alphabetically', () => {
    const root = createFixture(sampleTree());
    try {
        const names = scanDirectory(root, { ignore: [], useDefaultIgnore: false }).map((item) => item.name);

        // Directories: docs, node_modules, src. Files: .hidden, package.json, README.md.
        assert.deepEqual(names, ['docs', 'node_modules', 'src', '.hidden', 'package.json', 'README.md']);
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory hides the default noise directories', () => {
    const root = createFixture(sampleTree());
    try {
        const names = scanDirectory(root, { ignore: DEFAULT_IGNORE, useDefaultIgnore: true }).map((item) => item.name);

        assert.equal(names.includes('node_modules'), false);
        assert.equal(names.includes('src'), true);
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory reports relative paths with forward slashes', () => {
    const root = createFixture(sampleTree());
    try {
        const items = scanDirectory(root, { ignore: [], useDefaultIgnore: false });
        const src = items.find((item) => item.name === 'src');
        const children = scanDirectory(src.path, { ignore: [], useDefaultIgnore: false, rootPath: root });

        assert.equal(src.relativePath, 'src');
        assert.ok(children.every((child) => !child.relativePath.includes('\\')));
        assert.ok(children.some((child) => child.relativePath === 'src/index.js'));
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory with directoriesOnly drops files but keeps directories', () => {
    const root = createFixture(sampleTree());
    try {
        const items = scanDirectory(root, { ignore: [], useDefaultIgnore: false, directoriesOnly: true });

        assert.deepEqual(
            items.map((item) => item.name),
            ['docs', 'node_modules', 'src']
        );
        assert.ok(items.every((item) => item.isDirectory));
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory records file sizes and zero for directories', () => {
    const root = createFixture({ 'a.txt': 'hello', sub: { 'b.txt': 'hi' } });
    try {
        const items = scanDirectory(root, { ignore: [], useDefaultIgnore: false });
        const file = items.find((item) => item.name === 'a.txt');
        const dir = items.find((item) => item.name === 'sub');

        assert.equal(file.size, 5);
        assert.equal(dir.isDirectory, true);
        assert.equal(dir.size, 0);
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory throws a TreeCliError for an unreadable directory', () => {
    const missing = path.join(createFixture({}), 'does-not-exist');

    assert.throws(
        () => scanDirectory(missing),
        (error) => {
            assert.ok(error instanceof TreeCliError);
            assert.equal(error.code, 'ERR_TREE_CLI_READ');
            return true;
        }
    );
});

test('scanDirectory skips broken symlinks instead of failing', { skip: !canCreateSymlinks }, () => {
    const root = createFixture({ 'real.txt': 'ok' });
    try {
        fs.symlinkSync(path.join(root, 'gone.txt'), path.join(root, 'broken.txt'));
        const names = scanDirectory(root, { ignore: [], useDefaultIgnore: false }).map((item) => item.name);

        assert.equal(names.includes('broken.txt'), false);
        assert.equal(names.includes('real.txt'), true);
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory identifies symlinks and their targets', { skip: !canCreateSymlinks }, () => {
    const root = createFixture({ 'real.txt': 'ok' });
    try {
        fs.symlinkSync(path.join(root, 'real.txt'), path.join(root, 'link.txt'));
        const link = scanDirectory(root, { ignore: [], useDefaultIgnore: false, showSymlinkTarget: true }).find(
            (item) => item.name === 'link.txt'
        );

        assert.equal(link.isSymbolicLink, true);
        assert.equal(link.isDirectory, false);
        assert.ok(link.linkTarget.endsWith('real.txt'));
    } finally {
        removeFixture(root);
    }
});

test('scanDirectory omits the symlink target when not requested', { skip: !canCreateSymlinks }, () => {
    const root = createFixture({ 'real.txt': 'ok' });
    try {
        fs.symlinkSync(path.join(root, 'real.txt'), path.join(root, 'link.txt'));
        const link = scanDirectory(root, { ignore: [], useDefaultIgnore: false }).find(
            (item) => item.name === 'link.txt'
        );

        assert.equal(link.isSymbolicLink, true);
        assert.equal(link.linkTarget, null);
    } finally {
        removeFixture(root);
    }
});

test('toPosix converts platform separators', () => {
    assert.equal(toPosix(path.join('a', 'b', 'c')), 'a/b/c');
});

test('getDirectoryItems keeps its 1.x return shape', () => {
    const root = createFixture(sampleTree());
    try {
        const items = getDirectoryItems(root, { ignore: [], listOnly: true });

        assert.deepEqual(Object.keys(items[0]).sort(), ['isDirectory', 'name', 'path']);
        assert.ok(items.every((item) => item.isDirectory));
    } finally {
        removeFixture(root);
    }
});
