# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a TypeScript utility that merges Claude Code settings from multiple projects.
It consolidates settings into the global settings file.
When Claude Code allows certain commands to run without confirmation, permissions are stored.
They are kept in project-local `.claude/settings.local.json` files.
This tool merges those settings into the global `~/.claude/settings.json` file.

## Build and Run Commands

```bash
# Build TypeScript to JavaScript
bun run build

# Run directly with Bun (development mode)
bun run dev

# Run the compiled script (merges settings and writes to ~/.claude/settings.json)
node dist/index.js

# Run with debug mode (prints allowed commands to stdout)
node dist/index.js --show-allow-commands

# Format code with Prettier
bun run fix
```

## Development

### Setup

Install `pre-commit` by following the instructions at <https://pre-commit.com/>.
This will automatically check for credentials in your commits.

## Architecture

### Main Script: `index.ts`

The script performs the following operations:

1. Reads the global settings from `~/.claude/settings.json` as the base configuration
2. Parses `~/.claude.json` to get the list of all registered Claude Code projects
3. For each project path found in `~/.claude.json`:
   - Looks for `.claude/settings.local.json` in that project directory
   - If found, merges it into the global settings
4. Writes the merged settings back to `~/.claude/settings.json`

### Settings Merge Logic

The `mergeSettings()` function implements special handling for the `permissions` field:

- **Regular fields**: Overwritten by local settings (last project wins)
- **`permissions` field**: Arrays are combined and deduplicated
  - Example: Global `["cmd1", "cmd2"]` + Local `["cmd2", "cmd3"]` = `["cmd1", "cmd2", "cmd3"]`
  - Final array is sorted alphabetically for consistency

### Debug Mode

When run with `--show-allow-commands` flag, the script prints each allowed command to stdout.
Format: `<path-to-settings.local.json>\t<command>`

## Type Definitions

- `Permissions`: Maps permission types (e.g., "allow") to arrays of command strings
- `Settings`: Claude Code settings object with optional `permissions` field and other arbitrary fields
