'use strict';

const fs = require('fs');
const path = require('path');

const { DEFAULT_DEPTH, DEFAULT_IGNORE, DIRECTORY_SUFFIX } = require('./constants');
const { colorizeTree } = require('./color');
const { TreeCliError } = require('./errors');
const { formatSize, renderNodes } = require('./outline');
const { scanDirectory, toPosix } = require('./scanner');

/**
 * @typedef {object} GenerateTreeOptions
 * @property {number} [depth] Levels to descend. `0` or omitted means unlimited.
 * @property {Iterable<string>|string} [ignore] Extra names or paths to skip.
 * @property {boolean} [useDefaultIgnore] Merge {@link DEFAULT_IGNORE} in (default `true`).
 * @property {boolean} [directoriesOnly] List directories only.
 * @property {boolean} [fullPath] Print each entry's path from the root
 *   (`themes/dark.css` instead of `dark.css`). The header becomes the absolute
 *   root so the paths on screen always match what is on disk.
 * @property {boolean} [showSizes] Append human readable file sizes.
 * @property {boolean} [showSymlinkTarget] Render `name -> target` for symlinks.
 * @property {boolean} [followSymlinks] Descend into symlinked directories.
 * @property {'unicode'|'ascii'} [style] Glyph set to draw with.
 * @property {boolean} [color] Force colour on (`true`) or off (`false`).
 * @property {boolean} [summary] Append a `N directories, M files` line.
 * @property {boolean} [trailingNewline] End the document with `\n` (default `true`).
 */

/**
 * @typedef {object} TreeDocument
 * @property {string} text The document to print, colourised when requested.
 * @property {string} plain The same document with no ANSI escapes.
 * @property {{ directories: number, files: number }} counts Entry totals.
 * @property {number} bytes Total size of the listed files.
 * @property {Array<object>} nodes The scanned tree, for programmatic use.
 * @property {string} rootPath Absolute path that was scanned.
 */

/**
 * Walks `targetPath` and returns the tree as a printable string.
 *
 * @param {string} targetPath Directory to scan.
 * @param {GenerateTreeOptions} [options]
 * @returns {string}
 * @throws {TreeCliError} When the target does not exist or cannot be read.
 */
function generateTree(targetPath, options = {}) {
    return createDocument(targetPath, options).text;
}

/**
 * Builds the tree once and returns everything derived from it.
 *
 * Prefer this over {@link generateTree} when the caller also needs the entry
 * counts or a colour-free copy: the filesystem is walked exactly once.
 *
 * @param {string} targetPath Directory to scan.
 * @param {GenerateTreeOptions} [options]
 * @returns {TreeDocument}
 * @throws {TreeCliError} When the target does not exist or cannot be read.
 */
function createDocument(targetPath, options = {}) {
    const rootPath = path.resolve(targetPath || '.');
    const resolved = normalizeOptions(options);
    const nodes = buildNodes(rootPath, resolved);

    const header = resolved.fullPath ? toPosix(rootPath) : path.basename(rootPath) || rootPath;
    const lines = [`${header}${DIRECTORY_SUFFIX}`, ...renderNodes(nodes, resolved)];
    const counts = countEntries(lines.join('\n'));
    const bytes = totalSize(nodes);

    let plain = lines.join('\n') + (resolved.trailingNewline ? '\n' : '');
    if (resolved.summary) plain += `${formatSummary(counts, bytes)}\n`;

    return {
        text: resolved.color ? colorizeTree(plain, { useColor: true }) : plain,
        plain,
        counts,
        bytes,
        nodes,
        rootPath,
    };
}

/**
 * `2 directories, 5 files`, plus a total size when anything was measured.
 *
 * @param {{ directories: number, files: number }} counts
 * @param {number} [bytes]
 * @returns {string}
 */
function formatSummary({ directories, files }, bytes = 0) {
    const dirLabel = directories === 1 ? 'directory' : 'directories';
    const fileLabel = files === 1 ? 'file' : 'files';

    let text = `${directories} ${dirLabel}, ${files} ${fileLabel}`;
    if (bytes > 0) text += `, ${formatSize(bytes)}`;

    return text;
}

/**
 * Recursively reads the filesystem into plain node objects.
 *
 * Kept separate from rendering so traversal can be tested and reused without
 * pulling in any formatting concerns.
 *
 * @param {string} rootPath Absolute directory to scan.
 * @param {Required<GenerateTreeOptions>} options
 * @returns {Array<object>}
 */
function buildNodes(rootPath, options) {
    assertScannableDirectory(rootPath);

    const scanOptions = {
        ignore: options.ignore,
        useDefaultIgnore: options.useDefaultIgnore,
        rootPath,
        directoriesOnly: options.directoriesOnly,
        showSymlinkTarget: options.showSymlinkTarget,
        followSymlinks: options.followSymlinks,
    };

    return walk(rootPath, options.depth, scanOptions);
}

/**
 * Depth limited traversal.
 *
 * @param {string} dirPath Absolute directory to read.
 * @param {number} remaining Levels still allowed below `dirPath`; `0` is unlimited.
 * @param {object} scanOptions Options handed to the scanner.
 * @returns {Array<object>}
 */
