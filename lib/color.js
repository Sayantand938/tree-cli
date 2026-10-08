'use strict';

const { DIRECTORY_SUFFIX } = require('./constants');

const ANSI_PATTERN = /\u001B\[[0-9;]*m/g;

const ANSI = Object.freeze({
    reset: '\u001B[0m',
    bold: '\u001B[1m',
    dim: '\u001B[2m',
    red: '\u001B[31m',
    green: '\u001B[32m',
    cyan: '\u001B[36m',
    white: '\u001B[37m',
    gray: '\u001B[90m',
    magenta: '\u001B[35m',
});

/** Lines emitted by the renderer that are coloured as errors. */
const ERROR_PATTERN = /\[error: /;

/** Split a rendered line into its box-drawing guide and its label. */
const GUIDE_PATTERN = /^([\s│├└─|`+\-]*)([\s\S]*)$/;

/** Characters that may introduce a tree line, as opposed to prose like a summary. */
const GUIDE_START = /^[│├└─|`+\-]/;

/**
 * Resolves whether colour should be used for the current run.
 *
 * Precedence: explicit CLI flag, then the `NO_COLOR` / `FORCE_COLOR`
 * environment conventions, then whether the destination is a TTY.
 *
 * @param {object} [options]
 * @param {boolean|null} [options.color] `true`/`false` when the user forced it.
 * @param {boolean} [options.isTTY] Whether the destination supports colour.
 * @param {NodeJS.ProcessEnv} [options.env]
 * @returns {boolean}
 */
function shouldUseColor({ color = null, isTTY = false, env = process.env } = {}) {
    if (color === true) return true;
    if (color === false) return false;
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== '') return false;
    if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== '' && env.FORCE_COLOR !== '0') return true;
    if (env.TERM === 'dumb') return false;
    return Boolean(isTTY);
}

/**
 * Applies ANSI styling to one rendered tree line.
 *
 * Styling is purely additive: the visible characters never change, so a
 * colourised tree and a plain tree always agree once escapes are stripped.
 * Lines that do not look like tree lines are returned untouched.
 *
 * @param {string} line
 * @param {object} [options]
 * @param {boolean} [options.useColor] When false the line is returned as is.
 * @param {boolean} [options.header] Whether line 0 is the root header.
 * @param {number} [options.lineIndex] Zero based index of `line`.
 * @returns {string}
 */
function colorizeLine(line, { useColor = false, header = false, lineIndex = 0 } = {}) {
    if (!useColor || line === '') return line;
    if (header && lineIndex === 0) return `${ANSI.green}${ANSI.bold}${line}${ANSI.reset}`;
    if (ERROR_PATTERN.test(line)) return `${ANSI.red}${line}${ANSI.reset}`;

    // Anything that does not open with a guide character is prose, such as the
    // summary line, and is left exactly as it is.
    if (!GUIDE_START.test(line)) return line;

    const [, guides = '', label = ''] = line.match(GUIDE_PATTERN) || [];
    if (label === '') return line;

    return `${ANSI.dim}${guides}${ANSI.reset}${styleLabel(label)}`;
}

/**
 * Picks the colour for a label from its own text, without needing the node:
 * directory labels end in `/`, symlinks contain ` -> `, everything else is a
 * file.
 *
 * @param {string} label
 * @returns {string}
 */
function styleLabel(label) {
    if (label.endsWith(DIRECTORY_SUFFIX)) return `${ANSI.cyan}${ANSI.bold}${label}${ANSI.reset}`;
    if (label.includes(' -> ')) return `${ANSI.magenta}${label}${ANSI.reset}`;
    return `${ANSI.white}${label}${ANSI.reset}`;
}

/**
 * Colourises a whole tree document.
 *
 * @param {string} text
 * @param {object} [options]
 * @param {boolean} [options.useColor]
 * @param {boolean} [options.header] Whether the first line is the root header.
 * @returns {string}
 */
function colorizeTree(text, { useColor = false, header = true } = {}) {
    if (!useColor || text === '') return text;

    return text
        .split('\n')
        .map((line, lineIndex) => colorizeLine(line, { useColor, header, lineIndex }))
        .join('\n');
}

/**
 * Removes every ANSI escape sequence. Used before writing a file and as the
 * safety net for `--no-color`.
 *
 * @param {string} text
 * @returns {string}
 */
function stripAnsi(text) {
    return String(text).replace(ANSI_PATTERN, '');
}

module.exports = {
    ANSI,
    colorizeLine,
    colorizeTree,
    shouldUseColor,
    stripAnsi,
    styleLabel,
};
