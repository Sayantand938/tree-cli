'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { TreeCliError } = require('../lib/errors');
const {
    buildNodes,
    countEntries,
    createDocument,
    formatSummary,
    generateTree,
    normalizeOptions,
    totalSize,
} = require('../lib/tree');
const { canCreateSymlinks, createFixture, removeFixture, sampleTree } = require('./fixtures/helpers');

test('generateTree renders the whole folder tree under a root header', () => {
    const root = createFixture({ docs: { 'guide.md': 'x' }, 'README.md': 'y' });
    try {
        const output = generateTree(root, { ignore: [], useDefaultIgnore: false });
        const lines = output.trimEnd().split('\n');

        assert.equal(lines[0], `${path.basename(root)}/`);
        assert.deepEqual(lines.slice(1), ['├── docs/', '│   └── guide.md', '└── README.md']);
        assert.ok(output.endsWith('\n'));
    } finally {
        removeFixture(root);
    }
});

test('generateTree respects the depth limit', () => {
    const root = createFixture({ a: { b: { c: { 'deep.txt': 'x' } } }, 'top.txt': 'y' });
    try {
        const one = generateTree(root, { depth: 1, ignore: [], useDefaultIgnore: false });
        const two = generateTree(root, { depth: 2, ignore: [], useDefaultIgnore: false });
        const three = generateTree(root, { depth: 3, ignore: [], useDefaultIgnore: false });

        assert.equal(one.split('\n').filter(Boolean).length, 3, 'header + a/ + top.txt');
        assert.equal(two.split('\n').filter(Boolean).length, 4, 'adds b/');
        assert.equal(three.split('\n').filter(Boolean).length, 5, 'adds c/');
        assert.ok(!one.includes('deep.txt'));
    } finally {
        removeFixture(root);
    }
});

test('a depth of 0 or an omitted depth means unlimited', () => {
    const root = createFixture({ a: { b: { 'deep.txt': 'x' } } });
    try {
        const unlimited = generateTree(root, { ignore: [], useDefaultIgnore: false });
        const explicit = generateTree(root, { depth: 0, ignore: [], useDefaultIgnore: false });

        assert.equal(explicit, unlimited);
        assert.ok(unlimited.includes('deep.txt'));
    } finally {
        removeFixture(root);
    }
});

test('generateTree honours ignores, including nested paths', () => {
    const root = createFixture({ keep: { 'a.txt': 'x' }, drop: { 'b.txt': 'y' }, 'top.txt': 'z' });
    try {
        const byName = generateTree(root, { ignore: ['drop'], useDefaultIgnore: false });
        const byPath = generateTree(root, { ignore: ['keep/a.txt'], useDefaultIgnore: false });

        assert.ok(!byName.includes('drop'));
        assert.ok(byName.includes('keep/'));
        assert.ok(!byPath.includes('a.txt'));
        assert.ok(byPath.includes('b.txt'));
    } finally {
        removeFixture(root);
    }
});

test('generateTree hides default noise directories unless useDefaultIgnore is false', () => {
    const root = createFixture({ node_modules: { pkg: { 'index.js': 'x' } }, src: { 'a.js': 'y' } });
    try {
        const hidden = generateTree(root);
        const shown = generateTree(root, { useDefaultIgnore: false });

        assert.ok(!hidden.includes('node_modules'));
        assert.ok(shown.includes('node_modules'));
    } finally {
        removeFixture(root);
    }
});

test('directoriesOnly lists just the directories', () => {
    const root = createFixture({ src: { nested: { 'deep.js': 'x' }, 'a.js': 'y' }, 'top.txt': 'z' });
    try {
        const output = generateTree(root, { directoriesOnly: true, ignore: [], useDefaultIgnore: false });
        const lines = output.trimEnd().split('\n');

        assert.deepEqual(lines.slice(1), ['└── src/', '    └── nested/']);
    } finally {
        removeFixture(root);
    }
});

