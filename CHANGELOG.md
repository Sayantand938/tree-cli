# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0]

The first publishable release. The package is renamed to
`@sayantand938/tree-cli` because `tree-cli` is already taken on npm.

### Added

- `--dirs-only`, `--sizes`, `--summary`, `--all`, `--charset ascii`,
  `--follow-symlinks`, `--color`, and `--no-color` options.
- A library API, with `generateTree` and `createDocument` as the entry points.
- `TreeCliError`, so callers can distinguish expected failures from bugs.
- Cross-platform output: paths always use `/` separators.
- Symlink support, including `name -> target` rendering. Symlinked directories
  are not traversed unless `--follow-symlinks` is passed, which keeps cyclic
  links safe.
- A `node:test` suite with 98 tests and roughly 98% line coverage.
- GitHub Actions CI across Ubuntu, Windows, and macOS on Node 18, 20, 22, and
  24, plus a tagged release workflow.
- `LICENSE`, this changelog, `CONTRIBUTING.md`, `SECURITY.md`, `.editorconfig`,
  and issue and pull request templates.

### Changed

- Source is split into focused modules under `lib/` instead of a single
  `tree.js`, `scanner.js`, and `formatter.js`. `lib/index.js` is the public
  entry point.
- `--full-path` now prints paths relative to the scanned root and promotes the
  header to an absolute path, so the lines on screen stay consistent. It
  previously printed an absolute path in the header next to bare names.
- Rendering is separated from colouring, so the layout is byte-identical on
  every platform and a plain document is always available.
- `--output` prints its confirmation to stderr and creates missing parent
  directories.
- `chalk` was dropped; colour is emitted directly, which removes a runtime
  dependency.

### Fixed

- `--dirs-only` no longer inverts its filter and now lists directories instead
  of files.
- `--depth` is honoured. It previously had no effect and always printed the
  full tree.
- `--depth` validates its input and reports a usable message instead of
  crashing with a stack trace.
- `--summary` and `--follow-symlinks` are no longer dropped while parsing.
- Broken symlinks are skipped instead of being listed as files.
- A symlinked directory passed as the target no longer fails mid-render.
- Colour is never written into an `--output` file.
- Unreadable nested directories render an inline `[error: ...]` marker rather
  than aborting the run.

## [1.0.0]

- Initial version with `--depth`, `--ignore`, `--full-path`, `--output`, and
  `--list-only`.

[Unreleased]: https://github.com/SayantanD938/tree-cli/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/SayantanD938/tree-cli/releases/tag/v2.0.0
[1.0.0]: https://github.com/SayantanD938/tree-cli/releases/tag/v1.0.0
