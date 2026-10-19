/**
 * Tests for src/index.ts
 *
 * Runs the CLI with a temporary home directory
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  Mode,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SpawnSyncReturns } from "node:child_process";
import {
  getClaudeDirPath,
  getGlobalSettingsPath,
  getLocalSettingsPath,
} from "./lib.js";
import type { Settings } from "./lib.js";

const globalSettings: Settings = {
  permissions: {
    allow: ["Bash(ls)"],
  },
};

// Settings that an attacker would ship in a cloned repository
const evilSettings: Settings = {
  permissions: {
    allow: ["Bash(evil-command)"],
  },
};

const tempDirPaths: string[] = [];

afterEach(() => {
  for (const tempDirPath of tempDirPaths.splice(0)) {
    rmSync(tempDirPath, { recursive: true, force: true });
  }
});

/**
 * Write a value as JSON, creating parent directories as needed
 *
 * @param filePath - File path to write
 * @param value - Value to write
 */
function writeJSON(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(value));
}

/**
 * Create a temporary home directory with projects
 *
 * @param projects - Map of project names to their trust state and local settings
 * @returns Home directory path and project paths
 */
function setup(
  projects: Record<string, { trusted: boolean; settings: Settings }>,
): { homeDirPath: string; projectPaths: Record<string, string> } {
  const rootDirPath: string = mkdtempSync(
    join(tmpdir(), "merge-claude-code-settings-"),
  );
  tempDirPaths.push(rootDirPath);

  const projectPaths: Record<string, string> = {};
  const claudeJSONProjects: Record<string, unknown> = {};

  for (const [name, project] of Object.entries(projects)) {
    const projectPath: string = join(rootDirPath, "projects", name);
    writeJSON(getLocalSettingsPath(projectPath), project.settings);
    projectPaths[name] = projectPath;
    claudeJSONProjects[projectPath] = {
      hasTrustDialogAccepted: project.trusted,
    };
  }

  const homeDirPath: string = join(rootDirPath, "home");
  writeJSON(join(homeDirPath, ".claude.json"), {
    projects: claudeJSONProjects,
  });
  writeJSON(getGlobalSettingsPath(homeDirPath), globalSettings);

  return { homeDirPath, projectPaths };
}

/**
 * Create a temporary home directory with a trusted project that adds an allow rule
 *
 * @returns Home directory path and project paths
 */
function setupTrustedProject(): {
  homeDirPath: string;
  projectPaths: Record<string, string>;
} {
  return setup({
    trusted: {
      trusted: true,
      settings: { permissions: { allow: ["Bash(git status)"] } },
    },
  });
}

/**
 * Run the CLI without a TTY on stdin
 *
 * @param homeDirPath - Home directory path
 * @param args - Command line arguments
 * @returns Result of the process
 */
function run(homeDirPath: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(
    process.execPath,
    [fileURLToPath(new URL("index.ts", import.meta.url)), ...args],
    {
      env: { ...process.env, HOME: homeDirPath },
      encoding: "utf-8",
      input: "",
    },
  );
}

/**
 * Read global settings
 *
 * @param homeDirPath - Home directory path
 * @returns Global settings
 */
function readGlobalSettings(homeDirPath: string): Settings {
  return JSON.parse(readFileSync(getGlobalSettingsPath(homeDirPath), "utf-8"));
}

/**
 * Create a trusted project whose file or directory is replaced with
 * a symbolic link to outside the project
 *
 * @param getLinkPath - Function to get the path in the project to replace, such as getClaudeDirPath
 * @param writeTarget - Function to create the link target at the given path
 * @returns Home directory path and symbolic link path
 */
function setupSymbolicLink(
  getLinkPath: (projectPath: string) => string,
  writeTarget: (targetPath: string) => void,
): { homeDirPath: string; linkPath: string } {
  const { homeDirPath, projectPaths } = setup({
    evil: { trusted: true, settings: {} },
  });
  const targetPath: string = join(dirname(homeDirPath), "target");
  writeTarget(targetPath);

  const linkPath: string = getLinkPath(projectPaths.evil);
  rmSync(linkPath, { recursive: true });
  symlinkSync(targetPath, linkPath);

  return { homeDirPath, linkPath };
}

/**
 * Run the CLI with --yes and check that the given path was skipped
 *
 * @param homeDirPath - Home directory path
 * @param skippedPath - Path expected in the warning
 * @returns Result of the process
 */
function expectSkipped(
  homeDirPath: string,
  skippedPath: string,
): SpawnSyncReturns<string> {
  const result: SpawnSyncReturns<string> = run(homeDirPath, ["--yes"]);

  expect(result.status).toBe(0);
  expect(readGlobalSettings(homeDirPath)).toEqual(globalSettings);
  expect(result.stderr).toContain(skippedPath);

  return result;
}

/**
 * List backup files of global settings
 *
 * @param homeDirPath - Home directory path
 * @returns Backup file paths
 */
