import { describe, expect, test } from "bun:test";
import { Value } from "@sinclair/typebox/value";
import {
  wikiZoneConfigSchema,
  wikiZoneHomepageDataSchema,
  wikiZoneHomepageSchema,
  wikiZoneNavigationSchema,
  wikiZoneThemeSchema,
} from "./zone";

describe("wiki Zone contract schemas", () => {
  test("validates wiki config filters, navigation, homepage, and theme", () => {
    expect(
      Value.Check(wikiZoneConfigSchema, {
        filters: {
          realmUnitId: "realm-1",
          type: "POST",
          postKind: "WIKI",
          tags: [{ scope: "tag", slug: "lore" }],
          subjectFilters: [
            {
              entityKinds: ["character"],
              subjectRoles: ["primary_character"],
            },
          ],
          languages: ["en"],
          translationGroupIds: ["tg-1"],
        },
        navigation: {
          sections: [
            {
              id: "characters",
              labelUnitId: "label-characters",
              items: [
                { kind: "entity", entityId: "entity-1" },
                { kind: "tag", tagUnitId: "tag-lore" },
                {
                  kind: "translationGroup",
                  translationGroupId: "tg-main-page",
                },
                { kind: "labelHeading", labelUnitId: "label-places" },
                {
                  kind: "manualLink",
                  href: "https://example.com",
                  label: { translations: { en: "Official site" } },
                },
              ],
            },
          ],
        },
        homepage: {
          template: "wiki-classic-home",
          sections: [
            {
              id: "featured",
              kind: "translationGroupCollection",
              translationGroupIds: ["tg-main-page"],
            },
            {
              id: "recent",
              kind: "recentWiki",
              limit: 10,
              emptyState: "show-empty",
            },
          ],
        },
        theme: {
          template: "wiki-classic",
          homepageTemplate: "wiki-classic-home",
          palette: { background: "#ffffff", text: "#111111" },
          chrome: { density: "comfortable", navPosition: "side" },
          layout: { contentWidth: "wide", infoboxPosition: "right" },
        },
      }),
    ).toBe(true);
  });

  test("rejects unknown wiki config fields and arbitrary CSS", () => {
    expect(
      Value.Check(wikiZoneConfigSchema, {
        filters: { realmUnitId: "realm-1", postKind: "WIKI" },
        unsupportedFeature: true,
      }),
    ).toBe(false);
    expect(
      Value.Check(wikiZoneThemeSchema, {
        template: "wiki-classic",
        homepageTemplate: "wiki-classic-home",
        css: ".page { display: none; }",
      }),
    ).toBe(false);
  });

  test("rejects raw manual labels and unsupported template slugs", () => {
    expect(
      Value.Check(wikiZoneNavigationSchema, {
        sections: [
          {
            id: "manual",
            items: [
              {
                kind: "external",
                href: "https://example.com",
                label: "Characters",
              },
            ],
          },
        ],
      }),
    ).toBe(false);
    expect(
      Value.Check(wikiZoneHomepageSchema, {
        template: "custom-home",
        sections: [],
      }),
    ).toBe(false);
  });

  test("validates hydrated homepage section data", () => {
    expect(
      Value.Check(wikiZoneHomepageDataSchema, {
        template: "wiki-classic-home",
        sections: [
          {
            section: {
              id: "featured",
              kind: "translationGroupCollection",
              translationGroupIds: ["tg-main-page"],
            },
            items: [
              {
                kind: "wikiPost",
                unitId: "wiki-zh",
                translationGroupId: "tg-main-page",
                language: "zh-hant",
                title: "主頁",
                summary: null,
                createdAt: "2026-05-28T00:00:00.000Z",
                updatedAt: "2026-05-28T00:00:00.000Z",
              },
            ],
          },
          {
            section: {
              id: "manual",
              kind: "manualLinks",
              links: [
                {
                  kind: "manualLink",
                  href: "/wiki",
                  label: { translations: { en: "Wiki" } },
                },
              ],
            },
            items: [
              {
                kind: "navigationItem",
                item: {
                  kind: "manualLink",
                  href: "/wiki",
                  label: { translations: { en: "Wiki" } },
                },
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