test('directoriesOnly still descends past files', () => {
    const root = createFixture({ a: { 'file.txt': 'x', b: { 'deep.txt': 'y' } } });
    try {
        const output = generateTree(root, { directoriesOnly: true, ignore: [], useDefaultIgnore: false });

        assert.ok(output.includes('b/'), 'the subdirectory is reached through the file level');
        assert.ok(!output.includes('file.txt'));
    } finally {
        removeFixture(root);
    }
});

test('fullPath prints root relative paths and an absolute header', () => {
    const root = createFixture({ src: { 'index.js': 'x' } });
    try {
        const output = generateTree(root, { fullPath: true, ignore: [], useDefaultIgnore: false });
        const [header, branch] = output.trimEnd().split('\n');

        assert.equal(header, `${path.resolve(root).split(path.sep).join('/')}/`);
        assert.ok(branch.endsWith('src/'));
    } finally {
        removeFixture(root);
    }
});

test('showSizes appends file sizes only', () => {
    const root = createFixture({ 'a.txt': 'hello', sub: { 'b.txt': 'hi' } });
    try {
        const output = generateTree(root, { showSizes: true, ignore: [], useDefaultIgnore: false });

        assert.match(output, /a\.txt\s+5 B/);
        assert.match(output, /b\.txt\s+2 B/);
        assert.ok(!/sub\/\s+\d/.test(output), 'directories carry no size');
    } finally {
        removeFixture(root);
    }
});

test('ascii style avoids box drawing characters', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const output = generateTree(root, { style: 'ascii', ignore: [], useDefaultIgnore: false });

        assert.equal(output.trimEnd().split('\n')[1], '`-- a.txt');
        assert.ok(!/[├└│─]/.test(output));
    } finally {
        removeFixture(root);
    }
});

test('color adds ANSI escapes and stripAnsi removes them', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const coloured = generateTree(root, { color: true, ignore: [], useDefaultIgnore: false });
        const plain = generateTree(root, { color: false, ignore: [], useDefaultIgnore: false });

        assert.ok(coloured.includes('\u001B['));
        assert.ok(!plain.includes('\u001B['));
        assert.equal(require('../lib/color').stripAnsi(coloured), plain);
    } finally {
        removeFixture(root);
    }
});

test('summary appends a count line', () => {
    const root = createFixture({ sub: { 'a.txt': 'x' }, 'b.txt': 'yy' });
    try {
        const output = generateTree(root, { summary: true, ignore: [], useDefaultIgnore: false });

        assert.match(output, /1 directory, 2 files, \d+ B\n$/);
    } finally {
        removeFixture(root);
    }
});

test('trailingNewline can be turned off', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        const output = generateTree(root, { trailingNewline: false, ignore: [], useDefaultIgnore: false });

        assert.equal(output.endsWith('\n'), false);
    } finally {
        removeFixture(root);
    }
});

test('symlinked directories are not descended into by default', { skip: !canCreateSymlinks }, () => {
    const root = createFixture({ real: { 'a.txt': 'x' } });
    try {
        fs.symlinkSync(path.join(root, 'real'), path.join(root, 'link'), 'dir');
        const output = generateTree(root, { ignore: [], useDefaultIgnore: false, showSymlinkTarget: true });

        assert.ok(output.includes('link/'), 'the link is listed');
        assert.ok(!output.includes('link/\n') || !/link\/\s*\n\s*[├└]/.test(output), 'no traversal into the link');
    } finally {
        removeFixture(root);
    }
});

test('followSymlinks opts in to traversing symlinked directories', { skip: !canCreateSymlinks }, () => {
    const root = createFixture({ real: { 'a.txt': 'x' } });
    try {
        fs.symlinkSync(path.join(root, 'real'), path.join(root, 'link'), 'dir');
        const output = generateTree(root, { followSymlinks: true, ignore: [], useDefaultIgnore: false });

        assert.match(output, /link\/\n│?\s*[├└]── a\.txt/);
    } finally {
        removeFixture(root);
    }
});

test('generateTree rejects a missing path with a typed error', () => {
    const missing = path.join(createFixture({}), 'nope', 'deeper');
    try {
        assert.throws(
            () => generateTree(missing),
            (error) => {
                assert.ok(error instanceof TreeCliError);
                assert.equal(error.code, 'ERR_TREE_CLI_MISSING');
                assert.match(error.message, /does not exist/);
                return true;
            }
        );
    } finally {
        removeFixture(path.dirname(path.dirname(missing)));
    }
});

