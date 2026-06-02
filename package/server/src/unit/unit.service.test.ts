import { describe, expect, mock, test } from "bun:test";
import {
  installPrismaClientMock,
  prismaMock,
} from "../test/prisma-client-mock";

installPrismaClientMock();
mock.module("@/content-doc/prisma-json", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/content-translation/mapper", () => ({
  mapContentTranslationToDTO: (row: unknown) => row,
}));
mock.module("@/infra/slug-scopes", () => ({
  pickSlugScope: () => "global",
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({ status: "created" })),
  },
}));
mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  cleanupReactions: mock(async () => undefined),
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
}));
mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
  mapPublicUser: (user: unknown) => user,
}));
mock.module("@/utils/errors", () => ({
  AppError: class AppError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const { buildUnitWhereClause } = await import("./unit.service");

describe("buildUnitWhereClause", () => {
  test("searches operator lookup fields and structured filters", () => {
    expect(
      buildUnitWhereClause({
        q: "spice",
        id: "unit-1",
        slug: "dune",
        title: "Dune",
        type: "BOOK",
        userId: "owner-1",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      }),
    ).toEqual({
      AND: [
        {
          OR: [
            { id: { contains: "spice", mode: "insensitive" } },
            { slug: { contains: "spice", mode: "insensitive" } },
            {
              translations: {
                some: {
                  title: { contains: "spice", mode: "insensitive" },
                },
              },
            },
          ],
        },
        { id: { contains: "unit-1", mode: "insensitive" } },
        { slug: { contains: "dune", mode: "insensitive" } },
        {
          translations: {
            some: {
              title: { contains: "Dune", mode: "insensitive" },
            },
          },
        },
        { type: { in: ["BOOK"] } },
        { status: { in: ["PUBLISHED"] } },
        { visibility: "PUBLIC" },
        { userId: { in: ["owner-1"] } },
      ],
    });
  });

  test("filters catalog identity and exact variant target", () => {
    expect(
      buildUnitWhereClause({
        type: "BOOK",
        catalogEntryKind: "VARIANT",
        targetUnitId: "main-entry-1",
      }),
    ).toEqual({
      AND: [
        { type: { in: ["BOOK"] } },
        { catalogEntryKind: "VARIANT" },
        { targetUnitId: "main-entry-1" },
      ],
    });
  });
});

describe("UnitService catalog identity", () => {
  test("persists catalog identity on create", async () => {
    const create = mock(async () => ({ id: "variant-1" }));
    const findUniqueOrThrow = mock(async () => ({
      id: "variant-1",
      type: "BOOK",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
      translations: [],
    }));
    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          unit: { create, findUniqueOrThrow },
        }),
    });

    const { UnitService } = await import("./unit.service");
    await new UnitService().create({
      type: "BOOK",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
    });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      type: "BOOK",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
    });
  });

  test("creates a primary support language from the first inline translation", async () => {
    const create = mock(async () => ({ id: "book-1" }));
    const findUniqueOrThrow = mock(async () => ({
      id: "book-1",
      type: "BOOK",
      translations: [],
      supportLanguages: [],
    }));
    Object.assign(prismaMock, {
      $transaction: async (fn: any) =>
        fn({
          unit: { create, findUniqueOrThrow },
        }),
    });

    const { UnitService } = await import("./unit.service");
    await new UnitService().create({
      type: "BOOK",
      translations: [{ language: "ja", title: "銀河鉄道の夜" }],
    });

    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      supportLanguages: {
        create: { language: "ja", isPrimary: true, sortOrder: 0 },
      },
    });
    expect(create.mock.calls[0]?.[0].data).not.toHaveProperty(
      "defaultLanguage",
    );
  });

  test("patches catalog identity on update for search projection sync", async () => {
    const update = mock(async () => ({
      id: "variant-1",
      type: "BOOK",
      catalogEntryKind: "MAIN",
      targetUnitId: null,
      translations: [],
    }));
    Object.assign(prismaMock, {
      unit: { update },
    });

    const { UnitService } = await import("./unit.service");
    await new UnitService().update("variant-1", {
      catalogEntryKind: "MAIN",
      targetUnitId: null,
    });

    expect(update.mock.calls[0]?.[0]).toMatchObject({
      where: { id: "variant-1" },
      data: { catalogEntryKind: "MAIN", targetUnitId: null },
    });
  });
});
