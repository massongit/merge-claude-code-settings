# merge-claude-code-settings

English | [日本語](./README.ja.md)

A TypeScript utility that merges Claude Code settings from multiple project-specific configuration files into the global settings file.

## Background

Claude Code allows certain commands to run without user confirmation. These permissions are stored in project-local `.claude/settings.local.json` files.

**Problem:** You need to grant permissions individually for each project, which is inefficient when you want to allow the same commands across multiple projects.

**Solution:** This tool consolidates settings from all project-local files into the global `~/.claude/settings.json` file, enabling common permissions across all projects.

## Features

- Automatically detects `.claude/settings.local.json` from multiple projects
- Merges into global settings (`~/.claude/settings.json`)
- Combines and deduplicates arrays in the `permissions` field
- Debug output for allowed commands

## Usage

### 1. Build

```bash
bun run build
```

### 2. Run

Development mode (run TypeScript directly):

```bash
bun run dev
```

Production mode (run compiled JavaScript):

```bash
node dist/index.js
```

When executed:

1. Reads the list of registered projects from `~/.claude.json`
2. Loads `.claude/settings.local.json` from each project
3. Merges settings and writes to `~/.claude/settings.json`

### Debug Mode

Use the `--show-allow-commands` option to print allowed commands to stdout:

```bash
node dist/index.js --show-allow-commands
```

Example output:

```text
/path/to/project/.claude/settings.local.json    Bash(git status)
/path/to/project/.claude/settings.local.json    Bash(npm run build)
```

## Merge Logic

### Regular Fields

Overwritten by settings loaded later (last project wins).

### `permissions` Field

Special handling:

- Combines arrays from all projects
- Removes duplicates
- Sorts alphabetically

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

### Setup

Install `pre-commit` by following the instructions at <https://pre-commit.com/>.
This will automatically check for credentials in your commits.

## Code Formatting

```bash
bun run fix
```

Formats code with Prettier.
