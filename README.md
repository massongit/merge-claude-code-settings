# merge-claude-code-settings

English | [日本語](./README.ja.md)

A TypeScript utility that merges Claude Code settings from multiple projects.
It consolidates them into the global settings file.

## Background

Claude Code allows certain commands to run without user confirmation.
These permissions are stored in project-local `.claude/settings.local.json` files.

**Problem:** You need to grant permissions individually for each project.
This is inefficient when you want to allow the same commands across multiple projects.

**Solution:** This tool consolidates settings from all project-local files.
They are merged into the global `~/.claude/settings.json` file.
This enables common permissions across all projects.

## Features

- Automatically detects `.claude/settings.local.json` from multiple projects
- Skips projects whose trust dialog has not been accepted in Claude Code
- Lists permissions to be added to global settings and asks for confirmation before writing
- Merges into global settings (`~/.claude/settings.json`)
- Creates automatic backup (`~/.claude/settings.json.bak`) before writing
- Combines arrays in the `permissions` field and automatically removes duplicates
- Debug output for allowed commands

## Usage

Run directly with npx (no installation required).

```bash
npx merge-claude-code-settings

# Debug mode (print allowed commands to stdout)
npx merge-claude-code-settings --show-allow-commands

# Write without confirmation (for scripts)
npx merge-claude-code-settings --yes
```

The following operations are performed.

1. Reads the list of registered projects from `~/.claude.json`
2. Loads `.claude/settings.local.json` from each project whose trust dialog has been accepted
3. Merges settings
4. Lists the permissions to be added to global settings and asks for confirmation
5. Creates a backup of the current settings (`~/.claude/settings.json.bak`)
6. Writes the merged settings to `~/.claude/settings.json`

Permissions added to global settings apply to every project.
Check the list carefully, especially for repositories cloned from untrusted sources.
Entries in `deny` and `ask` only restrict permissions, so they are not listed.
Without a terminal, the tool stops unless `--yes` is passed.

Example output with `--show-allow-commands` option.

<!-- markdownlint-disable MD010 -->

```text
/path/to/project/.claude/settings.local.json	Bash(git status)
/path/to/project/.claude/settings.local.json	Bash(npm run build)
```

<!-- markdownlint-enable MD010 -->

## Merge Logic

### Regular Fields

Not merged. Global settings values are kept as-is.
Project settings such as `hooks` and `env` would otherwise apply to every project.

### `permissions` Field

Special handling is applied.

- Combines arrays from all projects
- Removes duplicates
- Sorts alphabetically
- Keeps non-array values (such as `defaultMode`) from global settings as-is
- Ignores non-array values in project settings

**Example:**

- Global settings: `{"permissions": {"allow": ["cmd1", "cmd2"]}}`
- Project A: `{"permissions": {"allow": ["cmd2", "cmd3"]}}`
- Project B: `{"permissions": {"allow": ["cmd4"]}}`
- **Result:** `{"permissions": {"allow": ["cmd1", "cmd2", "cmd3", "cmd4"]}}`

## Tech Stack

- **Language:** TypeScript
- **Runtime:** Bun
- **Main Dependencies:** Node.js standard library (fs, path, os)

## Development

### For Developers

Build and run from source.

```bash
# Build TypeScript to JavaScript
bun run build

# Run directly with Bun (development mode)
bun run dev

# Run compiled JavaScript
node dist/index.js

# Debug mode
node dist/index.js --show-allow-commands
```

### Setup

Install `pre-commit` by following the instructions at <https://pre-commit.com/>.
This will automatically check for credentials in your commits.

### Testing

Run the test suite to verify the functionality of library functions.

```bash
bun test
```

This runs 62 comprehensive tests covering:

- `isStringArray`: Type guard validation (21 tests)
- `mergeSettings`: Settings merge logic (23 tests)
- `isTrustedProject`: Trust dialog state check (5 tests)
- `escapeControlCharacters`: Escaping control characters for terminal output (4 tests)
- `listAddedPermissions`: Listing permissions to be added (5 tests)
- CLI: Skipping untrusted projects and confirmation (4 tests)

## Code Formatting

```bash
bun run fix
```

Generates AI agent instruction files from `.rulesync/rules/` with rulesync.
Then formats code with Prettier.
