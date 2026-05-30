import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import { realmDTOSchema } from "./realm";

describe("RealmDTO", () => {
  test("accepts wiki Zone id and viewer capability metadata", () => {
    expect(
      Value.Check(realmDTOSchema, {
        unitId: "realm-1",
        slug: "fate",
        isPublic: true,
        isOfficial: false,
        memberCount: 12,
        extra: {
          wikiZoneUnitId: "zone-1",
        },
        viewerCapabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      }),
    ).toBe(true);
  });
});
