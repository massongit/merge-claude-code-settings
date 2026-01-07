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
 * - Other fields are overwritten by local settings values
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
      const allowCommands: string[] | undefined =
        localSettings.permissions["allow"];
      if (isStringArray(allowCommands)) {
        mergedAllowCommands.push(
          ...allowCommands.map((c) => `${localSettingsPath}\t${c}`),
        );
      }
    }

    const beforeSettings: Settings = settings;

    // Basic object merge (overwritten by localSettings)
    settings = { ...beforeSettings, ...localSettings };

    // Extract permissions from both settings (empty object if not present)
    const permissionsList: Permissions[] = [beforeSettings, localSettings].map(
      ({ permissions }) => permissions ?? {},
    );

    // Process each permissions key (e.g., "allow", "deny")
    for (const key of new Set(permissionsList.flatMap(Object.keys))) {
      if (settings.permissions === undefined) {
        settings.permissions = {};
      }

      // Merge permission commands from both settings, remove duplicates, and sort
      settings.permissions[key] = Array.from(
        new Set(
          permissionsList
            .map((p) => p[key])
            .filter(isStringArray)
            .flat(),
        ),
      ).sort();
    }
  }

  return {
    settings,
    mergedAllowCommands,
  };
}
