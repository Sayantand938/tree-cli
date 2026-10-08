'use strict';

const fs = require('fs');
const path = require('path');

const { DEFAULT_IGNORE, DIRECTORY_SUFFIX } = require('./constants');
const { TreeCliError } = require('./errors');

/**
 * Accepts the many shapes a caller may pass for `ignore` and returns a Set of
 * patterns: an array, a comma separated string, or a Set.
 *
 * @param {string|Iterable<string>|null|undefined} ignore
 * @returns {Set<string>}
 */
function normalizeIgnore(ignore) {
    if (ignore == null) return new Set();

    const raw = typeof ignore === 'string' ? ignore.split(',') : Array.from(ignore);

    return new Set(
        raw
            .map((entry) => String(entry).trim())
            .filter(Boolean)
            .map((entry) => entry.replace(/[\\/]+$/, ''))
    );
}

/**
 * True when `name` (or its path relative to the scanned root) is ignored.
 *
 * Matching is exact on the entry name, and exact or prefix based on the
 * relative path, so `src/generated` ignores that directory and its contents
 * while `build` ignores any directory called `build` at any level.
 *
 * @param {string} name Entry name, e.g. `index.js`.
 * @param {string} relativePath Root relative path using `/` separators.
 * @param {Set<string>} patterns
 * @returns {boolean}
 */
function isIgnored(name, relativePath, patterns) {
    if (patterns.size === 0) return false;
    if (patterns.has(name)) return true;
    if (patterns.has(relativePath)) return true;

    for (const pattern of patterns) {
        if (pattern.includes('/') && relativePath.startsWith(`${pattern}/`)) return true;
    }

    return false;
}

/**
 * Reads a single directory level and returns its entries as plain objects.
 *
 * Ordering is stable and predictable: directories first, then files, each
 * group sorted with `localeCompare` using numeric collation so `file2` sorts
 * before `file10`.
 *
 * @param {string} dirPath Absolute path of the directory to read.
 * @param {object} [options]
 * @param {Iterable<string>|string} [options.ignore] Patterns to skip.
 * @param {boolean} [options.useDefaultIgnore] Merge {@link DEFAULT_IGNORE} in.
 * @param {string} [options.rootPath] Root used to build `relativePath`.
 * @param {boolean} [options.directoriesOnly] Skip files and file symlinks.
 * @param {boolean} [options.showSymlinkTarget] Record the symlink destination.
 * @returns {Array<{name: string, path: string, relativePath: string, isDirectory: boolean, isSymbolicLink: boolean, linkTarget: string|null, size: number}>}
 * @throws {TreeCliError} When the directory itself cannot be read.
 */
function scanDirectory(dirPath, options = {}) {
    const { ignore = DEFAULT_IGNORE, useDefaultIgnore = false, rootPath = dirPath } = options;

    const patterns = normalizeIgnore(ignore);
    if (useDefaultIgnore) {
        for (const pattern of normalizeIgnore(DEFAULT_IGNORE)) patterns.add(pattern);
    }

    let entryNames;
    try {
        entryNames = fs.readdirSync(dirPath);
    } catch (error) {
        throw new TreeCliError(`Cannot read directory "${dirPath}": ${error.message}`, {
            code: 'ERR_TREE_CLI_READ',
            cause: error,
        });
    }

    const items = [];

    for (const name of entryNames) {
        const itemPath = path.join(dirPath, name);
        const relativePath = toPosix(path.relative(rootPath, itemPath));

        if (isIgnored(name, relativePath, patterns)) continue;

        const item = describeEntry(name, itemPath, relativePath, {
            directoriesOnly: options.directoriesOnly,
            showSymlinkTarget: options.showSymlinkTarget,
        });
        if (item) items.push(item);
    }

    return items.sort(compareItems);
}

/**
 * Builds the entry descriptor for one path, resolving symlinks when asked.
 *
 * Unreadable entries and broken symlinks are skipped rather than fatal: a tree
 * is a best-effort view of the filesystem.
 *
 * @returns {object|null} `null` when the entry cannot be described.
 */
function describeEntry(name, itemPath, relativePath, options) {
    let linkStats;
    try {
        linkStats = fs.lstatSync(itemPath);
    } catch {
        return null;
    }

    const isSymbolicLink = linkStats.isSymbolicLink();
    let linkTarget = null;
    let stats = linkStats;

    if (isSymbolicLink) {
        try {
            linkTarget = fs.readlinkSync(itemPath);
            // Follow the link to decide whether it is rendered as a directory
            // or a file. `showSymlinkTarget` only controls the `-> target` text.
            stats = fs.statSync(itemPath);
        } catch {
            // A broken link has no target to show and is skipped entirely.
            return null;
        }
    }

    // `--dirs-only` keeps directories and drops everything else, including
    // symlinks whose target is a file.
    if (options.directoriesOnly && !stats.isDirectory()) return null;
    if (stats.isFIFO() || stats.isSocket() || stats.isBlockDevice() || stats.isCharacterDevice()) {
        return null;
    }

    return {
        name,
        path: itemPath,
        relativePath,
        isDirectory: stats.isDirectory(),
        isSymbolicLink,
        linkTarget: options.showSymlinkTarget ? linkTarget : null,
        size: stats.isFile() ? stats.size : 0,
    };
}

/**
 * Directories first, then files; alphabetical within each group.
 *
 * @param {{name: string, isDirectory: boolean}} a
 * @param {{name: string, isDirectory: boolean}} b
 */
function compareItems(a, b) {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' });
}

/** Converts Windows separators to `/` so output is identical on every platform. */
function toPosix(value) {
    return value.split(path.sep).join('/');
}

/**
 * Backwards compatible helper kept from 1.0: returns the direct children of a
 * directory in tree order.
 *
 * New code should prefer {@link scanDirectory}, which also reports relative
 * paths, symlink information, and file sizes.
 *
 * @param {string} dirPath
 * @param {object} [options]
 * @returns {Array<{name: string, path: string, isDirectory: boolean}>}
 */
function getDirectoryItems(dirPath, { ignore = DEFAULT_IGNORE, listOnly = false } = {}) {
    return scanDirectory(dirPath, {
        ignore,
        directoriesOnly: listOnly,
    }).map((item) => ({
        name: item.name,
        path: item.path,
        isDirectory: item.isDirectory,
    }));
}

module.exports = {
    DEFAULT_IGNORE,
    DIRECTORY_SUFFIX,
    compareItems,
    getDirectoryItems,
    isIgnored,
    normalizeIgnore,
    scanDirectory,
    toPosix,
};
