/**
 * Type definition for permissions
 * Key is the permission type (e.g., "allow"), value is usually an array of commands,
 * but some keys (e.g., "defaultMode") hold other values
 */
interface Permissions {
  [key: string]: unknown;
}

/**
 * Type definition for Claude Code settings object
 */
export interface Settings {
  permissions?: Permissions;
  [key: string]: unknown;
}

/**
 * Result of merging multiple local settings into global settings
 */
export interface MergeSettingsResult {
  settings: Settings;
  mergedAllowCommands: string[];
}

/**
 * Type guard to validate if a value is a string array
 * @param value - Value to check
 * @returns true if value is an array of strings
 */
export function isStringArray(value: unknown): value is string[] {
  return (
    value !== undefined &&
    Array.isArray(value) &&
    value.every((i) => typeof i === "string")
  );
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
export function mergeSettings({
  settings,
  localSettingsRecord,
  showAllowCommands,
}: {
  settings: Settings;
  localSettingsRecord: Record<string, Settings>;
  showAllowCommands: boolean;
}): MergeSettingsResult {
  const mergedAllowCommands: string[] = [];

  // Process each project's local settings
  for (const [localSettingsPath, localSettings] of Object.entries(
    localSettingsRecord,
  )) {
    // Collect allowed commands for debugging output
    if (showAllowCommands && localSettings.permissions) {
      const allowCommands: unknown = localSettings.permissions["allow"];
      if (isStringArray(allowCommands)) {
        mergedAllowCommands.push(
          ...allowCommands.map((c) => `${localSettingsPath}\t${c}`),
        );
      }
    }

    const beforeSettings: Settings = settings;

    // Keep global settings as-is; only permissions are merged below
    settings = { ...beforeSettings };

    // Extract permissions from both settings (empty object if not present)
    const permissionsList: Permissions[] = [beforeSettings, localSettings].map(
      ({ permissions }) => permissions ?? {},
    );

    const permissionKeys: Set<string> = new Set(
      permissionsList.flatMap(Object.keys),
    );

    if (permissionKeys.size === 0) {
      continue;
    }

    // Copy before writing so the global settings object is not mutated
    const permissions: Permissions = { ...beforeSettings.permissions };
    settings.permissions = permissions;

    // Process each permissions key (e.g., "allow", "deny")
    for (const key of permissionKeys) {
      // Keep non-array global values (e.g., "defaultMode") as-is,
      // so that security settings such as "disableBypassPermissionsMode" are not lost
      const beforeValue: unknown = beforeSettings.permissions?.[key];

      if (beforeValue !== undefined && !isStringArray(beforeValue)) {
        continue;
      }

      const commandsList: string[][] = permissionsList
        .map((p: Permissions): unknown => p[key])
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
