import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  realmDTOSchema,
  realmListBodySchema,
  realmListQuerySchema,
  realmReadQuerySchema,
  resolveRealmRuleQuerySchema,
} from "./realm";

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

describe("Realm read language schemas", () => {
  test("accept ordered read candidates and language visibility mode", () => {
    expect(
      Value.Check(realmListQuerySchema, {
        languages: "ja,en",
        appLocale: "zh-hant",
        languageMode: "preferred",
        limit: 20,
      }),
    ).toBe(true);
    expect(
      Value.Check(realmListBodySchema, {
        languages: ["ja", "en"],
        appLocale: "zh-hant",
        languageMode: "all",
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
