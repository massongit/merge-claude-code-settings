/**
 * Tests for src/lib.ts
 */

import { describe, it, expect } from "@jest/globals";
import { isStringArray, mergeSettings } from "./lib.js";
import type { MergeSettingsResult } from "./lib.js";

describe("isStringArray", () => {
  describe("valid string arrays", () => {
    it("should return true for array of strings", () => {
      expect(isStringArray(["a", "b", "c"])).toBe(true);
    });

    it("should return true for empty array", () => {
      expect(isStringArray([])).toBe(true);
    });

    it("should return true for single element string array", () => {
      expect(isStringArray(["single"])).toBe(true);
    });

    it("should return true for array with empty strings", () => {
      expect(isStringArray(["", "a", ""])).toBe(true);
    });
  });

  describe("non-arrays", () => {
    it("should return false for string", () => {
      expect(isStringArray("not an array")).toBe(false);
    });

    it("should return false for number", () => {
      expect(isStringArray(123)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isStringArray(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isStringArray(undefined)).toBe(false);
    });

    it("should return false for object", () => {
      expect(isStringArray({})).toBe(false);
    });

    it("should return false for object with array-like properties", () => {
      expect(isStringArray({ 0: "a", 1: "b", length: 2 })).toBe(false);
    });

    it("should return false for boolean", () => {
      expect(isStringArray(true)).toBe(false);
    });
  });

  describe("arrays with non-string elements", () => {
    it("should return false for array of numbers", () => {
      expect(isStringArray([1, 2, 3])).toBe(false);
    });

    it("should return false for mixed array with string and number", () => {
      expect(isStringArray(["a", 1, "b"])).toBe(false);
    });

    it("should return false for array with null", () => {
      expect(isStringArray([null])).toBe(false);
    });

    it("should return false for array with undefined", () => {
      expect(isStringArray([undefined])).toBe(false);
    });

    it("should return false for array with object", () => {
      expect(isStringArray([{}])).toBe(false);
    });

    it("should return false for array with boolean", () => {
      expect(isStringArray([true, false])).toBe(false);
    });

    it("should return false for nested arrays", () => {
      expect(isStringArray([["a", "b"]])).toBe(false);
    });

    it("should return false for array starting with strings but containing non-string", () => {
      expect(isStringArray(["a", "b", 123])).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("should return true for array created with Array.from", () => {
      expect(isStringArray(Array.from(["a", "b", "c"]))).toBe(true);
    });

    it("should return true for array created with spread operator", () => {
      const arr: string[] = ["a", "b"];
      expect(isStringArray([...arr])).toBe(true);
    });
  });
});

describe("mergeSettings", () => {
  describe("basic settings merge", () => {
    it("should merge basic settings with overwriting", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: { foo: "bar", baz: 123 },
        localSettingsRecord: {
          "/path/to/settings1": { baz: 456, qux: "quux" },
        },
        showAllowCommands: false,
      });

      expect(result.settings.foo).toBe("bar");
      expect(result.settings.baz).toBe(456);
      expect(result.settings.qux).toBe("quux");
      expect(result.mergedAllowCommands).toEqual([]);
    });

    it("should handle empty local settings record", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: { foo: "bar" },
        localSettingsRecord: {},
        showAllowCommands: false,
      });

      expect(result.settings).toEqual({ foo: "bar" });
      expect(result.mergedAllowCommands).toEqual([]);
    });
  });

  describe("permissions merge", () => {
    it("should merge permissions arrays without duplicates", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1", "cmd2"],
          },
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd2", "cmd3"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual([
        "cmd1",
        "cmd2",
        "cmd3",
      ]);
    });

    it("should sort merged permissions alphabetically", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["zebra", "alpha"],
          },
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["beta", "gamma"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual([
        "alpha",
        "beta",
        "gamma",
        "zebra",
      ]);
    });

    it("should handle multiple permission types", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1"],
            deny: ["cmd2"],
          },
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd3"],
              deny: ["cmd4"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1", "cmd3"]);
      expect(result.settings.permissions?.deny).toEqual(["cmd2", "cmd4"]);
    });

    it("should handle missing permissions in base settings", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: { foo: "bar" },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1", "cmd2"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1", "cmd2"]);
    });

    it("should handle missing permissions in local settings", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1", "cmd2"],
          },
        },
        localSettingsRecord: {
          "/path/to/settings1": { foo: "bar" },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1", "cmd2"]);
    });

    it("should deduplicate permissions from same settings object", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {},
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1", "cmd1", "cmd2", "cmd1"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1", "cmd2"]);
    });
  });

  describe("multiple local settings", () => {
    it("should merge multiple local settings in order", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1"],
          },
          globalSetting: "value1",
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd2"],
            },
            localSetting1: "value2",
          },
          "/path/to/settings2": {
            permissions: {
              allow: ["cmd3"],
            },
            localSetting2: "value3",
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual([
        "cmd1",
        "cmd2",
        "cmd3",
      ]);
      expect(result.settings.globalSetting).toBe("value1");
      expect(result.settings.localSetting1).toBe("value2");
      expect(result.settings.localSetting2).toBe("value3");
    });

    it("should overwrite settings from later local settings", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          overridable: "base",
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            overridable: "local1",
          },
          "/path/to/settings2": {
            overridable: "local2",
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.overridable).toBe("local2");
    });
  });

  describe("showAllowCommands option", () => {
    it("should collect allowed commands when showAllowCommands is true", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {},
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1", "cmd2"],
            },
          },
          "/path/to/settings2": {
            permissions: {
              allow: ["cmd3"],
            },
          },
        },
        showAllowCommands: true,
      });

      expect(result.mergedAllowCommands).toEqual([
        "/path/to/settings1\tcmd1",
        "/path/to/settings1\tcmd2",
        "/path/to/settings2\tcmd3",
      ]);
    });

    it("should not collect commands when showAllowCommands is false", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {},
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1", "cmd2"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.mergedAllowCommands).toEqual([]);
    });

    it("should only collect allow permissions, not other types", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {},
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1"],
              deny: ["cmd2"],
            },
          },
        },
        showAllowCommands: true,
      });

      expect(result.mergedAllowCommands).toEqual(["/path/to/settings1\tcmd1"]);
    });

    it("should handle local settings without permissions", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {},
        localSettingsRecord: {
          "/path/to/settings1": {
            foo: "bar",
          },
        },
        showAllowCommands: true,
      });

      expect(result.mergedAllowCommands).toEqual([]);
    });
  });

  describe("complex scenarios", () => {
    it("should handle complex merge with all features", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1", "cmd2"],
            deny: ["cmd3"],
          },
          globalSetting: "value1",
          overridable: "base",
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd2", "cmd4"],
              warn: ["cmd5"],
            },
            localSetting: "value2",
            overridable: "local",
          },
        },
        showAllowCommands: true,
      });

      expect(result.settings.permissions?.allow).toEqual([
        "cmd1",
        "cmd2",
        "cmd4",
      ]);
      expect(result.settings.permissions?.deny).toEqual(["cmd3"]);
      expect(result.settings.permissions?.warn).toEqual(["cmd5"]);
      expect(result.settings.globalSetting).toBe("value1");
      expect(result.settings.localSetting).toBe("value2");
      expect(result.settings.overridable).toBe("local");
      expect(result.mergedAllowCommands).toEqual([
        "/path/to/settings1\tcmd2",
        "/path/to/settings1\tcmd4",
      ]);
    });

    it("should preserve other fields when merging permissions", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: ["cmd1"],
          },
          otherField: "value1",
          nested: { deep: "object" },
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd2"],
            },
            anotherField: "value2",
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1", "cmd2"]);
      expect(result.settings.otherField).toBe("value1");
      expect(result.settings.nested).toEqual({ deep: "object" });
      expect(result.settings.anotherField).toBe("value2");
    });
  });

  describe("edge cases", () => {
    it("should handle empty permissions arrays", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          permissions: {
            allow: [],
          },
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            permissions: {
              allow: ["cmd1"],
            },
          },
        },
        showAllowCommands: false,
      });

      expect(result.settings.permissions?.allow).toEqual(["cmd1"]);
    });

    it("should maintain insertion order for non-permission fields", () => {
      const result: MergeSettingsResult = mergeSettings({
        settings: {
          field1: "value1",
          field2: "value2",
        },
        localSettingsRecord: {
          "/path/to/settings1": {
            field3: "value3",
          },
        },
        showAllowCommands: false,
      });

      const keys: string[] = Object.keys(result.settings);
      expect(keys).toContain("field1");
      expect(keys).toContain("field2");
      expect(keys).toContain("field3");
    });
  });
});
