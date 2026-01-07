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
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { version } from "./version.js";
/**
 * Type guard to validate if a value is a string array
 * @param value - Value to check
 * @returns true if value is an array of strings
 */
function isStringArray(value) {
    return (value !== undefined &&
        Array.isArray(value) &&
        value.every((i) => typeof i === "string"));
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
function mergeSettings(settings, localSettings) {
    // Basic object merge (overwritten by localSettings)
    const mergedSettings = { ...settings, ...localSettings };
    // Extract permissions from both settings (empty object if not present)
    const permissionsList = [settings, localSettings].map(({ permissions }) => permissions ?? {});
    // Process each permissions key (e.g., "allow", "deny")
    for (const key of new Set(permissionsList.flatMap(Object.keys))) {
        const permissionSet = new Set();
        // Collect permission values from both settings, validating they are string arrays
        for (const permissions of permissionsList) {
            const commands = permissions[key];
            if (!isStringArray(commands)) {
                continue;
            }
            for (const command of commands) {
                permissionSet.add(command);
            }
        }
        if (mergedSettings.permissions === undefined) {
            mergedSettings.permissions = {};
        }
        // Combine and remove duplicates, then sort to ensure consistent ordering
        mergedSettings.permissions[key] = Array.from(permissionSet).sort();
    }
    return mergedSettings;
}
/**
 * Main process
 * Merge global settings with project-specific settings and save
 *
 * @param showAllowCommands - Output allowed commands
 */
function main(showAllowCommands = false) {
    // Home directory path
    const homeDirPath = homedir();
    const claudeJSONPath = join(homeDirPath, ".claude.json");
    let claudeJSON;
    // ~/.claude.json
    try {
        claudeJSON = JSON.parse(readFileSync(claudeJSONPath, "utf-8"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read or parse Claude configuration file "${claudeJSONPath}". ` +
            `Please ensure the file exists and contains valid JSON: ${message}`);
    }
    // Global settings file path
    const settingsPath = join(homeDirPath, ".claude", "settings.json");
    let settings;
    // Global settings (base for merging)
    try {
        settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read or parse global settings file "${settingsPath}". ` +
            `Please ensure the file exists and contains valid JSON: ${message}`);
    }
    // Process each project's local settings
    for (const projectPath of Object.keys(claudeJSON.projects ?? {})) {
        // Project local settings file path
        const localSettingsPath = join(projectPath, ".claude", "settings.local.json");
        // Skip if local settings file doesn't exist
        if (!existsSync(localSettingsPath)) {
            continue;
        }
        let localSettings;
        // Read local settings
        try {
            localSettings = JSON.parse(readFileSync(localSettingsPath, "utf-8"));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse JSON in local settings file "${localSettingsPath}": ${message}`);
        }
        // Debug mode: Display allowed commands
        if (showAllowCommands && localSettings.permissions) {
            const allowCommands = localSettings.permissions["allow"];
            if (isStringArray(allowCommands)) {
                for (const command of allowCommands) {
                    console.log(`${localSettingsPath}\t${command}`);
                }
            }
        }
        // Merge local settings into global settings
        settings = mergeSettings(settings, localSettings);
    }
    // Write merged settings back to global settings file
    try {
        writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to write merged settings to "${settingsPath}". ` +
            `Please check file permissions, available disk space, and that the directory exists: ${message}`);
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
try {
    main(argv.showAllowCommands);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
