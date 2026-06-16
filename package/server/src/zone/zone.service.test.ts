import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ZoneRepository } from "./zone.service";

const unitRows = new Map<string, { id: string; type: string }>([
  ["realm-1", { id: "realm-1", type: "REALM" }],
  ["entity-1", { id: "entity-1", type: "ENTITY" }],
  ["tag-1", { id: "tag-1", type: "TAG" }],
  ["label-1", { id: "label-1", type: "LABEL" }],
  ["unit-1", { id: "unit-1", type: "POST" }],
  ["image-1", { id: "image-1", type: "IMAGE" }],
  ["wiki-zh", { id: "wiki-zh", type: "POST" }],
]);
const hydratedUnitRows = new Map<string, any>([
  [
    "wiki-en",
    {
      id: "wiki-en",
      type: "POST",
      defaultLanguage: "en",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      translations: [{ language: "en", title: "English Wiki", summary: null }],
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
      post: { kind: "WIKI" },
      contentTranslations: [],
    },
  ],
  [
    "wiki-zh",
    {
      id: "wiki-zh",
      type: "POST",
      defaultLanguage: "zh-hant",
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
      translations: [
        { language: "zh-hant", title: "Traditional Wiki", summary: "Summary" },
      ],
      supportLanguages: [
        { language: "zh-hant", isPrimary: true, sortOrder: 0 },
      ],
      post: { kind: "WIKI" },
      contentTranslations: [],
    },
  ],
  [
    "tag-1",
    {
      id: "tag-1",
      type: "TAG",
      translations: [{ language: "en", title: "Lore", summary: null }],
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
    },
  ],
  [
    "entity-1",
    {
      id: "entity-1",
      type: "ENTITY",
      translations: [{ language: "en", title: "Aster", summary: null }],
      supportLanguages: [{ language: "en", isPrimary: true, sortOrder: 0 }],
      entity: { kind: "character" },
    },
  ],
]);
let slugLookupResult: { id: string; type: string; visibility: string } | null =
  null;

const updateZoneMock = mock(
  async (): Promise<any> => ({
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
    unit: { translations: [], supportLanguages: [] },
  }),
);

const zoneRow: any = {
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
  wiki: {
    filters: { realmUnitId: "realm-1" },
    homepage: {
      template: "wiki-classic-home",
      sections: [
        {
          id: "featured",
          kind: "wikiUnitCollection",
          unitIds: ["wiki-zh"],
        },
        { id: "tags", kind: "tagCollection", tagUnitIds: ["tag-1"] },
        {
          id: "characters",
          kind: "entityCollection",
          entityKinds: ["character"],
          subjectRoles: ["primary_character"],
        },
        { id: "recent", kind: "recentWiki", limit: 1 },
        {
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
      ],
    },
  },
  startsAt: null,
  endsAt: null,
  unit: { translations: [], supportLanguages: [] },
};

const findWikiPostsMock = mock(async (input: any): Promise<any[]> => {
  if (input.unitIds) {
    return input.unitIds.flatMap(
      (id: string) => hydratedUnitRows.get(id) ?? [],
    );
  }
  return [hydratedUnitRows.get("wiki-en")].filter(Boolean);
});

const repository: ZoneRepository = {
  findUnitRefs: mock(async (ids: string[]) =>
    ids.flatMap((id) => {
      const hydrated = hydratedUnitRows.get(id);
      if (hydrated) return [{ id, type: hydrated.type }];
      const row = unitRows.get(id);
      return row ? [row] : [];
    }),
  ),
  getByUnitId: mock(async () => zoneRow),
  findUnitBySlug: mock(async () => slugLookupResult),
  createZone: mock(async (data) => ({
    ...data,
    unit: { translations: [], supportLanguages: [] },
  })) as any,
  updateZone: updateZoneMock,
  findWikiPosts: findWikiPostsMock,
  findTags: mock(async (ids: string[]) =>
    ids.flatMap((id) => hydratedUnitRows.get(id) ?? []),
  ),
  findEntitySection: mock(async () => [
    {
      entityId: "entity-1",
      entity: hydratedUnitRows.get("entity-1"),
    },
  ]),
  deleteUnit: mock(async () => {}),
};

mock.module("@/unit", () => ({
  unitService: {
    create: mock(async () => ({ id: "zone-1" })),
    setSlug: mock(async () => undefined),
  },
}));

mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => undefined),
  },
}));

mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    constructor(
      public readonly statusCode: number,
      message: string,
      public readonly data?: unknown,
    ) {
      super(message);
    }
  },
}));

mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: (scope: string) => (scope === "zone" ? "zone-scope" : null),
}));

const { ZoneService } = await import(
  "./zone.service.ts?zone-service-test-actual" as string
);

describe("ZoneService wiki config validation", () => {
  const service = new ZoneService(repository);

  beforeEach(() => {
    for (const value of Object.values(repository)) {
      const maybeMock = value as { mockClear?: () => void };
      if (typeof maybeMock.mockClear === "function") {
        maybeMock.mockClear();
      }
    }
    updateZoneMock.mockClear();
    findWikiPostsMock.mockClear();
    slugLookupResult = null;
  });

  test("persists wiki config when references are valid", async () => {
    await service.update("zone-1", {
      wiki: {
        filters: {
          realmUnitId: "realm-1",
          tagUnitIds: ["tag-1"],
          subjectFilters: [{ entityIds: ["entity-1"] }],
          wikiUnitIds: ["wiki-zh"],
        },
        navigation: {
          sections: [
            {
              id: "main",
              labelUnitId: "label-1",
              items: [
                { kind: "entity", entityId: "entity-1" },
                { kind: "tag", tagUnitId: "tag-1" },
                { kind: "wikiUnit", unitId: "wiki-zh" },
                { kind: "unit", unitId: "unit-1" },
              ],
            },
          ],
        },
        homepage: {
          template: "wiki-classic-home",
          sections: [
            {
              id: "manual",
              kind: "manualLinks",
              title: { translations: { en: "Manual" } },
              links: [
                {
                  kind: "manualLink",
                  href: "/wiki",
                  label: { translations: { en: "Wiki" } },
                },
              ],
            },
          ],
        },
        theme: {
          template: "wiki-classic",
          homepageTemplate: "wiki-classic-home",
          media: { logoUnitId: "image-1" },
        },
      },
    });

    expect(updateZoneMock).toHaveBeenCalled();
  });

  test("persists owner realm and versioned zone config when references are valid", async () => {
    await service.create({
      userId: "user-1",
      slug: "library",
      translations: [{ language: "en", title: "Library" }],
      ownerRealmUnitId: "realm-1",
      filters: { type: "BOOK" },
      configVersion: 1,
      pages: {
        home: {
          titleLabelUnitId: "label-1",
          sections: [
            {
              id: "latest",
              kind: "latestContent",
              filters: { type: "BOOK" },
            },
            {
              id: "wiki",
              kind: "wikiCollection",
              wikiFilters: { realmUnitId: "realm-1" },
              wikiUnitIds: ["wiki-zh"],
            },
          ],
        },
      },
      sections: [
        {
          id: "realms",
          kind: "realmList",
          realmUnitIds: ["realm-1"],
        },
      ],
      theme: {
        images: { bannerUnitId: "image-1" },
        layout: { contentWidth: "wide", navPosition: "side" },
      },
      primaryRealmUnitId: "realm-1",
      template: "default",
    });

    expect(repository.createZone).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerRealmUnitId: "realm-1",
        configVersion: 1,
        filters: { type: "BOOK" },
        primaryRealmUnitId: "realm-1",
      }),
    );
    const payload = (repository.createZone as any).mock.calls[0][0];
    expect(payload.pages.home.sections[1]).toMatchObject({
      kind: "wikiCollection",
      wikiUnitIds: ["wiki-zh"],
    });
    expect(payload.theme.layout).toEqual({
      contentWidth: "wide",
      navPosition: "side",
    });
  });

  test("rejects a zone owner that is not a realm", async () => {
    await expect(
      service.create({
        userId: "user-1",
        slug: "library",
        translations: [{ language: "en", title: "Library" }],
        ownerRealmUnitId: "tag-1",
        filters: {},
        template: "default",
      }),
    ).rejects.toThrow("Zone config references invalid Realms");

    expect(repository.createZone).not.toHaveBeenCalled();
  });

  test("rejects invalid LABEL references", async () => {
    await expect(
      service.update("zone-1", {
        wiki: {
          filters: { realmUnitId: "realm-1" },
          navigation: {
            sections: [
              {
                id: "main",
                labelUnitId: "tag-1",
                items: [],
              },
            ],
          },
        },
      }),
    ).rejects.toThrow("Wiki Zone config references invalid Units");

    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  test("rejects invalid typed section references", async () => {
    await expect(
      service.update("zone-1", {
        sections: [
          {
            id: "tags",
            kind: "tagNavigation",
            tagUnitIds: ["unit-1"],
          },
        ],
      }),
    ).rejects.toThrow("Zone config references invalid Tags");

    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  test("rejects manual labels without translations", async () => {
    await expect(
      service.update("zone-1", {
        wiki: {
          filters: { realmUnitId: "realm-1" },
          navigation: {
            sections: [
              {
                id: "main",
                label: { translations: {} },
                items: [],
              },
            ],
          },
        },
      }),
    ).rejects.toThrow("Wiki Zone manual labels require translations");

    expect(updateZoneMock).not.toHaveBeenCalled();
  });

  test("looks up zones by slug only when the slug target is a ZONE", async () => {
    slugLookupResult = { id: "zone-1", type: "ZONE", visibility: "PUBLIC" };

    await expect(service.getBySlug("library")).resolves.toBe(zoneRow);
    expect(repository.findUnitBySlug).toHaveBeenCalledWith(
      "zone-scope",
      "library",
    );

    slugLookupResult = { id: "unit-1", type: "POST", visibility: "PUBLIC" };
    await expect(service.getBySlug("library")).resolves.toBeNull();
  });

  test("enforces lifecycle windows", () => {
    const now = Date.now();

    expect(
      service.checkLifecycle({
        ...zoneRow,
        startsAt: new Date(now + 60_000),
        endsAt: null,
      }),
    ).toBe("not_started");
    expect(
      service.checkLifecycle({
        ...zoneRow,
        startsAt: null,
        endsAt: new Date(now - 60_000),
      }),
    ).toBe("ended");
    expect(
      service.checkLifecycle({
        ...zoneRow,
        startsAt: new Date(now - 60_000),
        endsAt: new Date(now + 60_000),
      }),
    ).toBeNull();
  });

  test("hydrates wiki homepage sections with public section queries", async () => {
    const data = await service.getWikiHomepageData("zone-1", {
      preferredLanguages: ["zh-hant", "en"],
    });

    expect(data?.template).toBe("wiki-classic-home");
    expect(
      data?.sections.map(
        (section: { section: { id: string } }) => section.section.id,
      ),
    ).toEqual(["featured", "tags", "characters", "recent", "manual"]);
    expect(data?.sections[0]?.items[0]).toMatchObject({
      kind: "wikiPost",
      unitId: "wiki-zh",
      title: "Traditional Wiki",
    });
    expect(data?.sections[1]?.items[0]).toMatchObject({
      kind: "tag",
      tagUnitId: "tag-1",
      title: "Lore",
    });
    expect(data?.sections[2]?.items[0]).toMatchObject({
      kind: "entity",
      entityUnitId: "entity-1",
      entityKind: "character",
      title: "Aster",
    });
    expect(data?.sections[4]?.items[0]).toMatchObject({
      kind: "navigationItem",
    });
  });

  test("preferred candidates choose the first supported display language", async () => {
    const data = await service.getWikiHomepageData("zone-1", {
      preferredLanguages: ["en", "zh-hant"],
    });

    expect(data?.sections[0]?.items[0]).toMatchObject({
      kind: "wikiPost",
      unitId: "wiki-zh",
      language: "zh-hant",
      title: "Traditional Wiki",
    });
    expect(data?.sections[1]?.items[0]).toMatchObject({
      kind: "tag",
      tagUnitId: "tag-1",
      title: "Lore",
    });
  });

  test("multi-language candidates are not treated as an all-languages requirement", async () => {
    await service.getWikiHomepageData("zone-1", {
      preferredLanguages: ["ja", "en"],
    });

    const featuredCall = findWikiPostsMock.mock.calls.find((call) => {
      const input = call[0] as any;
      return input.unitIds?.includes("wiki-zh");
    })?.[0] as any;
    expect(featuredCall.unitIds).toEqual(["wiki-zh"]);
    expect(featuredCall.preferredLanguages).toBeUndefined();
  });
});
