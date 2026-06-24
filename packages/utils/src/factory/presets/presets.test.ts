import { describe, expect, mock, test } from "bun:test";
import type { SeedPreset } from "@rezics/server/db/seed-factory";
import * as v from "valibot";
import { PRESETS } from "./index";

mock.module("@rezics/backend/auth/seed/seed-auth-user", () => ({
  seedAuthUser: mock(async () => ({
    userId: "auth-user",
    email: "auth@example.test",
    name: "Auth User",
    authUserId: "auth-user",
    slug: "auth-user",
    password: "password",
  })),
  slugify: (value: string) => value.toLowerCase().replace(/\s+/g, "-"),
}));

const { SeedPresetSchema } = await import("@rezics/server/db/seed-factory");

describe("presets", () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    test(`${name} parses through SeedPresetSchema`, () => {
      const _typeCheck: SeedPreset = preset;
      expect(() => v.parse(SeedPresetSchema, preset)).not.toThrow();
    });
  }

  for (const name of ["fast", "realistic"]) {
    test(`${name} keeps required dependency pools non-empty`, () => {
      const preset = PRESETS[name]!;
      expect(preset.mode).toBe("realistic");
      expect(preset.plan.users.min).toBeGreaterThanOrEqual(1);
      expect(preset.plan.tags.min).toBeGreaterThanOrEqual(1);
      expect(preset.plan.personEntities.min).toBeGreaterThanOrEqual(1);
      expect(preset.plan.organizationEntities.min).toBeGreaterThanOrEqual(1);
    });
  }
});
