import { describe, expect, test } from "bun:test";

const { mapZoneToDTO } = await import(
  "./zone.mapper.ts?zone-mapper-test-actual" as string
);

describe("mapZoneToDTO", () => {
  test("preserves the hydrated Unit slug", () => {
    const dto = mapZoneToDTO({
      unitId: "zone-1",
      ownerRealmUnitId: "realm-1",
      filters: {},
      configVersion: 1,
      pages: null,
      sections: null,
      theme: null,
      primaryRealmUnitId: null,
      template: "default",
      styling: null,
      wiki: null,
      startsAt: null,
      endsAt: null,
      unit: {
        slug: "library",
        translations: [{ language: "en", title: "Library" }],
        supportLanguages: [],
      },
    } as any);

    expect(dto.slug).toBe("library");
  });
});