function walk(dirPath, remaining, scanOptions) {
    let items;
    try {
        items = scanDirectory(dirPath, scanOptions);
    } catch (error) {
        // The root is validated up front, so reaching here means a nested
        // directory is unreadable. Show it in place instead of aborting.
        return [
            {
                name: '',
                path: '',
                relativePath: '',
                isDirectory: false,
                isSymbolicLink: false,
                linkTarget: null,
                size: 0,
                children: [],
                error: error.message,
            },
        ];
    }

    // `remaining` is the number of levels still allowed below `dirPath`:
    //   0 -> unlimited, so children get unlimited too
    //   1 -> `dirPath`'s entries are the last level, they become leaves
    //   n -> children get n - 1
    const descend = remaining !== 1;
    const next = remaining > 1 ? remaining - 1 : remaining;

    // `--dirs-only` needs no special handling here: the scanner already drops
    // files, so every remaining item is a directory and the walk continues
    // normally.
    return items.map((item) => (descend ? withChildren(item, next, scanOptions) : { ...item, children: [] }));
}

/**
 * Attaches the children of `item`, or marks it as a leaf.
 *
 * @param {object} item Entry produced by the scanner.
 * @param {number} next Depth budget for `item`'s children; `0` is unlimited.
 * @param {object} scanOptions Options handed to the scanner.
 * @returns {object}
 */
function withChildren(item, next, scanOptions) {
    if (!item.isDirectory) return { ...item, children: [] };
    if (item.isSymbolicLink && !scanOptions.followSymlinks) {
        // A symlinked directory is not descended into, which keeps cyclic links
        // from producing an infinite tree.
        return { ...item, children: [] };
    }

    return { ...item, children: walk(item.path, next, scanOptions) };
}

/**
 * Verifies the root is a readable directory before any rendering starts, so a
 * bad target produces one clear error instead of a half-printed tree.
 *
 * @param {string} rootPath
 * @throws {TreeCliError}
 */
function assertScannableDirectory(rootPath) {
    let stats;

    try {
        // `statSync` follows symlinks, so a link pointing at a directory is
        // accepted while a link pointing at a file is rejected here instead of
        // failing later, mid-render.
        stats = fs.statSync(rootPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new TreeCliError(`Path "${rootPath}" does not exist.`, {
                code: 'ERR_TREE_CLI_MISSING',
                cause: error,
            });
        }
        throw new TreeCliError(`Cannot access "${rootPath}": ${error.message}`, {
            code: 'ERR_TREE_CLI_ACCESS',
            cause: error,
        });
    }

    if (!stats.isDirectory()) {
        throw new TreeCliError(`"${rootPath}" is not a directory.`, {
            code: 'ERR_TREE_CLI_NOT_DIR',
        });
    }
}

/**
 * Fills in every default so downstream code never re-checks for `undefined`,
 * and rejects the values that cannot be silently coerced.
 *
 * @param {GenerateTreeOptions} options
 * @returns {Required<GenerateTreeOptions>}
 * @throws {TreeCliError} On an invalid depth.
 */
function normalizeOptions(options) {
    const depth = options.depth == null ? DEFAULT_DEPTH : options.depth;

    if (!Number.isInteger(depth) || depth < 0) {
        throw new TreeCliError(`Depth must be a non-negative integer, received "${options.depth}".`, {
            code: 'ERR_TREE_CLI_DEPTH',
        });
    }

    return {
        depth,
        ignore: options.ignore == null ? [] : options.ignore,
        useDefaultIgnore: options.useDefaultIgnore !== false,
        directoriesOnly: Boolean(options.directoriesOnly),
        fullPath: Boolean(options.fullPath),
        showSizes: Boolean(options.showSizes),
        showSymlinkTarget: Boolean(options.showSymlinkTarget),
        followSymlinks: Boolean(options.followSymlinks),
        style: options.style === 'ascii' ? 'ascii' : 'unicode',
        color: Boolean(options.color),
        summary: Boolean(options.summary),
        trailingNewline: options.trailingNewline !== false,
    };
}

/**
 * Counts the entries of a document produced by {@link generateTree}, ignoring
 * the root header line.
 *
 * @param {string} text A plain (uncoloured) tree document.
 * @returns {{ directories: number, files: number }}
 */
function countEntries(text) {
    let directories = 0;
    let files = 0;

    for (const line of String(text).split('\n')) {
        const branch = line.match(/[├└|`]── |-- /);
        if (!branch) continue;

        const label = line.slice(line.indexOf(branch[0]) + branch[0].length).trimEnd();
        if (label.endsWith(DIRECTORY_SUFFIX)) directories += 1;
        else files += 1;
    }

    return { directories, files };
}

/**
 * Sums file sizes across a node tree.
 *
 * @param {Array<object>} nodes
 * @returns {number}
 */
function totalSize(nodes) {
    let total = 0;

    for (const node of nodes) {
        if (!node.isDirectory) total += node.size || 0;
        if (node.children && node.children.length > 0) total += totalSize(node.children);
    }

    return total;
}

module.exports = {
    DEFAULT_IGNORE,
    TreeCliError,
    buildNodes,
    countEntries,
    createDocument,
    formatSummary,
    generateTree,
    normalizeOptions,
    totalSize,
};
