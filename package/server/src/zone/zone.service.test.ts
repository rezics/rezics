import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@localhost:5432/rezics_book";

const unitRows = new Map<string, { id: string; type: string }>([
  ["realm-1", { id: "realm-1", type: "REALM" }],
  ["entity-1", { id: "entity-1", type: "ENTITY" }],
  ["tag-1", { id: "tag-1", type: "TAG" }],
  ["label-1", { id: "label-1", type: "LABEL" }],
  ["unit-1", { id: "unit-1", type: "POST" }],
  ["image-1", { id: "image-1", type: "IMAGE" }],
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

const unitFindManyMock = mock(async ({ where }: any): Promise<any[]> => {
  if (!where.id?.in) {
    return [...hydratedUnitRows.values()].filter((row) => row.type === "POST");
  }
  const ids = where.id.in as string[];
  return ids.flatMap((id) => {
    const hydrated = hydratedUnitRows.get(id);
    if (hydrated) return [hydrated];
    const row = unitRows.get(id);
    return row ? [row] : [];
  });
});
const zoneUpdateMock = mock(
  async (): Promise<any> => ({
    unitId: "zone-1",
    filters: {},
    template: "default",
    styling: null,
    wiki: null,
    startsAt: null,
    endsAt: null,
    unit: { translations: [] },
  }),
);
const zoneFindUniqueMock = mock(
  async (): Promise<any> => ({
    unitId: "zone-1",
    filters: {},
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
    unit: { translations: [] },
  }),
);
const subjectAttributionFindManyMock = mock(
  async (): Promise<any[]> => [
    {
      entityId: "entity-1",
      sortOrder: 0,
      entity: hydratedUnitRows.get("entity-1"),
    },
  ],
);

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findMany: unitFindManyMock,
  },
  zone: {
    findUnique: zoneFindUniqueMock,
    update: zoneUpdateMock,
  },
  subjectAttribution: {
    findMany: subjectAttributionFindManyMock,
  },
});

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
    status: number;
    code?: string;
    details?: unknown;

    constructor(
      status: number,
      message: string,
      options?: { code?: string; details?: unknown },
    ) {
      super(message);
      this.status = status;
      this.code = options?.code;
      this.details = options?.details;
    }
  },
}));

const { ZoneService } = await import("./zone.service");

describe("ZoneService wiki config validation", () => {
  const service = new ZoneService();

  beforeEach(() => {
    unitFindManyMock.mockClear();
    zoneUpdateMock.mockClear();
    zoneFindUniqueMock.mockClear();
    subjectAttributionFindManyMock.mockClear();
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

    expect(zoneUpdateMock).toHaveBeenCalled();
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

    expect(zoneUpdateMock).not.toHaveBeenCalled();
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

    expect(zoneUpdateMock).not.toHaveBeenCalled();
  });

  test("hydrates wiki homepage sections with public section queries", async () => {
    const data = await service.getWikiHomepageData("zone-1", {
      preferredLanguages: ["zh-hant", "en"],
    });

    expect(data?.template).toBe("wiki-classic-home");
    expect(data?.sections.map((section) => section.section.id)).toEqual([
      "featured",
      "tags",
      "characters",
      "recent",
      "manual",
    ]);
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
});
