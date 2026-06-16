import { describe, expect, test } from "bun:test";
import type { ZoneConfig } from "@rezics/contract";
import { mapZoneToDTO } from "./zone.mapper";
import type { ZoneWithRelations } from "./zone.service";

const config: ZoneConfig = {
  schema: "rezics/zone-config",
  version: 1,
  context: { kind: "global" },
  filters: {},
  menus: [{ id: "main", nodes: [] }],
  header: { menuId: "main" },
  pages: { home: { sections: [] } },
  theme: {},
};

function zoneFixture(): ZoneWithRelations {
  return {
    unitId: "zone-1",
    ownerRealmUnitId: "realm-1",
    config,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    unit: {
      slug: "toaru",
      translations: [
        {
          language: "en",
          title: "Toaru Wiki",
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
    expect(dto.config).toEqual(config);
    expect(dto.startsAt).toBe("2026-01-01T00:00:00.000Z");
    expect(dto.endsAt).toBeNull();
  });

  test("returns the full translations array for the manage editor", () => {
    const dto = mapZoneToDTO(zoneFixture(), ["en"]);
    expect(dto.name).toBe("Toaru Wiki");
    expect(dto.description).toBe("English description");
    expect(dto.translations).toEqual([
      {
        language: "en",
        title: "Toaru Wiki",
        description: "English description",
      },
      { language: "zh-hant", title: "魔禁百科", description: undefined },
    ]);
  });

  test("falls back to the first translation when no language matches", () => {
    const dto = mapZoneToDTO(zoneFixture(), ["ko"]);
    expect(dto.name).toBe("Toaru Wiki");
  });
});
