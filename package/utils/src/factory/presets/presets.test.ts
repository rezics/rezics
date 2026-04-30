import { describe, expect, test } from "bun:test";
import {
  type SeedPreset,
  SeedPresetSchema,
} from "@rezics/server/prisma/factory";
import * as v from "valibot";
import { PRESETS } from "./index";

describe("presets", () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    test(`${name} parses through SeedPresetSchema`, () => {
      const _typeCheck: SeedPreset = preset;
      expect(() => v.parse(SeedPresetSchema, preset)).not.toThrow();
    });
  }
});
