import { join } from "node:path";
/**
 * Get the .claude directory path in a home or project directory
 *
 * @param dirPath - Home or project directory path
 * @returns .claude directory path
 */
export function getClaudeDirPath(dirPath) {
    return join(dirPath, ".claude");
}
/**
 * Get the global settings file path
 *
 * @param homeDirPath - Home directory path
 * @returns Global settings file path
 */
export function getGlobalSettingsPath(homeDirPath) {
    return join(getClaudeDirPath(homeDirPath), "settings.json");
}
/**
 * Get the local settings file path of a project
 *
 * @param projectPath - Project path
 * @returns Local settings file path
 */
export function getLocalSettingsPath(projectPath) {
    return join(getClaudeDirPath(projectPath), "settings.local.json");
}
/**
 * Type guard to validate if a value is a string array
 * @param value - Value to check
 * @returns true if value is an array of strings
 */
export function isStringArray(value) {
    return (value !== undefined &&
        Array.isArray(value) &&
        value.every((i) => typeof i === "string"));
}
/**
 * Merge global settings with multiple project-specific local settings
 *
 * For each local settings:
 * - The permissions field combines arrays and removes duplicates
 * - Other fields are ignored and global settings values are kept,
 *   because promoting a project's hooks, env, etc. to global settings
 *   would apply them to every project
 *
 * @param settings - Base global settings
 * @param localSettingsRecord - Map of local settings file paths to their settings objects
 * @param showAllowCommands - If true, collect allowed commands for debugging output
 * @returns Merged settings and list of allowed commands (if showAllowCommands is true)
 */
export function mergeSettings({ settings, localSettingsRecord, showAllowCommands, }) {
    const mergedAllowCommands = [];
    // Process each project's local settings
    for (const [localSettingsPath, localSettings] of Object.entries(localSettingsRecord)) {
        // Collect allowed commands for debugging output
        if (showAllowCommands && localSettings.permissions) {
            const allowCommands = localSettings.permissions.allow;
            if (isStringArray(allowCommands)) {
                mergedAllowCommands.push(...allowCommands.map((c) => `${localSettingsPath}\t${c}`));
            }
        }
        const beforeSettings = settings;
        // Keep global settings as-is; only permissions are merged below
        settings = { ...beforeSettings };
        // Extract permissions from both settings (empty object if not present)
        const permissionsList = [beforeSettings, localSettings].map(({ permissions }) => permissions ?? {});
        const permissionKeys = new Set(permissionsList.flatMap(Object.keys));
        if (permissionKeys.size === 0) {
            continue;
        }
        // Copy before writing so the global settings object is not mutated
        const permissions = { ...beforeSettings.permissions };
        settings.permissions = permissions;
        // Process each permissions key (e.g., "allow", "deny")
        for (const key of permissionKeys) {
            // Keep non-array global values (e.g., "defaultMode") as-is,
            // so that security settings such as "disableBypassPermissionsMode" are not lost
            const beforeValue = beforeSettings.permissions?.[key];
            if (beforeValue !== undefined && !isStringArray(beforeValue)) {
                continue;
            }
            const commandsList = permissionsList
                .map((p) => p[key])
                .filter(isStringArray);
            // Ignore non-array local values instead of promoting them to global settings
            if (commandsList.length === 0) {
                continue;
            }
            // Merge permission commands from both settings, remove duplicates, and sort
            permissions[key] = Array.from(new Set(commandsList.flat())).sort();
        }
    }
    return {
        settings,
        mergedAllowCommands,
    };
}
/**
 * Check if the trust dialog has been accepted for a project in ~/.claude.json
 *
 * Claude Code applies a project's local settings only after it is trusted,
 * so settings from untrusted projects must not be merged into global settings
 *
 * @param project - Project entry in ~/.claude.json
 * @returns true if the trust dialog has been accepted
 */
export function isTrustedProject(project) {
    return (typeof project === "object" &&
        project !== null &&
        "hasTrustDialogAccepted" in project &&
        project.hasTrustDialogAccepted === true);
}
/**
 * Escape control characters so that untrusted text cannot rewrite terminal output
 *
 * @param text - Text to escape
 * @returns Text with control and bidirectional formatting characters escaped
 */
export function escapeControlCharacters(text) {
    return text.replace(/[\p{Cc}\p{Bidi_Control}]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
/**
 * List permission entries that local settings would add to global settings
 *
 * "deny" and "ask" are excluded because they only restrict permissions.
 * Non-array values are excluded because they are not merged.
 *
 * @param settings - Base global settings
 * @param localSettingsRecord - Map of local settings file paths to their settings objects
 * @returns Added entries in "<local settings path>\t<permission type>\t<value>" format,
 *          with control characters escaped
 */
export function listAddedPermissions(settings, localSettingsRecord) {
    const addedPermissions = [];
    for (const [localSettingsPath, localSettings] of Object.entries(localSettingsRecord)) {
        for (const [key, values] of Object.entries(localSettings.permissions ?? {})) {
            if (["deny", "ask"].includes(key) || !isStringArray(values)) {
                continue;
            }
            const beforeValues = settings.permissions?.[key];
            if (beforeValues === undefined || isStringArray(beforeValues)) {
                addedPermissions.push(...values
                    .filter((value) => !beforeValues?.includes(value))
                    .map((value) => [localSettingsPath, key, value]
                    .map(escapeControlCharacters)
                    .join("\t")));
            }
        }
    }
    return addedPermissions;
}
