import { Value } from "@sinclair/typebox/value";
import { describe, expect, test } from "bun:test";
import {
  parseZoneBoundary,
  zoneBoundaryEnvelopeSchema,
  type ZoneBoundary,
} from "./boundary-v1";
import { parseZoneNav, zoneNavEnvelopeSchema, type ZoneNav } from "./nav-v1";
import {
  parseZonePage,
  zonePageEnvelopeSchema,
  type ZonePage,
} from "./page-v1";
import {
  parseZoneTheme,
  zoneThemeEnvelopeSchema,
  type ZoneTheme,
} from "./theme-v1";

const boundary: ZoneBoundary = {
  schema: "rezics/zone-boundary",
  version: 1,
  context: { kind: "realm", realmUnitId: "realm-1" },
  filters: {
    types: ["BOOK"],
    languages: ["zh-hant"],
  },
};

const nav: ZoneNav = {
  schema: "rezics/zone-nav",
  version: 1,
  menus: [
    {
      id: "main",
      nodes: [
        { id: "home", target: { kind: "zonePage", pageId: "page-home" } },
        { id: "book", target: { kind: "unit", unitId: "book-1" } },
      ],
    },
  ],
  header: {
    menuId: "main",
    logoImageUrl: "https://cdn.example.test/logo.png",
  },
};

const theme: ZoneTheme = {
  schema: "rezics/zone-theme",
  version: 1,
  tokens: {
    accent: "var(--colors-brand-fill)",
  },
  images: {
    logoUrl: "https://cdn.example.test/logo.png",
    bannerUrl: "https://cdn.example.test/banner.png",
    backgroundUrl: "https://cdn.example.test/background.png",
  },
  layout: {
    contentMaxWidth: 1440,
    density: "comfortable",
  },
};

const page: ZonePage = {
  schema: "rezics/zone-page",
  version: 1,
  sections: [
    {
      id: "stage",
      kind: "stage",
      background: { imageUrl: "https://cdn.example.test/hero.png" },
      sections: [
        { id: "zone-info", kind: "zoneInfo" },
        {
          id: "actions",
          kind: "actions",
          items: [
            {
              target: { kind: "zonePage", pageId: "page-characters" },
              displayUnitId: "character-1",
            },
          ],
        },
      ],
    },
    {
      id: "characters",
      kind: "collection",
      display: "avatar-wall",
      items: [
        {
          target: { kind: "unit", unitId: "wiki-1" },
          displayUnitId: "character-1",
        },
      ],
    },
  ],
};

describe("zone split envelopes", () => {
  test("validates boundary, nav, theme, and page envelopes independently", () => {
    expect(Value.Check(zoneBoundaryEnvelopeSchema, boundary)).toBe(true);
    expect(Value.Check(zoneNavEnvelopeSchema, nav)).toBe(true);
    expect(Value.Check(zoneThemeEnvelopeSchema, theme)).toBe(true);
    expect(Value.Check(zonePageEnvelopeSchema, page)).toBe(true);
  });

  test("parsers normalize valid envelopes and reject wrong schema names", () => {
    expect(parseZoneBoundary(structuredClone(boundary))).toEqual(boundary);
    expect(parseZoneNav(structuredClone(nav))).toEqual(nav);
    expect(parseZoneTheme(structuredClone(theme))).toEqual(theme);
    expect(parseZonePage(structuredClone(page))).toEqual(page);

    expect(
      parseZoneBoundary({ ...boundary, schema: "rezics/zone-config" }),
    ).toBeNull();
    expect(parseZonePage({ ...page, version: 99 })).toBeNull();
  });

  test("image fields accept only HTTPS URLs", () => {
    expect(
      Value.Check(zoneThemeEnvelopeSchema, {
        ...theme,
        images: { logoUrl: "http://cdn.example.test/logo.png" },
      }),
    ).toBe(false);
    expect(
      Value.Check(zoneNavEnvelopeSchema, {
        ...nav,
        header: { ...nav.header, logoImageUrl: "/logo.png" },
      }),
    ).toBe(false);
    expect(
      Value.Check(zonePageEnvelopeSchema, {
        ...page,
        sections: [
          {
            id: "stage",
            kind: "stage",
            background: { imageUrl: "http://cdn.example.test/hero.png" },
            sections: [],
          },
        ],
      }),
    ).toBe(false);
  });
});
