'use strict';

/**
 * Error raised for problems the user can act on: a missing directory, a path
 * that is not a directory, an unreadable root, or invalid option values.
 *
 * The CLI turns any `TreeCliError` into a single-line stderr message plus a
 * non-zero exit code, without a stack trace.
 */
class TreeCliError extends Error {
    /**
     * @param {string} message Human readable, already free of internal jargon.
     * @param {{ code?: string, cause?: Error }} [options]
     */
    constructor(message, { code = 'ERR_TREE_CLI', cause } = {}) {
        super(message, cause ? { cause } : undefined);
        this.name = 'TreeCliError';
        this.code = code;
        Error.captureStackTrace?.(this, TreeCliError);
    }
}

module.exports = { TreeCliError };
