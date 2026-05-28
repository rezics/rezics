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
const translationGroupRows = new Set(["tg-1"]);

const unitFindManyMock = mock(async ({ where }: any): Promise<any[]> => {
  const ids = where.id.in as string[];
  return ids.flatMap((id) => {
    const row = unitRows.get(id);
    return row ? [row] : [];
  });
});
const translationGroupFindManyMock = mock(
  async ({ where }: any): Promise<any[]> => {
    const ids = where.id.in as string[];
    return ids.flatMap((id) => (translationGroupRows.has(id) ? [{ id }] : []));
  },
);
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

installPrismaClientMock();
Object.assign(prismaMock, {
  unit: {
    findMany: unitFindManyMock,
  },
  translationGroup: {
    findMany: translationGroupFindManyMock,
  },
  zone: {
    update: zoneUpdateMock,
  },
});

mock.module("@/unit", () => ({
  unitService: {
    create: mock(async () => ({ id: "zone-1" })),
    setSlug: mock(async () => undefined),
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
    translationGroupFindManyMock.mockClear();
    zoneUpdateMock.mockClear();
  });

  test("persists wiki config when references are valid", async () => {
    await service.update("zone-1", {
      wiki: {
        filters: {
          realmUnitId: "realm-1",
          tagUnitIds: ["tag-1"],
          subjectFilters: [{ entityIds: ["entity-1"] }],
          translationGroupIds: ["tg-1"],
        },
        navigation: {
          sections: [
            {
              id: "main",
              labelUnitId: "label-1",
              items: [
                { kind: "entity", entityId: "entity-1" },
                { kind: "tag", tagUnitId: "tag-1" },
                { kind: "translationGroup", translationGroupId: "tg-1" },
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
});
