/**
 * Tests for src/index.ts
 *
 * Runs the CLI with a temporary home directory
 */

import { describe, it, expect, afterEach } from "@jest/globals";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { SpawnSyncReturns } from "node:child_process";
import type { Settings } from "./lib.js";

const globalSettings: Settings = {
  permissions: {
    allow: ["Bash(ls)"],
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
    writeJSON(
      join(projectPath, ".claude", "settings.local.json"),
      project.settings,
    );
    projectPaths[name] = projectPath;
    claudeJSONProjects[projectPath] = {
      hasTrustDialogAccepted: project.trusted,
    };
  }

  const homeDirPath: string = join(rootDirPath, "home");
  writeJSON(join(homeDirPath, ".claude.json"), {
    projects: claudeJSONProjects,
  });
  writeJSON(join(homeDirPath, ".claude", "settings.json"), globalSettings);

  return { homeDirPath, projectPaths };
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
    [join(import.meta.dirname, "index.ts"), ...args],
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
  return JSON.parse(
    readFileSync(join(homeDirPath, ".claude", "settings.json"), "utf-8"),
  );
}

describe("index", () => {
  describe("security", () => {
    it("should not merge settings from projects whose trust dialog has not been accepted", () => {
      const { homeDirPath, projectPaths } = setup({
        evil: {
          trusted: false,
          settings: { permissions: { allow: ["Bash(evil-command)"] } },
        },
      });

      const result: SpawnSyncReturns<string> = run(homeDirPath, ["--yes"]);

      expect(result.status).toBe(0);
      expect(readGlobalSettings(homeDirPath)).toEqual(globalSettings);
      expect(result.stderr).toContain(projectPaths.evil);
    });

    it("should not write new allow rules without confirmation", () => {
      const { homeDirPath } = setup({
        trusted: {
          trusted: true,
          settings: { permissions: { allow: ["Bash(git status)"] } },
        },
      });

      const result: SpawnSyncReturns<string> = run(homeDirPath, []);

      expect(result.status).not.toBe(0);
      expect(readGlobalSettings(homeDirPath)).toEqual(globalSettings);
      expect(result.stdout).toContain("Bash(git status)");
    });
  });

  describe("confirmation", () => {
    it("should merge new allow rules from trusted projects with --yes", () => {
      const { homeDirPath } = setup({
        trusted: {
          trusted: true,
          settings: { permissions: { allow: ["Bash(git status)"] } },
        },
      });

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
});