function listBackupPaths(homeDirPath: string): string[] {
  const globalClaudeDirPath: string = getClaudeDirPath(homeDirPath);

  return readdirSync(globalClaudeDirPath)
    .filter((fileName: string): boolean => fileName.endsWith(".bak"))
    .map((fileName: string): string => join(globalClaudeDirPath, fileName));
}

describe("index", () => {
  describe("security", () => {
    it("should not merge settings from projects whose trust dialog has not been accepted", () => {
      const { homeDirPath, projectPaths } = setup({
        evil: { trusted: false, settings: evilSettings },
      });

      expectSkipped(homeDirPath, projectPaths.evil);
    });

    it("should not write new allow rules without confirmation", () => {
      const { homeDirPath } = setupTrustedProject();

      const result: SpawnSyncReturns<string> = run(homeDirPath, []);

      expect(result.status).not.toBe(0);
      expect(readGlobalSettings(homeDirPath)).toEqual(globalSettings);
      expect(result.stdout).toContain("Bash(git status)");
    });

    it("should not merge settings.local.json that is a symbolic link", () => {
      const { homeDirPath, linkPath } = setupSymbolicLink(
        getLocalSettingsPath,
        (targetPath: string) => writeJSON(targetPath, evilSettings),
      );

      expectSkipped(homeDirPath, linkPath);
    });

    it("should not merge settings.local.json in a symbolically linked .claude directory", () => {
      const { homeDirPath, linkPath } = setupSymbolicLink(
        getClaudeDirPath,
        (targetPath: string) =>
          writeJSON(join(targetPath, "settings.local.json"), evilSettings),
      );

      expectSkipped(homeDirPath, linkPath);
    });

    it("should not show the content of a symbolic link target that is not JSON", () => {
      const { homeDirPath, linkPath } = setupSymbolicLink(
        getLocalSettingsPath,
        (targetPath: string) => writeFileSync(targetPath, "secret-token"),
      );

      const result: SpawnSyncReturns<string> = expectSkipped(
        homeDirPath,
        linkPath,
      );

      expect(result.stdout + result.stderr).not.toContain("secret");
    });
  });

  describe("confirmation", () => {
    it("should merge new allow rules from trusted projects with --yes", () => {
      const { homeDirPath } = setupTrustedProject();

      expect(run(homeDirPath, ["--yes"]).status).toBe(0);
      expect(readGlobalSettings(homeDirPath).permissions?.allow).toEqual([
        "Bash(git status)",
        "Bash(ls)",
      ]);
    });

    it("should write without confirmation when no rules are added", () => {
      const { homeDirPath } = setup({
        trusted: {
          trusted: true,
          settings: {
            permissions: { allow: ["Bash(ls)"], deny: ["Bash(rm:*)"] },
          },
        },
      });

      expect(run(homeDirPath, []).status).toBe(0);
      expect(readGlobalSettings(homeDirPath).permissions?.deny).toEqual([
        "Bash(rm:*)",
      ]);
    });
  });

  describe("writing", () => {
    it("should keep the backup of the original settings after running twice", () => {
      const { homeDirPath, projectPaths } = setupTrustedProject();

      expect(run(homeDirPath, ["--yes"]).status).toBe(0);
      writeJSON(getLocalSettingsPath(projectPaths.trusted), {
        permissions: { allow: ["Bash(pwd)"] },
      });
      expect(run(homeDirPath, ["--yes"]).status).toBe(0);

      expect(
        listBackupPaths(homeDirPath).map((backupPath: string): Settings =>
          JSON.parse(readFileSync(backupPath, "utf-8")),
        ),
      ).toContainEqual(globalSettings);
      expect(readdirSync(getClaudeDirPath(homeDirPath)).sort()).toEqual([
        ...listBackupPaths(homeDirPath)
          .map((backupPath: string): string => basename(backupPath))
          .sort(),
        "settings.json",
      ]);
    });

    it("should keep the file permissions of global settings and its backup", () => {
      const { homeDirPath } = setupTrustedProject();
      const settingsPath: string = getGlobalSettingsPath(homeDirPath);
      const mode: Mode = 0o600;
      chmodSync(settingsPath, mode);

      expect(run(homeDirPath, ["--yes"]).status).toBe(0);

      for (const filePath of [settingsPath, ...listBackupPaths(homeDirPath)]) {
        expect(statSync(filePath).mode & 0o777).toBe(mode);
      }
    });

    it("should keep a symbolically linked global settings file as a link", () => {
      const { homeDirPath } = setupTrustedProject();
      const settingsPath: string = getGlobalSettingsPath(homeDirPath);
      const targetPath: string = join(dirname(homeDirPath), "settings.json");
      renameSync(settingsPath, targetPath);
      symlinkSync(targetPath, settingsPath);

      expect(run(homeDirPath, ["--yes"]).status).toBe(0);

      expect(lstatSync(settingsPath).isSymbolicLink()).toBe(true);
      expect(readGlobalSettings(homeDirPath).permissions?.allow).toEqual([
        "Bash(git status)",
        "Bash(ls)",
      ]);
      expect(readdirSync(dirname(homeDirPath)).sort()).toEqual([
        "home",
        "projects",
        "settings.json",
      ]);
    });
  });
});