test('generateTree rejects a path that is not a directory', () => {
    const root = createFixture({ 'a.txt': 'x' });
    try {
        assert.throws(
            () => generateTree(path.join(root, 'a.txt')),
            (error) => {
                assert.ok(error instanceof TreeCliError);
                assert.equal(error.code, 'ERR_TREE_CLI_NOT_DIR');
                return true;
            }
        );
    } finally {
        removeFixture(root);
    }
});

test('createDocument reports counts, bytes, nodes, and a plain copy', () => {
    const root = createFixture({ sub: { 'a.txt': '12345' }, 'b.txt': '123' });
    try {
        const document = createDocument(root, { ignore: [], useDefaultIgnore: false });

        assert.deepEqual(document.counts, { directories: 1, files: 2 });
        assert.equal(document.bytes, 8);
        assert.equal(document.rootPath, path.resolve(root));
        assert.ok(Array.isArray(document.nodes));
        assert.equal(document.plain, document.text);
    } finally {
        removeFixture(root);
    }
});

test('countEntries ignores the root header and error lines', () => {
    const counts = countEntries(['root/', '├── dir/', '│   └── file.txt', '└── other.txt'].join('\n'));

    assert.deepEqual(counts, { directories: 1, files: 2 });
    assert.deepEqual(countEntries('root/'), { directories: 0, files: 0 });
    assert.deepEqual(countEntries(''), { directories: 0, files: 0 });
});

test('countEntries understands ascii output and size suffixes', () => {
    const counts = countEntries(['root/', '|-- dir/', '|   `-- a.txt   1.2 kB'].join('\n'));

    assert.deepEqual(counts, { directories: 1, files: 1 });
});

test('formatSummary pluralises and includes a size only when there is one', () => {
    assert.equal(formatSummary({ directories: 1, files: 1 }, 0), '1 directory, 1 file');
    assert.equal(formatSummary({ directories: 2, files: 0 }), '2 directories, 0 files');
    assert.equal(formatSummary({ directories: 0, files: 5 }, 1500), '0 directories, 5 files, 1.5 kB');
});

test('totalSize sums files at every level and skips directories', () => {
    const nodes = [
        { isDirectory: true, size: 0, children: [{ isDirectory: false, size: 10, children: [] }] },
        { isDirectory: false, size: 5, children: [] },
    ];

    assert.equal(totalSize(nodes), 15);
    assert.equal(totalSize([]), 0);
});

test('normalizeOptions fills defaults and rejects bad depths', () => {
    const defaults = normalizeOptions({});

    assert.equal(defaults.depth, 0);
    assert.equal(defaults.useDefaultIgnore, true);
    assert.equal(defaults.style, 'unicode');
    assert.equal(defaults.color, false);
    assert.equal(defaults.summary, false);
    assert.equal(defaults.trailingNewline, true);
    assert.deepEqual(defaults.ignore, []);

    assert.equal(normalizeOptions({ depth: 3 }).depth, 3);
    assert.equal(normalizeOptions({ style: 'ascii' }).style, 'ascii');
    assert.equal(normalizeOptions({ style: 'weird' }).style, 'unicode');
    assert.equal(normalizeOptions({ ignore: 'a,b' }).ignore, 'a,b');

    for (const bad of [-1, 1.5, 'two']) {
        assert.throws(() => normalizeOptions({ depth: bad }), TreeCliError, `depth ${bad}`);
    }
});

test('buildNodes reaches nested directories and reports the default ignores', () => {
    const root = createFixture(sampleTree());
    try {
        const nodes = buildNodes(path.resolve(root), normalizeOptions({}));
        const src = nodes.find((node) => node.name === 'src');
        const utils = src.children.find((node) => node.name === 'utils');

        assert.equal(
            nodes.some((node) => node.name === 'node_modules'),
            false
        );
        assert.equal(
            utils.children.some((node) => node.name === 'helpers.js'),
            true
        );
    } finally {
        removeFixture(root);
    }
});
