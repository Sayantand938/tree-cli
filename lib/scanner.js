const fs = require('fs');
const path = require('path');

const DEFAULT_IGNORE = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '.cache',
    '.DS_Store',
];

function getDirectoryItems(dirPath, { ignore = DEFAULT_IGNORE, listOnly = false } = {}) {
    let entries = [];
    try {
        entries = fs.readdirSync(dirPath);
    } catch (error) {
        throw new Error(`Error reading directory: ${error.message}`);
    }

    const validItems = [];

    for (const item of entries) {
        // Correctly ignores both files and folders matching the list
        if (ignore.includes(item)) continue;

        const itemPath = path.join(dirPath, item);
        try {
            const stats = fs.lstatSync(itemPath);
            const isDirectory = stats.isDirectory();

            if (isDirectory || !listOnly) {
                validItems.push({ name: item, path: itemPath, isDirectory });
            }
        } catch {
            // Ignore unreadable items or broken symlinks
        }
    }

    // Sort: Directories first, then alphabetical
    return validItems.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
}

module.exports = {
    getDirectoryItems,
    DEFAULT_IGNORE,
};