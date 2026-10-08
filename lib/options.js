'use strict';

const { DEFAULT_DEPTH, DEFAULT_IGNORE } = require('./constants');
const { shouldUseColor } = require('./color');
const { TreeCliError } = require('./errors');

/**
 * @typedef {object} CliOptions
 * @property {string} [depth] Raw `--depth` value, still a string.
 * @property {string} [ignore] Raw `--ignore` value, comma separated.
 * @property {boolean} [all] `--all`: include files that would be ignored.
 * @property {boolean} [fullPath] `--full-path`.
 * @property {boolean} [dirsOnly] `--dirs-only`.
 * @property {boolean} [sizes] `--sizes`.
 * @property {'unicode'|'ascii'} [charset] `--charset`.
 * @property {boolean} [color] `--color` / `--no-color`.
 * @property {string} [output] `--output`.
 */

/**
 * Turns raw commander values into the option object `generateTree` expects.
 *
 * Validation lives here rather than in the library so the CLI can fail fast
 * with a friendly message before any filesystem work happens.
 *
 * @param {CliOptions} raw Options straight from commander.
 * @param {{ isTTY?: boolean, env?: NodeJS.ProcessEnv }} [context]
 * @returns {import('./tree').GenerateTreeOptions}
 * @throws {TreeCliError} On an invalid depth or output path.
 */
function parseCliOptions(raw = {}, { isTTY = false, env = process.env } = {}) {
    const depth = parseDepth(raw.depth);
    const ignore = parseIgnore(raw.ignore);
    const useDefaultIgnore = raw.all !== true;
    const outputPath = normalizeOutputPath(raw.output);

    const color = resolveColor({
        // Writing to a file always produces a plain document so the artefact
        // is diffable and safe to paste anywhere.
        requested: outputPath ? false : raw.color,
        isTTY,
        env,
    });

    return {
        depth,
        ignore,
        useDefaultIgnore,
        directoriesOnly: Boolean(raw.dirsOnly),
        fullPath: Boolean(raw.fullPath),
        showSizes: Boolean(raw.sizes),
        showSymlinkTarget: true,
        style: raw.charset === 'ascii' ? 'ascii' : 'unicode',
        color,
        summary: Boolean(raw.summary),
        followSymlinks: Boolean(raw.followSymlinks),
        trailingNewline: true,
        outputPath,
    };
}

/**
 * Normalises the tri-state `--color` / `--no-color` flag into a boolean.
 *
 * @param {{ requested?: boolean, isTTY?: boolean, env?: NodeJS.ProcessEnv }} input
 * @returns {boolean}
 */
function resolveColor({ requested, isTTY = false, env = process.env }) {
    if (requested === true) return true;
    if (requested === false) return false;
    return shouldUseColor({ color: null, isTTY, env });
}

/**
 * @param {string|number|undefined} value
 * @returns {number} `0` means unlimited.
 * @throws {TreeCliError}
 */
function parseDepth(value) {
    if (value == null || value === '') return DEFAULT_DEPTH;

    const depth = Number(value);
    if (!Number.isInteger(depth) || depth < 0) {
        throw new TreeCliError(`--depth expects a whole number of 0 or more, received "${value}".`, {
            code: 'ERR_TREE_CLI_DEPTH',
        });
    }

    return depth;
}

/**
 * Splits `--ignore` on commas and strips whitespace and trailing separators.
 *
 * @param {string|undefined} value
 * @returns {string[]}
 */
function parseIgnore(value) {
    if (value == null || value === '') return [];

    return String(value)
        .split(',')
        .map((entry) => entry.trim().replace(/[\\/]+$/, ''))
        .filter(Boolean);
}

/**
 * @param {string|undefined} value
 * @returns {string|undefined} `undefined` when no file was requested.
 */
function normalizeOutputPath(value) {
    if (value == null || value === '') return undefined;
    return String(value);
}

/**
 * The list of names hidden unless `--all` is passed, used in `--help` text.
 *
 * @returns {string}
 */
function defaultIgnoreHint() {
    return DEFAULT_IGNORE.join(', ');
}

module.exports = {
    defaultIgnoreHint,
    normalizeOutputPath,
    parseCliOptions,
    parseDepth,
    parseIgnore,
    resolveColor,
};
