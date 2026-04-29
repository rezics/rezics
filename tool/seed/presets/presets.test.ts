import { describe, expect, test } from "bun:test";
import * as v from "valibot";
import {
  SeedPresetSchema,
  type SeedPreset,
} from "../../../package/server/prisma/seed/mocks/types";
import { PRESETS } from "./index";

describe("presets", () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    test(`${name} parses through SeedPresetSchema`, () => {
      const _typeCheck: SeedPreset = preset;
      expect(() => v.parse(SeedPresetSchema, preset)).not.toThrow();
    });
  }
});
