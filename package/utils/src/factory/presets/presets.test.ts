import { describe, expect, mock, test } from "bun:test";
import type { SeedPreset } from "@rezics/server/db/seed-factory";
import * as v from "valibot";
import { PRESETS } from "./index";

mock.module("@rezics/auth/seed/seed-auth-user", () => ({
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
});
