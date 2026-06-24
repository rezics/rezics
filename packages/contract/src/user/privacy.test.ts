import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { USER_TAG_PRIVACY_FIELD_KEY, userSettingsSchema } from "./user";

describe("user tag privacy settings", () => {
  test("uses a stable field key for direct user tag surfaces", () => {
    expect(USER_TAG_PRIVACY_FIELD_KEY).toBe("userTags");
    expect(
      Value.Check(userSettingsSchema, {
        privacy: { userTags: "public" },
      }),
    ).toBe(true);
  });

  test("rejects unknown direct user tag visibility values", () => {
    expect(
      Value.Check(userSettingsSchema, {
        privacy: { userTags: "shelf-public" },
      }),
    ).toBe(false);
  });
});
