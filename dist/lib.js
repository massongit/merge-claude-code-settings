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
            const allowCommands = localSettings.permissions["allow"];
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
            // Merge permission commands from both settings, remove duplicates, and sort
            permissions[key] = Array.from(new Set(permissionsList
                .map((p) => p[key])
                .filter(isStringArray)
                .flat())).sort();
        }
    }
    return {
        settings,
        mergedAllowCommands,
    };
}
