'use strict';

const fs = require('fs');
const path = require('path');

const { createDocument, formatSummary } = require('./tree');
const { stripAnsi } = require('./color');
const { TreeCliError } = require('./errors');

/**
 * Runs one tree generation request and returns everything the CLI should emit.
 *
 * All filesystem work and formatting happens here so `bin/cli.js` stays a thin
 * shell around argument parsing, printing, and exit codes.
 *
 * @param {string} target Directory to scan.
 * @param {object} options Normalised options, including `outputPath`, `color`, `summary`.
 * @param {{ stdout?: NodeJS.WriteStream, stderr?: NodeJS.WriteStream }} [streams]
 * @returns {{ stdout: string, stderr: string, exitCode: number }}
 */
function run(target, options, streams = {}) {
    const stdout = streams.stdout || process.stdout;
    const stderr = streams.stderr || process.stderr;

    try {
        const document = createDocument(target, {
            ...options,
            // The summary is assembled here so the counts and the sizes always
            // come from the same single scan.
            summary: false,
            color: options.outputPath ? false : options.color,
        });

        const summaryText = options.summary ? `${formatSummary(document.counts, document.bytes)}\n` : '';

        if (options.outputPath) {
            const absolute = writeOutputFile(options.outputPath, document.plain + summaryText);
            return {
                stdout: '',
                stderr: `Saved tree to: ${absolute}\n`,
                exitCode: 0,
            };
        }

        return {
            stdout: document.text + summaryText,
            stderr: '',
            exitCode: 0,
        };
    } catch (error) {
        return {
            stdout: '',
            stderr: `${formatError(error)}\n`,
            exitCode: 1,
        };
    }
}

/**
 * Writes the tree to disk, always without ANSI escapes.
 *
 * @param {string} outputPath
 * @param {string} content
 * @returns {string} The absolute path that was written.
 * @throws {TreeCliError}
 */
function writeOutputFile(outputPath, content) {
    const absolute = path.resolve(outputPath);

    try {
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, stripAnsi(content), 'utf8');
    } catch (error) {
        throw new TreeCliError(`Cannot write "${absolute}": ${error.message}`, {
            code: 'ERR_TREE_CLI_WRITE',
            cause: error,
        });
    }

    return absolute;
}

/**
 * Renders any thrown value as a single friendly line.
 *
 * Unexpected errors keep their message but gain a hint, so a bug report always
 * has something actionable to quote.
 *
 * @param {unknown} error
 * @returns {string}
 */
function formatError(error) {
    if (error instanceof TreeCliError) return `Error: ${error.message}`;
    if (error instanceof Error) return `Error: ${error.message}`;

    return `Error: ${String(error)}`;
}

module.exports = { formatError, run, writeOutputFile };
