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
import { mergeSettings } from "./lib";
/**
 * Main process
 *
 * @param showAllowCommands - Output allowed commands
 */
function main(showAllowCommands) {
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
    const localSettingsRecord = {};
    // Process each project's local settings
    for (const projectPath of Object.keys(claudeJSON.projects ?? {})) {
        // Project local settings file path
        const localSettingsPath = join(projectPath, ".claude", "settings.local.json");
        // Skip if local settings file doesn't exist
        if (!existsSync(localSettingsPath)) {
            continue;
        }
        // Read local settings
        try {
            localSettingsRecord[localSettingsPath] = JSON.parse(readFileSync(localSettingsPath, "utf-8"));
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse JSON in local settings file "${localSettingsPath}": ${message}`);
        }
    }
    const mergeResult = mergeSettings({
        settings,
        localSettingsRecord,
        showAllowCommands,
    });
    // Output allowed commands if collected
    for (const allowCommand of mergeResult.mergedAllowCommands) {
        console.log(allowCommand);
    }
    // Write merged settings back to global settings file
    try {
        writeFileSync(settingsPath, JSON.stringify(mergeResult.settings, null, 2));
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
    default: false,
})
    .parseSync();
try {
    main(argv.showAllowCommands);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
