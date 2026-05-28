import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  contentStructureDTOSchema,
  contentStructureNodeSchema,
} from "./content-structure";
import { postListQuerySchema } from "./post";

describe("contentStructure schemas", () => {
  test("accept generic ownerUnitId and contentUnitId shape", () => {
    expect(
      Value.Check(contentStructureDTOSchema, {
        ownerUnitId: "owner-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        nodes: [
          {
            id: "node-1",
            title: "Part One",
            contentUnitId: "release-1",
            updatedAt: "2026-05-27T00:00:00.000Z",
          },
        ],
      }),
    ).toBe(true);
  });

  test("does not use targetUnitId as content node identity", () => {
    expect(
      Object.keys(
        (contentStructureNodeSchema as unknown as { properties: object })
          .properties,
      ),
    ).not.toContain("targetUnitId");
  });

  test("part interactions target the part Unit outside content structure", () => {
    expect(
      Value.Check(contentStructureDTOSchema, {
        ownerUnitId: "game-1",
        createdAt: new Date(),
        updatedAt: new Date(),
        nodes: [{ title: "DLC", contentUnitId: "dlc-1" }],
      }),
    ).toBe(true);
    expect(
      Value.Check(postListQuerySchema, {
        targetUnitId: "dlc-1",
        limit: 20,
      }),
    ).toBe(true);
  });
});
