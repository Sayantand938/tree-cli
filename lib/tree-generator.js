const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class TreeGenerator {
    constructor(options = {}) {
        this.maxDepth = options.depth || Infinity;
        this.ignoreDirs = options.ignoreDirs || ['node_modules', '.git', 'dist', 'build', '.DS_Store'];
        this.fullPath = options.fullPath || false;
        this.listOnly = options.listOnly || false; // True if we only want to list directories
    }

    generateTree(dirPath, prefix = '', depth = 0) {
        if (depth >= this.maxDepth) return '';

        let output = '';
        let items = [];

        try {
            items = fs.readdirSync(dirPath);
        } catch (error) {
            return `${prefix}└── ${chalk.red(`Error reading directory: ${error.message}`)}\n`;
        }

        const validItems = [];

        // Single pass to get stats and filter items safely
        items.forEach(item => {
            const itemPath = path.join(dirPath, item);
            try {
                const stats = fs.statSync(itemPath);
                const isDirectory = stats.isDirectory();

                if (isDirectory && !this.ignoreDirs.includes(item)) {
                    validItems.push({ name: item, path: itemPath, isDirectory });
                } else if (!isDirectory && !this.listOnly) {
                    validItems.push({ name: item, path: itemPath, isDirectory });
                }
            } catch (e) {
                // Ignore unreadable items seamlessly
            }
        });

        // Sort: Directories first, then files (alphabetically)
        validItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        const totalItems = validItems.length;

        validItems.forEach((item, index) => {
            const isLastItem = index === totalItems - 1;

            // Branch characters
            const branch = isLastItem ? '└── ' : '├── ';

            // Format display name
            const displayName = this.fullPath ? item.path : item.name;
            let coloredName = item.isDirectory
                ? chalk.cyan.bold(displayName + '/')
                : chalk.white(displayName);

            // Append current line to tree output
            output += `${prefix}${branch}${coloredName}\n`;

            // Recursively handle subdirectories
            if (item.isDirectory) {
                // If it's the last item, the next level down shouldn't draw a vertical line connecting downwards
                const nextPrefix = prefix + (isLastItem ? '    ' : '│   ');
                output += this.generateTree(item.path, nextPrefix, depth + 1);
            }
        });

        return output;
    }

    generate(dirPath) {
        const absolutePath = path.resolve(dirPath);
        const rootName = this.fullPath ? absolutePath : path.basename(absolutePath);

        // Print the starting root node beautifully
        const header = chalk.green.bold(`📁 ${rootName}`) + '\n';
        const tree = this.generateTree(absolutePath, '', 0);

        return header + tree;
    }
}

function generateTree(dirPath, options = {}) {
    const generator = new TreeGenerator(options);
    return generator.generate(dirPath);
}

module.exports = { TreeGenerator, generateTree };