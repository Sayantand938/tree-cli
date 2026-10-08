'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Keys that name a directory; every other key is a file whose value is the
 * content to write. A `null` directory creates an empty one.
 *
 * @typedef {Object<string, string|null|Fixture>} Fixture
 */

let counter = 0;

/**
 * Materialises a fixture object in a fresh temporary directory.
 *
 * @param {Fixture} tree
 * @returns {string} Absolute path of the created root.
 */
function createFixture(tree) {
    counter += 1;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), `tree-cli-test-${process.pid}-${counter}-`));
    writeInto(root, tree);
    return root;
}

/**
 * Removes a fixture created by {@link createFixture}.
 *
 * @param {string} root
 */
function removeFixture(root) {
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
}

/**
 * @param {string} baseDir
 * @param {Fixture} tree
 */
function writeInto(baseDir, tree) {
    for (const [name, value] of Object.entries(tree)) {
        const target = path.join(baseDir, name);

        if (value === null || value === undefined) {
            fs.mkdirSync(target, { recursive: true });
            continue;
        }

        if (typeof value === 'object') {
            fs.mkdirSync(target, { recursive: true });
            writeInto(target, value);
            continue;
        }

        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, value, 'utf8');
    }
}

/**
 * The tree most tests assert against.
 *
 * ```text
 * <root>/
 * ├── docs/
 * │   └── guide.md
 * ├── src/
 * │   ├── styles/
 * │   │   └── main.css
 * │   ├── utils/
 * │   │   ├── deep/
 * │   │   │   └── validators.js
 * │   │   └── helpers.js
 * │   └── index.js
 * ├── node_modules/
 * │   └── chalk/
 * │       └── index.js
 * ├── .hidden
 * ├── README.md
 * └── package.json
 * ```
 *
 * @returns {Fixture}
 */
function sampleTree() {
    return {
        docs: { 'guide.md': '# guide' },
        src: {
            styles: { 'main.css': 'body{}' },
            utils: {
                deep: { 'validators.js': 'export const v = 1;' },
                'helpers.js': 'export const h = 1;',
            },
            'index.js': 'export default 1;',
        },
        node_modules: { chalk: { 'index.js': 'module.exports = {}' } },
        '.hidden': 'secret',
        'README.md': '# readme',
        'package.json': '{"name":"fixture"}',
    };
}

/** True when the current platform can create symlinks without elevation. */
const canCreateSymlinks = (() => {
    const probe = path.join(os.tmpdir(), `tree-cli-probe-${process.pid}`);
    try {
        fs.symlinkSync(probe, `${probe}-link`, 'dir');
        fs.unlinkSync(`${probe}-link`);
        return true;
    } catch {
        return false;
    }
})();

module.exports = { canCreateSymlinks, createFixture, removeFixture, sampleTree, writeInto };
