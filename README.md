# tree-cli

> Print a directory tree from the command line, like the Unix `tree` command.

[![CI](https://github.com/SayantanD938/tree-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/SayantanD938/tree-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@sayantand938/tree-cli.svg)](https://www.npmjs.com/package/@sayantand938/tree-cli)
[![npm downloads](https://img.shields.io/npm/dm/@sayantand938/tree-cli.svg)](https://www.npmjs.com/package/@sayantand938/tree-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/node/v/@sayantand938/tree-cli.svg)](https://nodejs.org)

A small, dependency-light CLI that renders a folder as a tree. It works on
Windows, macOS, and Linux, needs no build step, and can also be used as a
library.

```text
my-project/
├── src/
│   ├── styles/
│   │   └── main.css
│   ├── utils/
│   │   ├── helpers.js
│   │   └── validators.js
│   └── index.js
├── package.json
└── README.md
```

## Install

```bash
npm install --global @sayantand938/tree-cli
```

This provides two commands, `tree` and `tree-cli`. Or run it without
installing:

```bash
npx @sayantand938/tree-cli
```

Requires Node.js 18 or newer.

## Usage

```bash
tree [directory] [options]
```

`directory` defaults to the current working directory.

### Options

| Option                  | Description                                                                   |
| ----------------------- | ----------------------------------------------------------------------------- |
| `-d, --depth <number>`  | Levels to descend. `0` (the default) is unlimited.                            |
| `-i, --ignore <names>`  | Extra names or paths to ignore, comma separated. Merged with the defaults.    |
| `-a, --all`             | Do not hide the default ignored names.                                        |
| `-f, --full-path`       | Print the path of each entry from the root instead of just its name.          |
| `--dirs-only`           | List directories only.                                                        |
| `-s, --sizes`           | Show the size of each file, in an aligned column.                             |
| `-c, --charset <style>` | Drawing style: `unicode` (default) or `ascii`.                                |
| `--summary`             | Print a total count of directories and files.                                 |
| `--follow-symlinks`     | Descend into symlinked directories. Off by default, so cyclic links are safe. |
| `--color`               | Force colour output.                                                          |
| `--no-color`            | Disable colour output.                                                        |
| `-o, --output <file>`   | Write the tree to a file instead of stdout. Parent directories are created.   |
| `-V, --version`         | Print the version number.                                                     |
| `-h, --help`            | Print the help text.                                                          |

### Default ignores

`node_modules`, `.git`, `.svn`, `.hg`, `dist`, `build`, `coverage`, `.cache`,
`.DS_Store`, `Thumbs.db`.

Pass `--all` to include them, or `--ignore` to add more.

### Examples

```bash
# Tree of the current directory
tree

# Two levels of a subdirectory
tree src --depth 2

# Directories only, skipping an extra folder
tree --dirs-only --ignore "dist,coverage"

# File sizes plus a summary line
tree . --sizes --summary

# ASCII output, saved to a file
tree --charset ascii -o structure.txt
```

### Colour

Colour is used only when stdout is a terminal, and it is always disabled when
writing to a file. The usual conventions are respected: `NO_COLOR` disables
colour and `FORCE_COLOR=1` enables it. `--color` and `--no-color` win over
both.

### Exit codes

| Code | Meaning                                                                                                  |
| ---- | -------------------------------------------------------------------------------------------------------- |
| `0`  | Success.                                                                                                 |
| `1`  | The target is missing or not a directory, an option is invalid, or the output file could not be written. |

Errors are printed to stderr as a single line. `--output` never pollutes
stdout, so `tree > tree.txt` behaves as expected.

## Library API

The CLI is a thin wrapper around the same functions you can require directly.

```js
const { generateTree } = require('@sayantand938/tree-cli');

process.stdout.write(generateTree('src', { depth: 2, directoriesOnly: true }));
```

### `generateTree(target, options?)`

Returns the rendered tree as a string.

| Option              | Type                   | Default     | Description                            |
| ------------------- | ---------------------- | ----------- | -------------------------------------- |
| `depth`             | `number`               | `0`         | Levels to descend. `0` is unlimited.   |
| `ignore`            | `string \| string[]`   | `[]`        | Names or root-relative paths to skip.  |
| `useDefaultIgnore`  | `boolean`              | `true`      | Merge the default ignore list in.      |
| `directoriesOnly`   | `boolean`              | `false`     | List directories only.                 |
| `fullPath`          | `boolean`              | `false`     | Print each entry's path from the root. |
| `showSizes`         | `boolean`              | `false`     | Append file sizes.                     |
| `showSymlinkTarget` | `boolean`              | `false`     | Render `name -> target` for symlinks.  |
| `followSymlinks`    | `boolean`              | `false`     | Descend into symlinked directories.    |
| `style`             | `'unicode' \| 'ascii'` | `'unicode'` | Glyph set to draw with.                |
| `color`             | `boolean`              | `false`     | Wrap the output in ANSI escapes.       |
| `summary`           | `boolean`              | `false`     | Append a count line.                   |
| `trailingNewline`   | `boolean`              | `true`      | End the document with `\n`.            |

Throws a `TreeCliError` when the target does not exist, is not a directory, or
cannot be read.

### `createDocument(target, options?)`

Builds the tree once and returns everything derived from it. Use this instead
of calling `generateTree` when you also need the counts, so the filesystem is
walked only one time.

```js
const { createDocument } = require('@sayantand938/tree-cli');

const { text, plain, counts, bytes, nodes, rootPath } = createDocument('.', { depth: 2 });
```

### Other exports

`buildNodes`, `countEntries`, `formatSummary`, `totalSize`, `normalizeOptions`,
`renderNodes`, `scanDirectory`, `getDirectoryItems`, `colorizeTree`,
`shouldUseColor`, `stripAnsi`, `formatSize`, `getGlyphs`, `isIgnored`,
`normalizeIgnore`, plus the constants `DEFAULT_DEPTH`, `DEFAULT_IGNORE`,
`DIRECTORY_SUFFIX`, `UNICODE_GLYPHS`, `ASCII_GLYPHS`, and `TreeCliError`.

## Project layout

```text
.
├── bin/
│   └── cli.js           Executable shim
├── lib/
│   ├── cli.js           Argument parsing wiring and exit codes
│   ├── color.js         ANSI styling and colour policy
│   ├── constants.js     Defaults and shared literals
│   ├── errors.js        TreeCliError
│   ├── index.js         Public API
│   ├── options.js       Raw CLI flags to normalised options
│   ├── outline.js       Pure box-drawing renderer
│   ├── reporter.js      Produces stdout/stderr/exit code
│   ├── scanner.js       Filesystem reads
│   └── tree.js          Traversal and document assembly
├── test/                node:test suites
└── scripts/             Repository maintenance scripts
```

## Development

```bash
git clone https://github.com/SayantanD938/tree-cli.git
cd tree-cli
npm install
npm test          # run the suite
npm run coverage  # run it with coverage
npm run lint      # check formatting
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow.

## License

[MIT](LICENSE) © Sayantan Das
