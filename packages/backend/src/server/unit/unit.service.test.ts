import { describe, expect, mock, test } from "bun:test";
import type { UnitWithRelations } from "./types";
import type { UnitRepository, UnitService } from "./unit.service";

mock.module("@/content-doc/json-write", () => ({
  nullableContentDocJson: (value: unknown) => value ?? null,
}));
mock.module("@/content-translation/mapper", () => ({
  mapContentTranslationToDTO: (row: unknown) => row,
}));
mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "global",
  pickSlugScope: () => "global",
  requireSlugScopeId: () => "global",
}));
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: mock(async () => ({ status: "created" })),
  },
}));
mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  createReaction: mock(async () => ({})),
  cleanupReactions: mock(async () => undefined),
  listByUser: mock(async () => ({ items: [], nextCursor: null })),
  listGivenReactions: mock(async () => ({ items: [], nextCursor: null })),
  removeReaction: mock(async () => undefined),
}));
mock.module("@/utils/userSlugHydration", () => ({
  hydrateUnitOwnerUserSlugRow: async (row: unknown) => row,
  hydrateUnitOwnerUserSlugs: async (rows: unknown) => rows,
  loadUserSlugMap: async () => new Map(),
}));
mock.module("@/utils/sanitizeUser", () => ({
  publicUserSelect: {},
  mapPublicUser: (user: unknown) => user,
}));
class MockAppError extends Error {
  statusCode: number;
  code?: string;
  details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    message: string,
    options?: { code?: string; details?: Record<string, unknown> },
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = options?.code;
    this.details = options?.details;
  }
}

mock.module("@/utils/errors", () => ({
  AppError: MockAppError,
  forbidden: (message: string) =>
    new MockAppError(403, `Forbidden: ${message}`),
  notFound: (message: string) => new MockAppError(404, `${message} not found`),
  unauthorized: (message: string) =>
    new MockAppError(401, `Unauthorized: ${message}`),
}));

const { buildUnitWhereClause } = await import("./unit.service");

function unitRow(
  overrides: Partial<UnitWithRelations> = {},
): UnitWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "unit-1",
    type: "BOOK",
    slug: null,
    slugScope: "global",
    userId: null,
    defaultLanguage: null,
    isLanguageNeutral: false,
    status: "DRAFT",
    visibility: "PUBLIC",
    rating: "GENERAL",
    extra: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    subscriberCount: 0,
    referenceCount: 0,
    licenseSlug: null,
    aiDisclosureMode: "UNKNOWN",
    aiDisclosureDetails: null,
    catalogEntryKind: null,
    targetUnitId: null,
    moderationStatus: "APPROVED",
    translations: [],
    supportLanguages: [],
    ...overrides,
  };
}

function createRepositoryStub(
  overrides: Partial<UnitRepository> = {},
): UnitRepository {
  return {
    list: mock(async () => ({ units: [], total: 0 })),
    getByUnitId: mock(async (unitId) => unitRow({ id: unitId })),
    create: mock(async (input) =>
      unitRow({
        id: "unit-1",
        type: input.type as UnitWithRelations["type"],
        catalogEntryKind:
          input.catalogEntryKind === undefined
            ? null
            : (input.catalogEntryKind as UnitWithRelations["catalogEntryKind"]),
        targetUnitId:
          input.targetUnitId === undefined ? null : input.targetUnitId,
      }),
    ),
    update: mock(async (unitId, input) =>
      unitRow({
        id: unitId,
        catalogEntryKind:
          input.catalogEntryKind === undefined
            ? null
            : (input.catalogEntryKind as UnitWithRelations["catalogEntryKind"]),
        targetUnitId:
          input.targetUnitId === undefined ? null : input.targetUnitId,
      }),
    ),
    getBySlug: mock(async () => null),
    setSlug: mock(async (unitId, slug) => unitRow({ id: unitId, slug })),
    delete: mock(async () => {}),
    ...overrides,
  };
}

async function createService(repository: UnitRepository) {
  const module = await import("./unit.service");
  return new module.UnitService(repository) as UnitService;
}

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
            { id: "spice" },
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
        { id: "unit-1" },
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
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create({
      type: "BOOK",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
    });

    expect(repository.create).toHaveBeenCalledWith({
      type: "BOOK",
      catalogEntryKind: "VARIANT",
      targetUnitId: "main-entry-1",
    });
  });

  test("passes inline translations through create for primary support language persistence", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.create({
      type: "BOOK",
      translations: [{ language: "ja", title: "銀河鉄道の夜" }],
    });

    expect(repository.create).toHaveBeenCalledWith({
      type: "BOOK",
      translations: [{ language: "ja", title: "銀河鉄道の夜" }],
    });
  });

  test("patches catalog identity on update for search projection sync", async () => {
    const repository = createRepositoryStub();
    const service = await createService(repository);

    await service.update("variant-1", {
      catalogEntryKind: "MAIN",
      targetUnitId: null,
    });

    expect(repository.update).toHaveBeenCalledWith("variant-1", {
      catalogEntryKind: "MAIN",
      targetUnitId: null,
    });
  });
});
