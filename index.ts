#!/usr/bin/env node

/**
 * Script to merge Claude Code settings into the global settings file (~/.claude/settings.json)
 *
 * Processing flow:
 * 1. Read ~/.claude/settings.json as the base configuration
 * 2. Get project paths from ~/.claude.json
 * 3. Read and merge .claude/settings.local.json from each project
 * 4. Write the merged settings back to ~/.claude/settings.json
 *
 * Options:
 * --show-allow-commands: Display allowed commands to stdout (for debugging)
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

/**
 * Type definition for permissions
 * Key is the permission type (e.g., "allow"), value is an array of allowed commands
 */
interface Permissions {
	[key: string]: string[] | undefined;
}

/**
 * Type definition for Claude Code settings object
 */
interface Settings {
	permissions?: Permissions;
	[key: string]: any;
}

/**
 * Merge two settings objects
 *
 * The permissions field combines arrays and removes duplicates
 * Other fields are overwritten by localSettings values
 *
 * @param settings - Base settings
 * @param localSettings - Local settings to merge
 * @returns Merged settings
 */
function mergeSettings(settings: Settings, localSettings: Settings): Settings {
	// Basic object merge (overwritten by localSettings)
	const mergedSettings: Settings = { ...settings, ...localSettings };

	// Extract permissions from both settings (empty object if not present)
	const permissionsList: Permissions[] = [settings, localSettings].map(
		({ permissions }) => permissions ?? {},
	);

	// Process each permissions key (e.g., "allow", "deny")
	for (const key of new Set(permissionsList.flatMap(Object.keys))) {
		if (mergedSettings.permissions === undefined) {
			mergedSettings.permissions = {};
		}

		// Get arrays for the key from both settings, combine and remove duplicates
		// Finally sort to ensure consistent ordering
		mergedSettings.permissions[key] = Array.from(
			new Set(permissionsList.flatMap((p) => p[key] ?? [])),
		).sort();
	}

	return mergedSettings;
}

/**
 * Main process
 * Merge global settings with project-specific settings and save
 *
 * @param showAllowCommands - Output allowed commands
 */
function main(showAllowCommands: boolean = false) {
	// Home directory path
	const homeDirPath: string = homedir();

	// ~/.claude.json
	const claudeJSON: { projects?: Record<string, any> } = JSON.parse(
		readFileSync(join(homeDirPath, ".claude.json"), "utf-8"),
	);

	// Global settings file path
	const settingsPath = join(homeDirPath, ".claude", "settings.json");

	// Global settings (base for merging)
	let settings: Settings = JSON.parse(readFileSync(settingsPath, "utf-8"));

	// Process each project's local settings
	for (const projectPath of Object.keys(claudeJSON.projects ?? {})) {
		// Project local settings file path
		const localSettingsPath: string = join(
			projectPath,
			".claude",
			"settings.local.json",
		);

		// Skip if local settings file doesn't exist
		if (!existsSync(localSettingsPath)) {
			continue;
		}

		// Read local settings
		const localSettings: Settings = JSON.parse(
			readFileSync(localSettingsPath, "utf-8"),
		);

		// Debug mode: Display allowed commands
		if (
			showAllowCommands &&
			localSettings.permissions &&
			localSettings.permissions["allow"]
		) {
			for (const command of localSettings.permissions["allow"]) {
				console.log(localSettingsPath + "\t" + command);
			}
		}

		// Merge local settings into global settings
		settings = mergeSettings(settings, localSettings);
	}

	// Write merged settings back to global settings file
	writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
	.version("0.1.0")
	.help()
	.option("show-allow-commands", {
		type: "boolean",
		description: "Display allowed commands to stdout (for debugging)",
	})
	.parseSync();

main(argv.showAllowCommands);
