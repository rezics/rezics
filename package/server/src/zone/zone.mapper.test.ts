import { describe, expect, test } from "bun:test";
import type {
  ZoneBoundary,
  ZoneNav,
  ZonePage,
  ZoneTheme,
} from "@rezics/contract";
import { mapZoneToDTO } from "./zone.mapper";
import type { ZoneWithRelations } from "./zone.service";

const boundary: ZoneBoundary = {
  schema: "rezics/zone-boundary",
  version: 1,
  context: { kind: "global" },
  filters: {},
};

const nav: ZoneNav = {
  schema: "rezics/zone-nav",
  version: 1,
  menus: [{ id: "main", nodes: [] }],
  header: { menuId: "main" },
};

const theme: ZoneTheme = {
  schema: "rezics/zone-theme",
  version: 1,
};

const homePageConfig: ZonePage = {
  schema: "rezics/zone-page",
  version: 1,
  sections: [],
};

function zoneFixture(): ZoneWithRelations {
  return {
    unitId: "zone-1",
    ownerRealmUnitId: "realm-1",
    boundary,
    nav,
    theme,
    homePageId: "page-home",
    pages: [
      {
        id: "page-home",
        zoneUnitId: "zone-1",
        slug: "home",
        config: homePageConfig,
        position: 0,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    unit: {
      slug: "toaru",
      translations: [
        {
          language: "en",
          title: "Toaru",
          description: {
            schema: "rezics.content",
            version: 1,
            main: { type: "markdown", source: "English description" },
          },
        },
        {
          language: "zh-hant",
          title: "魔禁百科",
          description: null,
        },
      ],
      supportLanguages: [
        { language: "en", isPrimary: true, sortOrder: 0 },
        { language: "zh-hant", isPrimary: false, sortOrder: 1 },
      ],
    } as unknown as ZoneWithRelations["unit"],
  } as ZoneWithRelations;
}

describe("mapZoneToDTO", () => {
  test("resolves name/description by the reader language chain", () => {
    const dto = mapZoneToDTO(zoneFixture(), ["zh-hant"]);
    expect(dto.name).toBe("魔禁百科");
    expect(dto.description).toBeNull();
    expect(dto.slug).toBe("toaru");
    expect(dto.boundary).toEqual(boundary);
    expect(dto.nav).toEqual(nav);
    expect(dto.theme).toEqual(theme);
    expect(dto.homePageId).toBe("page-home");
    expect(dto.pages).toEqual([{ id: "page-home", slug: "home", position: 0 }]);
    expect(dto.startsAt).toBe("2026-01-01T00:00:00.000Z");
    expect(dto.endsAt).toBeNull();
  });

  test("returns the full translations array for the manage editor", () => {
    const dto = mapZoneToDTO(zoneFixture(), ["en"]);
    expect(dto.name).toBe("Toaru");
    expect(dto.description).toBe("English description");
    expect(dto.translations).toEqual([
      {
        language: "en",
        title: "Toaru",
        description: "English description",
      },
      { language: "zh-hant", title: "魔禁百科", description: undefined },
    ]);
  });

  test("falls back to the first translation when no language matches", () => {
    const dto = mapZoneToDTO(zoneFixture(), ["ko"]);
    expect(dto.name).toBe("Toaru");
  });
});
