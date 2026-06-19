import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  realmDTOSchema,
  realmListBodySchema,
  realmListQuerySchema,
  realmReadQuerySchema,
  resolveRealmRuleQuerySchema,
} from "./realm";
import { realmExtraSchema } from "./realm-extra";

describe("RealmDTO", () => {
  test("accepts dock, rule policy, and viewer capability metadata", () => {
    expect(
      Value.Check(realmDTOSchema, {
        unitId: "realm-1",
        slug: "fate",
        isPublic: true,
        isOfficial: false,
        memberCount: 12,
        dock: {
          schema: "rezics/dock",
          version: 1,
          placements: {
            main: [
              {
                kind: "unitDescription",
                nodeId: "01972fd3-05e7-76cc-8ed9-41aa7d24a983",
              },
              {
                kind: "unitSubscriptionStat",
                nodeId: "01972fd3-1d2f-77f9-a453-d872c6848ebf",
              },
              {
                kind: "realmInfo",
                nodeId: "01972fd3-2d2f-77f9-a453-d872c6848ebf",
              },
              {
                kind: "links",
                nodeId: "01972fd3-3d2f-77f9-a453-d872c6848ebf",
                items: [],
              },
              {
                kind: "realmRules",
                nodeId: "01972fd3-4d2f-77f9-a453-d872c6848ebf",
              },
              {
                kind: "realmModerators",
                nodeId: "01972fd3-5d2f-77f9-a453-d872c6848ebf",
              },
            ],
          },
        },
        rulePolicyId: "policy-1",
        viewerCapabilities: [
          {
            capability: "queue.realm.decide",
            scope: { kind: "realm", realmUnitId: "realm-1" },
          },
        ],
      }),
    ).toBe(true);
  });

  test("accepts resolved preview fields", () => {
    expect(
      Value.Check(realmDTOSchema, {
        unitId: "realm-1",
        isPublic: true,
        isOfficial: false,
        memberCount: 12,
        resolvedLanguage: "ja",
        title: "レルム",
        description: null,
      }),
    ).toBe(true);
  });
});

describe("RealmExtra", () => {
  test("rejects composed surface keys now owned by Dock and Pinboard", () => {
    expect(
      Value.Check(realmExtraSchema, { featuredZoneUnitId: "zone-1" }),
    ).toBe(false);
    expect(
      Value.Check(realmExtraSchema, {
        wikiSidebar: { kind: "zoneNav", zoneUnitId: "zone-1" },
      }),
    ).toBe(false);
    expect(Value.Check(realmExtraSchema, { rule: "rule-1" })).toBe(false);
    expect(Value.Check(realmExtraSchema, { tagTree: [] })).toBe(false);
    expect(
      Value.Check(realmExtraSchema, { tagView: { defaultMode: "tree" } }),
    ).toBe(false);
    expect(Value.Check(realmExtraSchema, { pinboard: ["post-1"] })).toBe(false);
  });
});

describe("Realm read language schemas", () => {
  test("accept ordered read candidates without a visibility mode", () => {
    expect(
      Value.Check(realmListQuerySchema, {
        languages: "ja,en",
        appLocale: "zh-hant",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(realmListBodySchema, {
        languages: ["ja", "en"],
        appLocale: "zh-hant",
        limit: 20,
      }),
    ).toBe(true);
  });

  test("detail schema accepts app locale and explicit language", () => {
    expect(
      Value.Check(realmReadQuerySchema, {
        explicitLanguage: "ja",
        appLocale: "zh-hant",
        languages: "en,de",
      }),
    ).toBe(true);
  });

  test("rule resolution keeps legacy language and ordered candidates", () => {
    expect(
      Value.Check(resolveRealmRuleQuerySchema, {
        language: "ja",
        appLocale: "zh-hant",
        languages: "ja,en",
      }),
    ).toBe(true);
  });
});
