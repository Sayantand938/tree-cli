# tree-cli

A beautiful CLI tool to generate directory tree structures similar to the Linux
`tree` command.

## Installation

```bash
npm install -g tree-cli
```

## Usage

```bash
tree-cli [directory] [options]
```

## Options

- `-d, --depth <number>` - Maximum depth to traverse
- `-i, --ignore <dirs>` - Comma-separated directories to ignore (default:
  node_modules,.git,dist,build,coverage,.cache)
- `-f, --full-path` - Show full paths instead of relative
- `-o, --output <file>` - Output to file instead of console
- `-l, --list-only` - Show only directories, no files
- `-h, --help` - Display help
- `-V, --version` - Display version

## Examples

```bash
# Show tree of current directory
tree-cli

# Show tree with max depth of 2
tree-cli -d 2

# Show only directories
tree-cli -l

# Ignore specific directories
tree-cli -i "node_modules,.git,temp"

# Output to file
tree-cli -o tree.txt

# Show full paths
tree-cli -f

# Specify a different directory
tree-cli /path/to/directory
```

## Sample Output

```
my-project/
├── src/
│   ├── index.js
│   ├── utils/
│   │   ├── helpers.js
│   │   └── validators.js
│   └── styles/
│       └── main.css
├── package.json
└── README.md
```
