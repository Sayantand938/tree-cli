# Security Policy

## Supported versions

Only the latest published major version receives fixes.

| Version | Supported |
| ------- | --------- |
| 2.x     | Yes       |
| < 2.0   | No        |

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
reporting instead:

<https://github.com/SayantanD938/tree-cli/security/advisories/new>

Include the affected version, your platform and Node version, and the smallest
reproduction you can manage. You can expect an acknowledgement within a few
days, and credit in the release notes unless you would rather stay anonymous.

## Scope

This tool reads directory names and file metadata and writes them to stdout or
to a single file you name with `--output`. The relevant risks are therefore
narrow:

- **Path handling.** Traversal is confined to the directory you pass. Symlinked
  directories are not followed unless `--follow-symlinks` is passed explicitly.
- **Terminal injection.** File and directory names are printed as-is. A name
  containing control characters can affect a terminal that does not sanitise
  its input. Use `--output` when scanning untrusted trees.
- **Output redirection.** `--output` writes to a path you provide and creates
  missing parent directories. It is not a sandbox: pointing it at a sensitive
  path will overwrite that file.

Reports about the npm supply chain, such as a compromised dependency or a
hijacked release, are in scope and treated as urgent.
