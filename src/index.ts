/**
 * Script to merge Claude Code settings into the global settings file (~/.claude/settings.json)
 *
 * Processing flow:
 * 1. Read ~/.claude/settings.json as the base configuration
 * 2. Get project paths from ~/.claude.json
 * 3. Read and merge .claude/settings.local.json from each project
 * 4. Write the merged settings back to ~/.claude/settings.json
 *
 * Projects whose trust dialog has not been accepted in Claude Code are skipped.
 * If permissions would be added to global settings, they are listed and confirmed before writing.
 *
 * Options:
 * --show-allow-commands: Display allowed commands to stdout (for debugging)
 * --yes: Write without confirmation
 */

import { readFileSync, existsSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import {
  escapeControlCharacters,
  isTrustedProject,
  listAddedPermissions,
  mergeSettings,
} from "./lib.js";
import { version } from "./version.js";
import type { Interface } from "node:readline";
import type { MergeSettingsResult, Settings } from "./lib.js";

/**
 * List permissions to be added to global settings and ask the user for confirmation
 *
 * @param addedPermissions - Permissions to be added to global settings
 * @param yes - Write without confirmation
 * @returns true if global settings may be written
 */
async function confirmAddedPermissions(
  addedPermissions: string[],
  yes: boolean,
): Promise<boolean> {
  if (addedPermissions.length === 0) {
    return true;
  }

  console.log("The following permissions will be added to global settings:");

  for (const addedPermission of addedPermissions) {
    console.log(addedPermission);
  }

  if (yes) {
    return true;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      "Confirmation is required to add permissions to global settings. " +
        "Run in a terminal, or pass --yes to write without confirmation.",
    );
  }

  const readline: Interface = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer: string = await new Promise((resolve) =>
      readline.question(
        "Add these permissions to global settings? [y/N] ",
        resolve,
      ),
    );
    return /^y(es)?$/i.test(answer.trim());
  } finally {
    readline.close();
  }
}

/**
 * Main process
 *
 * @param showAllowCommands - Output allowed commands
 * @param yes - Write without confirmation
 */
async function main(showAllowCommands: boolean, yes: boolean) {
  // Home directory path
  const homeDirPath: string = homedir();

  const claudeJSONPath: string = join(homeDirPath, ".claude.json");
  let claudeJSON: { projects?: Record<string, unknown> };

  // ~/.claude.json
  try {
    claudeJSON = JSON.parse(readFileSync(claudeJSONPath, "utf-8"));
  } catch (error) {
    const message: string =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read or parse Claude configuration file "${claudeJSONPath}". ` +
        `Please ensure the file exists and contains valid JSON: ${message}`,
    );
  }

  // Global settings file path
  const settingsPath: string = join(homeDirPath, ".claude", "settings.json");

  let settings: Settings;

  // Global settings (base for merging)
  try {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  } catch (error) {
    const message: string =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to read or parse global settings file "${settingsPath}". ` +
        `Please ensure the file exists and contains valid JSON: ${message}`,
    );
  }

  const localSettingsRecord: Record<string, Settings> = {};

  // Process each project's local settings
  for (const [projectPath, project] of Object.entries(
    claudeJSON.projects ?? {},
  )) {
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

    // Skip projects that Claude Code itself does not trust
    if (!isTrustedProject(project)) {
      console.warn(
        `Skipping "${escapeControlCharacters(localSettingsPath)}" ` +
          "because the trust dialog has not been accepted for this project in Claude Code.",
      );
      continue;
    }

    // Read local settings
    try {
      localSettingsRecord[localSettingsPath] = JSON.parse(
        readFileSync(localSettingsPath, "utf-8"),
      );
    } catch (error) {
      const message: string =
        error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to parse JSON in local settings file "${localSettingsPath}": ${message}`,
      );
    }
  }

  const mergeResult: MergeSettingsResult = mergeSettings({
    settings,
    localSettingsRecord,
    showAllowCommands,
  });

  // Output allowed commands if collected
  for (const allowCommand of mergeResult.mergedAllowCommands) {
    console.log(allowCommand);
  }

  // Permissions added here apply to every project, so confirm them before writing
  const addedPermissions: string[] = listAddedPermissions(
    settings,
    localSettingsRecord,
  );

  if (!(await confirmAddedPermissions(addedPermissions, yes))) {
    console.log("Aborted. Global settings were not changed.");
    return;
  }

  const backupSettingsPath: string = `${settingsPath}.bak`;

  // Backup current settings file before writing
  try {
    copyFileSync(settingsPath, backupSettingsPath);
  } catch (error) {
    const message: string =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to create backup of settings file at "${backupSettingsPath}". ` +
        `Please check file permissions, available disk space, and that the directory exists: ${message}`,
    );
  }

  // Write merged settings back to global settings file
  try {
    writeFileSync(settingsPath, JSON.stringify(mergeResult.settings, null, 2));
  } catch (error) {
    const message: string =
      error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to write merged settings to "${settingsPath}". ` +
        `Please check file permissions, available disk space, and that the directory exists: ${message}`,
    );
  }
}

// Parse command line arguments
const argv = yargs(hideBin(process.argv))
  .version(version)
  .help()
  .option("show-allow-commands", {
    type: "boolean",
    description: "Display allowed commands to stdout (for debugging)",
    default: false,
  })
  .option("yes", {
    alias: "y",
    type: "boolean",
    description:
      "Write without confirmation, even if permissions are added to global settings",
    default: false,
  })
  .parseSync();

try {
  await main(argv.showAllowCommands, argv.yes);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
