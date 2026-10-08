'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { DEFAULT_IGNORE } = require('../lib/constants');
const { TreeCliError } = require('../lib/errors');
const {
    defaultIgnoreHint,
    normalizeOutputPath,
    parseCliOptions,
    parseDepth,
    parseIgnore,
    resolveColor,
} = require('../lib/options');

test('parseDepth reads whole numbers and treats 0 as unlimited', () => {
    assert.equal(parseDepth('3'), 3);
    assert.equal(parseDepth(3), 3);
    assert.equal(parseDepth('0'), 0);
    assert.equal(parseDepth(undefined), 0);
    assert.equal(parseDepth(''), 0);
});

test('parseDepth rejects anything that is not a non-negative integer', () => {
    for (const bad of ['abc', '1.5', '-2', 'NaN']) {
        assert.throws(
            () => parseDepth(bad),
            (error) => {
                assert.ok(error instanceof TreeCliError);
                assert.equal(error.code, 'ERR_TREE_CLI_DEPTH');
                assert.match(error.message, /--depth expects/);
                return true;
            },
            `expected ${bad} to be rejected`
        );
    }
});

test('parseIgnore splits, trims, and drops empty entries', () => {
    assert.deepEqual(parseIgnore('a, b , ,c'), ['a', 'b', 'c']);
    assert.deepEqual(parseIgnore('dist/'), ['dist']);
    assert.deepEqual(parseIgnore('build\\'), ['build']);
    assert.deepEqual(parseIgnore(undefined), []);
    assert.deepEqual(parseIgnore(''), []);
});

test('normalizeOutputPath only reports a path when one was given', () => {
    assert.equal(normalizeOutputPath('out/tree.txt'), 'out/tree.txt');
    assert.equal(normalizeOutputPath(''), undefined);
    assert.equal(normalizeOutputPath(undefined), undefined);
});

test('resolveColor follows the explicit flag before the environment', () => {
    assert.equal(resolveColor({ requested: true, isTTY: false, env: {} }), true);
    assert.equal(resolveColor({ requested: false, isTTY: true, env: {} }), false);
    assert.equal(resolveColor({ requested: undefined, isTTY: true, env: {} }), true);
    assert.equal(resolveColor({ requested: undefined, isTTY: false, env: {} }), false);
});

test('parseCliOptions produces a complete option object', () => {
    const options = parseCliOptions({}, { isTTY: false, env: {} });

    assert.deepEqual(options, {
        depth: 0,
        ignore: [],
        useDefaultIgnore: true,
        directoriesOnly: false,
        fullPath: false,
        showSizes: false,
        showSymlinkTarget: true,
        style: 'unicode',
        color: false,
        summary: false,
        followSymlinks: false,
        trailingNewline: true,
        outputPath: undefined,
    });
});

test('parseCliOptions maps every documented flag', () => {
    const options = parseCliOptions(
        {
            depth: '2',
            ignore: 'dist, build',
            all: true,
            fullPath: true,
            dirsOnly: true,
            sizes: true,
            charset: 'ascii',
            summary: true,
            followSymlinks: true,
            color: true,
        },
        { isTTY: false, env: {} }
    );

    assert.equal(options.depth, 2);
    assert.deepEqual(options.ignore, ['dist', 'build']);
    assert.equal(options.useDefaultIgnore, false);
    assert.equal(options.fullPath, true);
    assert.equal(options.directoriesOnly, true);
    assert.equal(options.showSizes, true);
    assert.equal(options.style, 'ascii');
    assert.equal(options.summary, true);
    assert.equal(options.followSymlinks, true);
    assert.equal(options.color, true, '--color wins over a non-TTY stream');
});

test('writing to a file always disables colour', () => {
    const options = parseCliOptions({ color: true, output: 'tree.txt' }, { isTTY: true, env: {} });

    assert.equal(options.outputPath, 'tree.txt');
    assert.equal(options.color, false);
});

test('an unknown charset falls back to unicode', () => {
    assert.equal(parseCliOptions({ charset: 'klingon' }, { isTTY: false }).style, 'unicode');
});

test('defaultIgnoreHint lists the names hidden by default', () => {
    const hint = defaultIgnoreHint();

    assert.equal(hint, DEFAULT_IGNORE.join(', '));
    assert.ok(hint.includes('node_modules'));
});
