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
  test("accepts sidebar, rule policy, and viewer capability metadata", () => {
    expect(
      Value.Check(realmDTOSchema, {
        unitId: "realm-1",
        slug: "fate",
        isPublic: true,
        isOfficial: false,
        memberCount: 12,
        sidebar: {
          schema: "rezics/realm-sidebar",
          version: 1,
          placements: {
            home: [{ id: "rules", kind: "rules" }],
          },
        },
        ruleUnitId: "rule-1",
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
  test("rejects composed surface keys now owned by sidebar and Pinboard", () => {
    expect(
      Value.Check(realmExtraSchema, { featuredZoneUnitId: "zone-1" }),
    ).toBe(false);
    expect(
      Value.Check(realmExtraSchema, {
        wikiSidebar: { kind: "zoneNav", zoneUnitId: "zone-1" },
      }),
    ).toBe(false);
    expect(Value.Check(realmExtraSchema, { rule: "rule-1" })).toBe(false);
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
