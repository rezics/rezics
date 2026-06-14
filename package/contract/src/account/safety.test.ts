import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { userDataExportSchema } from "./safety";

describe("userDataExportSchema", () => {
  test("includes user shelf item metadata owned by the account", () => {
    expect(
      Value.Check(userDataExportSchema, {
        exportedAt: "2026-05-31T00:00:00.000Z",
        profile: { unitId: "user-1", handle: "alice" },
        settings: {},
        posts: [],
        shelves: [],
        userShelfItems: [
          {
            unitId: "book-1",
            searchText: "private alias",
            createdAt: "2026-05-30T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
        ],
        userTagApplications: [
          {
            unitId: "book-1",
            tagUnitId: "tag-1",
            position: "00000000",
            createdAt: "2026-05-30T00:00:00.000Z",
            updatedAt: "2026-05-31T00:00:00.000Z",
          },
        ],
        follows: [],
        blocks: [],
      }),
    ).toBe(true);
  });
});
