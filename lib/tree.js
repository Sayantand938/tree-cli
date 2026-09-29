const path = require('path');
const { getDirectoryItems } = require('./scanner');
const { formatItemName, formatHeader, formatError } = require('./formatter');

function buildSubTree(dirPath, options, prefix = '', depth = 0) {
    const maxDepth = typeof options.depth === 'number' ? options.depth : Infinity;
    if (depth >= maxDepth) return '';

    let items;
    try {
        items = getDirectoryItems(dirPath, options);
    } catch (error) {
        return `${prefix}└── ${formatError(error.message, options.noColor)}\n`;
    }

    let output = '';
    const total = items.length;

    items.forEach((item, index) => {
        const isLast = index === total - 1;
        const branch = isLast ? '└── ' : '├── ';
        const displayName = options.fullPath ? item.path : item.name;

        output += `${prefix}${branch}${formatItemName(displayName, item.isDirectory, options.noColor)}\n`;

        if (item.isDirectory) {
            const nextPrefix = prefix + (isLast ? '    ' : '│   ');
            output += buildSubTree(item.path, options, nextPrefix, depth + 1);
        }
    });

    return output;
}

function generateTree(targetPath, options = {}) {
    const absolutePath = path.resolve(targetPath);
    const rootName = options.fullPath ? absolutePath : (path.basename(absolutePath) || absolutePath);

    const header = formatHeader(rootName, options.noColor);
    const tree = buildSubTree(absolutePath, options, '', 0);

    return header + tree;
}

module.exports = { generateTree };