import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "bun:test";
import {
  meiliApiMessageResponseSchema,
  meiliKeyListResponseSchema,
  meiliKeySchema,
  meiliTaskResponseSchema,
} from "./admin";

describe("Meili admin contracts", () => {
  test("accepts Meili key responses with one-time secrets and Date fields", () => {
    expect(
      Value.Check(meiliKeySchema, {
        uid: "search-admin",
        key: "secret-once",
        actions: ["*"],
        indexes: ["*"],
        expiresAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  test("accepts key list, message, and task response envelopes", () => {
    expect(
      Value.Check(meiliKeyListResponseSchema, {
        results: [{ uid: "search" }],
        limit: 20,
        offset: 0,
        total: 1,
      }),
    ).toBe(true);
    expect(
      Value.Check(meiliApiMessageResponseSchema, { message: "ok" }),
    ).toBe(true);
    expect(Value.Check(meiliTaskResponseSchema, { task: { uid: 1 } })).toBe(
      true,
    );
  });
});
