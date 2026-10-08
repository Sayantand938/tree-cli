'use strict';

const { DIRECTORY_SUFFIX } = require('./constants');

/** Classic `tree(1)` glyphs as the default. */
const UNICODE_GLYPHS = Object.freeze({
    branch: '├── ',
    lastBranch: '└── ',
    vertical: '│   ',
    blank: '    ',
});

/** Pure-ASCII fallback for consoles whose font cannot render box drawing. */
const ASCII_GLYPHS = Object.freeze({
    branch: '|-- ',
    lastBranch: '`-- ',
    vertical: '|   ',
    blank: '    ',
});

const GLYPH_SETS = Object.freeze({
    unicode: UNICODE_GLYPHS,
    ascii: ASCII_GLYPHS,
});

/**
 * Returns the glyph set to draw with.
 *
 * @param {'unicode'|'ascii'} [style]
 * @returns {typeof UNICODE_GLYPHS}
 */
function getGlyphs(style = 'unicode') {
    return GLYPH_SETS[style] || UNICODE_GLYPHS;
}

/**
 * Builds the display label for one entry.
 *
 * Directories get a trailing slash and symlinks get an arrow. When sizes are
 * shown the label is padded to a common width so every size starts in the same
 * column, which is what `labelWidth` is for.
 *
 * @param {object} item Entry produced by the scanner.
 * @param {object} [options]
 * @param {boolean} [options.fullPath] Show the root relative path instead of the name.
 * @param {boolean} [options.showSizes] Append a human readable size.
 * @param {number} [options.labelWidth] Column width the labels are padded to.
 * @param {boolean} [options.showSymlinkTarget] Render `name -> target`.
 * @returns {string}
 */
function buildLabel(item, options = {}) {
    const { fullPath = false, showSizes = false, labelWidth = 0, showSymlinkTarget = false } = options;

    let label = fullPath ? item.relativePath : item.name;
    if (item.isDirectory) label += DIRECTORY_SUFFIX;
    if (showSymlinkTarget && item.linkTarget) label += ` -> ${item.linkTarget}`;

    if (showSizes && !item.isDirectory) {
        return `${label.padEnd(labelWidth)}  ${formatSize(item.size)}`;
    }

    return label;
}

/**
 * Renders an already-built tree of nodes as box drawing lines.
 *
 * This module is intentionally pure: it never touches the filesystem and never
 * emits ANSI escapes. Colour is applied afterwards by `lib/color.js`, which
 * keeps the layout logic trivially testable and byte-identical across
 * platforms.
 *
 * @param {Array<object>} nodes
 * @param {object} [options]
 * @returns {string[]} One string per line, without trailing newlines.
 */
function renderNodes(nodes, options = {}) {
    const glyphs = getGlyphs(options.style);
    // Error placeholders carry no name, so they are rendered as text rather
    // than as an empty label followed by the message.
    const visible = nodes.filter((node) => !node.error);
    const labelWidth = options.showSizes ? computeLabelWidth(visible, options) : 0;
    const lines = [];

    const walk = (children, prefix) => {
        const nested = children.filter((child) => !child.error);

        nested.forEach((node, index) => {
            const isLast = index === nested.length - 1;
            lines.push(
                `${prefix}${isLast ? glyphs.lastBranch : glyphs.branch}${buildLabel(node, { ...options, labelWidth })}`
            );

            if (node.children && node.children.length > 0) {
                walk(node.children, prefix + (isLast ? glyphs.blank : glyphs.vertical));
            }
        });

        for (const broken of children.filter((child) => child.error)) {
            lines.push(`${prefix}${glyphs.lastBranch}[error: ${broken.error}]`);
        }
    };

    // The full list is walked, not the `visible` subset, so that error
    // placeholders reach the loop that renders them.
    walk(nodes, '');
    return lines;
}

/**
 * Widest label in the tree, so every size column lines up.
 *
 * Only file labels are measured, and sizes are excluded from the measurement
 * (otherwise the first padding pass would change the width it is based on).
 *
 * @param {Array<object>} nodes
 * @param {object} options Same options passed to {@link buildLabel}.
 * @returns {number}
 */
function computeLabelWidth(nodes, options) {
    let width = 0;

    const walk = (children) => {
        for (const node of children) {
            const label = buildLabel(node, { ...options, showSizes: false });
            if (!node.isDirectory) width = Math.max(width, label.length);
            if (node.children) walk(node.children);
        }
    };

    walk(nodes);
    return width;
}

/**
 * Human readable byte size: `999 B`, `1.2 kB`, `3.4 MB`.
 *
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
    if (bytes < 1000) return `${bytes} B`;

    const units = ['kB', 'MB', 'GB', 'TB', 'PB'];
    let value = bytes / 1000;
    let unitIndex = 0;

    while (value >= 1000 && unitIndex < units.length - 1) {
        value /= 1000;
        unitIndex += 1;
    }

    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

module.exports = {
    ASCII_GLYPHS,
    GLYPH_SETS,
    UNICODE_GLYPHS,
    buildLabel,
    computeLabelWidth,
    formatSize,
    getGlyphs,
    renderNodes,
};
