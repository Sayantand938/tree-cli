'use strict';

/**
 * Public API for `@sayantand938/tree-cli`.
 *
 * The command line interface is a thin wrapper around these exports, so the
 * same behaviour is available to scripts and other tools:
 *
 * ```js
 * const { generateTree } = require('@sayantand938/tree-cli');
 *
 * process.stdout.write(generateTree('.', { depth: 2, directoriesOnly: true }));
 * ```
 *
 * @module @sayantand938/tree-cli
 */

const { colorizeTree, shouldUseColor, stripAnsi } = require('./color');
const { DEFAULT_DEPTH, DEFAULT_IGNORE, DIRECTORY_SUFFIX } = require('./constants');
const { TreeCliError } = require('./errors');
const { ASCII_GLYPHS, UNICODE_GLYPHS, formatSize, getGlyphs, renderNodes } = require('./outline');
const { getDirectoryItems, isIgnored, normalizeIgnore, scanDirectory } = require('./scanner');
const {
    buildNodes,
    countEntries,
    createDocument,
    formatSummary,
    generateTree,
    normalizeOptions,
    totalSize,
} = require('./tree');

module.exports = {
    // Main entry points
    generateTree,
    createDocument,

    // Lower level building blocks, useful when composing custom output
    buildNodes,
    countEntries,
    formatSummary,
    totalSize,
    normalizeOptions,
    renderNodes,
    scanDirectory,
    getDirectoryItems,
    colorizeTree,
    shouldUseColor,
    stripAnsi,
    formatSize,
    getGlyphs,
    isIgnored,
    normalizeIgnore,

    // Constants and errors
    DEFAULT_DEPTH,
    DEFAULT_IGNORE,
    DIRECTORY_SUFFIX,
    ASCII_GLYPHS,
    UNICODE_GLYPHS,
    TreeCliError,
};
