# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

This is a TypeScript utility that merges Claude Code settings from multiple projects.
It consolidates settings into the global settings file.
When Claude Code allows certain commands to run without confirmation, permissions are stored.
They are kept in project-local `.claude/settings.local.json` files.
This tool merges those settings into the global `~/.claude/settings.json` file.
This enables common permissions across all projects.

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

# Run all tests (39 tests covering isStringArray and mergeSettings)
bun test

# Format code with Prettier
bun run fix
```

## Development

### Setup

Install `pre-commit` by following the instructions at <https://pre-commit.com/>.
This will automatically check for credentials in your commits.

### Documentation Sync Requirement

**IMPORTANT**: Keep `README.md` and `README.ja.md` in sync.
When updating one file, always update the other.
This maintains consistency between English and Japanese documentation.

## Architecture

### Processing Flow (`src/index.ts`)

The main script follows this sequence:

1. **Read base configuration**: Loads `~/.claude/settings.json` as the starting point
2. **Discover projects**: Parses `~/.claude.json` to get all registered Claude Code projects
3. **Collect local settings**: For each project path, reads `.claude/settings.local.json` (if it exists)
4. **Merge settings**: Calls `mergeSettings()` from `src/lib.ts` to combine all settings
5. **Backup original**: Copies `~/.claude/settings.json` to `~/.claude/settings.json.bak` using `copyFileSync()`
6. **Write merged result**: Saves the merged settings back to `~/.claude/settings.json`

### Merge Strategy (`src/lib.ts`)

The `mergeSettings()` function implements two different merge behaviors:

**Regular fields**: Last-write-wins (local settings overwrite global)

**`permissions` field**: Special array combining logic:

- Combines arrays from all sources (global + all project-local files)
- Removes duplicates using `Set`
- Sorts alphabetically for consistency
- Processes each permission type independently (e.g., "allow", "deny")

Example:

```text
Global: {"permissions": {"allow": ["cmd1", "cmd2"]}}
Project A: {"permissions": {"allow": ["cmd2", "cmd3"]}}
Project B: {"permissions": {"allow": ["cmd4"]}}
Result: {"permissions": {"allow": ["cmd1", "cmd2", "cmd3", "cmd4"]}}
```

### Backup Mechanism

Before writing merged settings, the script:

1. Uses `copyFileSync()` to copy `~/.claude/settings.json` to `~/.claude/settings.json.bak`
2. Only proceeds with the merge if backup succeeds
3. Preserves the exact original file including formatting

This ensures you can recover the original settings if needed.

### Debug Output

When `--show-allow-commands` is enabled:

- Collects all "allow" permission commands during merge
- Outputs format: `<local-settings-path>\t<command>`
- Useful for auditing which projects contribute which permissions

## Key Type Definitions

- `Permissions`: `{[key: string]: string[] | undefined}` - Maps permission types to command arrays
- `Settings`: Object with optional `permissions` field and arbitrary additional fields
- `MergeSettingsResult`: Contains merged `settings` and `mergedAllowCommands` array
- `isStringArray()`: Type guard that validates `unknown` values are `string[]`
