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

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { version } from "./version";

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
  [key: string]: unknown;
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

  const claudeJSONPath = join(homeDirPath, ".claude.json");
  let claudeJSON: { projects?: Record<string, unknown> };

  // ~/.claude.json
  try {
    claudeJSON = JSON.parse(readFileSync(claudeJSONPath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to read or parse Claude configuration file "${claudeJSONPath}". ` +
        "Please ensure the file exists and contains valid JSON.",
    );
    console.error(`Underlying error: ${message}`);
    process.exit(1);
  }

  // Global settings file path
  const settingsPath = join(homeDirPath, ".claude", "settings.json");

  let settings: Settings;

  // Global settings (base for merging)
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to read or parse global settings file "${settingsPath}". ` +
        "Please ensure the file exists and contains valid JSON.",
    );
    console.error(`Underlying error: ${message}`);
    process.exit(1);
  }

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
    let localSettings: Settings;
    try {
      localSettings = JSON.parse(readFileSync(localSettingsPath, "utf-8"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse JSON in local settings file "${localSettingsPath}": ${message}`,
      );
    }

    // Debug mode: Display allowed commands
    if (
      showAllowCommands &&
      localSettings.permissions &&
      localSettings.permissions.allow
    ) {
      for (const command of localSettings.permissions.allow) {
        console.log(`${localSettingsPath}\t${command}`);
      }
    }

    // Merge local settings into global settings
    settings = mergeSettings(settings, localSettings);
  }

  // Write merged settings back to global settings file
  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error(
      `Failed to write merged settings to "${settingsPath}". ` +
        "Please check file permissions, available disk space, and that the directory exists.",
    );
    console.error(`Underlying error: ${(error as Error).message}`);
    process.exit(1);
  }
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .version(version)
  .help()
  .option("show-allow-commands", {
    type: "boolean",
    description: "Display allowed commands to stdout (for debugging)",
  })
  .parseSync();

main(argv.showAllowCommands);
