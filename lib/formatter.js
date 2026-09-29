const chalk = require('chalk');

function formatItemName(name, isDirectory, noColor = false) {
    if (noColor) {
        return isDirectory ? `${name}/` : name;
    }
    return isDirectory ? chalk.cyan.bold(`${name}/`) : chalk.white(name);
}

function formatHeader(rootName, noColor = false) {
    const text = `📁 ${rootName}`;
    return (noColor ? text : chalk.green.bold(text)) + '\n';
}

function formatError(message, noColor = false) {
    return noColor ? message : chalk.red(message);
}

module.exports = {
    formatItemName,
    formatHeader,
    formatError,
};