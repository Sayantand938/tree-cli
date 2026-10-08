# Contributing

Thanks for taking the time to improve this project. This document describes how
to get set up and what a good change looks like.

## Getting started

```bash
git clone https://github.com/SayantanD938/tree-cli.git
cd tree-cli
npm install
npm test
```

The project targets Node.js 18 and newer and has no build step: the files that
ship are the files in the repository.

## Project layout

| Path         | Purpose                                                            |
| ------------ | ------------------------------------------------------------------ |
| `bin/cli.js` | Executable shim. It only calls `lib/cli.js`, so keep it empty.     |
| `lib/`       | All source. `lib/index.js` is the public API.                      |
| `test/`      | `node:test` suites, one per module, plus `test/fixtures/`.         |
| `scripts/`   | Repository maintenance helpers, not part of the published package. |

The module boundaries matter:

- `scanner.js` only reads the filesystem and returns plain objects. It never
  formats anything.
- `outline.js` is pure: it takes nodes and returns lines. It never touches the
  filesystem and never emits ANSI escapes.
- `color.js` is the only place that knows about ANSI escapes.
- `tree.js` walks the filesystem and assembles the document.
- `reporter.js` turns a request into stdout, stderr, and an exit code.
- `cli.js` wires argument parsing to the reporter.

Please keep new code on the correct side of those lines.

## Making a change

1. Create a branch: `git checkout -b fix/short-description`.
2. Make the change, and add or update tests for it.
3. Run `npm test` and `npm run coverage`. Coverage should not drop.
4. Run `npm run lint` to check formatting, or `npm run format` to fix it.
5. Open a pull request using the repository template.

## Tests

Tests use the built-in `node:test` runner and `node:assert/strict`. No test
framework is installed, and none should be added.

```bash
npm test                      # everything
node --test test/tree.test.js # one file
npm run coverage              # with a coverage report
```

Write tests that state the rule rather than snapshotting output. For example,
assert that directories sort before files, and that file sizes line up in a
column, instead of pasting a whole tree.

Create temporary directory trees with `createFixture` from
`test/fixtures/helpers.js`. It handles cleanup through `removeFixture`. Tests
that need symlinks should use the exported `canCreateSymlinks` flag so they
skip cleanly where symlink creation needs elevation.

## Style

Formatting is handled by Prettier using the configuration in `package.json`:
4-space indentation, single quotes, 120-column width, ES5 trailing commas. Run
`npm run format` before committing.

Beyond formatting:

- Use `'use strict';` at the top of every CommonJS file.
- Document exported functions with JSDoc, including types, defaults, and thrown
  errors.
- Prefer clear names over comments. Where a decision is not obvious, explain
  why, not what.
- Keep the public API additive. This is a major-version concern to change
  anything that already ships.
- Never call `process.exit` in `lib/`. Return an exit code and let `bin/cli.js`
  assign it.

## Commits and pull requests

Write commit subjects in the imperative mood: `fix: honour --depth`. Grouping
by prefix (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) is welcome but not
enforced.

A pull request should explain the problem, the approach, and how it was
verified. Link the issue it closes when there is one. Keep unrelated changes in
separate pull requests.

## Reporting bugs

Open an issue with the template. Include your Node version, your operating
system, the exact command, and the output you expected against what you got.
For a rendering problem, showing the raw output with `--no-color` is the most
useful thing you can provide.

## Releasing

Releases are cut by maintainers:

1. Update `CHANGELOG.md` and the version in `package.json`.
2. Commit as `chore: release vX.Y.Z`.
3. Tag it: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The release workflow verifies and publishes to npm using trusted
   publishing, or publish manually with `npm publish`.

`prepublishOnly` runs the test suite, so a broken release cannot be published
by accident.
