'use strict';

/**
 * Names that are skipped by default when scanning a directory.
 *
 * These are the usual noise directories of a JavaScript project. They are
 * matched against both the entry name and its path relative to the scanned
 * root, so `build` also matches `packages/core/build`.
 *
 * @type {ReadonlyArray<string>}
 */
const DEFAULT_IGNORE = Object.freeze([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.DS_Store',
    'Thumbs.db',
]);

/** Default depth used when the caller does not ask for one. `0` means unlimited. */
const DEFAULT_DEPTH = 0;

/** Character used to render a directory separator suffix. */
const DIRECTORY_SUFFIX = '/';

module.exports = {
    DEFAULT_IGNORE,
    DEFAULT_DEPTH,
    DIRECTORY_SUFFIX,
};
