#!/usr/bin/env node
/**
 * Script to merge Claude Code settings into the global settings file (~/.claude/settings.json)
 *
 * Processing flow:
 * 1. Read ~/.claude/settings.json as the base configuration
 * 2. Get project paths from ~/.claude.json
 * 3. Read and merge .claude/settings.local.json from each project
 * 4. Back up ~/.claude/settings.json with a timestamp
 * 5. Write the merged settings back to ~/.claude/settings.json atomically
 *
 * Projects whose trust dialog has not been accepted in Claude Code are skipped.
 * If permissions would be added to global settings, they are listed and confirmed before writing.
 *
 * Options:
 * --show-allow-commands: Display allowed commands to stdout (for debugging)
 * --yes: Write without confirmation
 */
import { readFileSync, existsSync, writeFileSync, copyFileSync, lstatSync, realpathSync, statSync, chmodSync, renameSync, rmSync, constants, } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { escapeControlCharacters, getGlobalSettingsPath, getLocalSettingsPath, isTrustedProject, listAddedPermissions, mergeSettings, parseSettings, } from "./lib.js";
import { version } from "./version.js";
/**
 * List permissions to be added to global settings and ask the user for confirmation
 *
 * @param addedPermissions - Permissions to be added to global settings
 * @param yes - Write without confirmation
 * @returns true if global settings may be written
 */
async function confirmAddedPermissions(addedPermissions, yes) {
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
        throw new Error("Confirmation is required to add permissions to global settings. " +
            "Run in a terminal, or pass --yes to write without confirmation.");
    }
    const readline = createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    try {
        const answer = await new Promise((resolve) => readline.question("Add these permissions to global settings? [y/N] ", resolve));
        return /^y(es)?$/i.test(answer.trim());
    }
    finally {
        readline.close();
    }
}
/**
 * Check if a local settings file is a regular file inside the project
 *
 * A cloned repository can replace the file or its .claude directory with a symbolic link
 * to read other files, such as credentials, so such files are rejected
 *
 * @param projectPath - Project path
 * @param localSettingsPath - Local settings file path
 * @returns true if the file is a regular file and no symbolic link is followed inside the project
 */
function isRegularFileInProject(projectPath, localSettingsPath) {
    return (lstatSync(localSettingsPath).isFile() &&
        realpathSync(localSettingsPath) ===
            getLocalSettingsPath(realpathSync(projectPath)));
}
/**
 * Write a file atomically by writing to a temporary file and renaming it
 *
 * The original file permissions are kept, because settings files can contain secrets.
 * If the file is a symbolic link, its target is written so that the link is kept.
 *
 * @param filePath - File path to write
 * @param content - Content to write
 */
function writeFileAtomically(filePath, content) {
    const targetPath = realpathSync(filePath);
    const tempPath = `${targetPath}.${process.pid}.tmp`;
    const mode = statSync(targetPath).mode & 0o777;
    try {
        writeFileSync(tempPath, content, { flag: "wx", mode });
        chmodSync(tempPath, mode);
        renameSync(tempPath, targetPath);
    }
    catch (error) {
        rmSync(tempPath, { force: true });
        throw error;
    }
}
/**
 * Main process
 *
 * @param showAllowCommands - Output allowed commands
 * @param yes - Write without confirmation
 */
async function main(showAllowCommands, yes) {
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
    const settingsPath = getGlobalSettingsPath(homeDirPath);
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
    for (const [projectPath, project] of Object.entries(claudeJSON.projects ?? {})) {
        // Project local settings file path
        const localSettingsPath = getLocalSettingsPath(projectPath);
        // Skip if local settings file doesn't exist
        if (!existsSync(localSettingsPath)) {
            continue;
        }
        const escapedLocalSettingsPath = escapeControlCharacters(localSettingsPath);
        // Skip projects that Claude Code itself does not trust
        if (!isTrustedProject(project)) {
            console.warn(`Skipping "${escapedLocalSettingsPath}" ` +
                "because the trust dialog has not been accepted for this project in Claude Code.");
            continue;
        }
        // Skip symbolic links and special files so that files outside the project are not read
        if (!isRegularFileInProject(projectPath, localSettingsPath)) {
            console.warn(`Skipping "${escapedLocalSettingsPath}" ` +
                "because it is not a regular file inside the project, such as a symbolic link.");
            continue;
        }
        // Read local settings
        const localSettings = parseSettings(readFileSync(localSettingsPath, "utf-8"));
        // Skip invalid local settings so that one project cannot stop the others.
        // The parser message is not shown because it can contain the file content.
        if (localSettings === undefined) {
            console.warn(`Skipping "${escapedLocalSettingsPath}" because it is not valid settings.`);
            continue;
        }
        localSettingsRecord[localSettingsPath] = localSettings;
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
    // Permissions added here apply to every project, so confirm them before writing
    const addedPermissions = listAddedPermissions(settings, localSettingsRecord);
    if (!(await confirmAddedPermissions(addedPermissions, yes))) {
        console.log("Aborted. Global settings were not changed.");
        return;
    }
    // Keep every backup,
    // so that the original settings are not lost by running again ":" cannot be used in file names on Windows
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupSettingsPath = `${settingsPath}.${timestamp}.bak`;
    // Backup current settings file before writing
    try {
        copyFileSync(settingsPath, backupSettingsPath, constants.COPYFILE_EXCL);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to create backup of settings file at "${backupSettingsPath}". ` +
            `Please check file permissions, available disk space, and that the directory exists: ${message}`);
    }
    // Write merged settings back to global settings file
    try {
        writeFileAtomically(settingsPath, JSON.stringify(mergeResult.settings, null, 2));
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
    .option("yes", {
    alias: "y",
    type: "boolean",
    description: "Write without confirmation, even if permissions are added to global settings",
    default: false,
})
    .parseSync();
try {
    await main(argv.showAllowCommands, argv.yes);
}
catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
