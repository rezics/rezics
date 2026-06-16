import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  pinboardAdminReadResponseSchema,
  pinboardDTOSchema,
  pinboardKeySchema,
  pinboardKindSchema,
  pinboardReadResponseSchema,
} from "./pinboard";

describe("Pinboard contract", () => {
  test("locks v1 kind and key", () => {
    expect(Value.Check(pinboardKindSchema, "list")).toBe(true);
    expect(Value.Check(pinboardKindSchema, "grid")).toBe(false);
    expect(Value.Check(pinboardKeySchema, "home")).toBe(true);
    expect(Value.Check(pinboardKeySchema, "notice")).toBe(false);
  });

  test("accepts ordered Unit entry DTOs", () => {
    expect(
      Value.Check(pinboardDTOSchema, {
        id: "pinboard-1",
        realmUnitId: "realm-1",
        key: "home",
        kind: "list",
        entries: [
          { unitId: "post-1", position: "a0" },
          { unitId: "post-2", position: "a1" },
        ],
      }),
    ).toBe(true);
  });

  test("read responses expose ordered ids and admin stale ids", () => {
    expect(
      Value.Check(pinboardReadResponseSchema, {
        realmId: "realm-1",
        key: "home",
        kind: "list",
        unitIds: ["post-1", "post-2"],
      }),
    ).toBe(true);
    expect(
      Value.Check(pinboardAdminReadResponseSchema, {
        realmId: "realm-1",
        key: "home",
        kind: "list",
        unitIds: ["post-1"],
        staleIds: ["deleted-post"],
      }),
    ).toBe(true);
  });
});
