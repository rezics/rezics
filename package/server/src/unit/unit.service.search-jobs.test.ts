import { describe, expect, mock, test } from "bun:test";
import type { UnitRepository, UnitService } from "./unit.service";
import type { UnitWithRelations } from "./types";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
const cleanupReactionsMock = mock(async () => undefined);
mock.module("@/job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));
mock.module("@/reaction-boundary/reaction-boundary.client", () => ({
  cleanupReactions: cleanupReactionsMock,
}));
mock.module("@/infra/slug-scopes", () => ({
  getSlugScopeId: () => "global",
  pickSlugScope: () => "global",
  requireSlugScopeId: () => "global",
}));

function unitRow(
  overrides: Partial<UnitWithRelations> = {},
): UnitWithRelations {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "unit-1",
    type: "BOOK",
    slug: null,
    slugScope: "global",
    userId: "user-1",
    defaultLanguage: null,
    isLanguageNeutral: false,
    status: "PUBLISHED",
    visibility: "PUBLIC",
    rating: "GENERAL",
    extra: null,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    subscriberCount: 0,
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

function createRepositoryStub(): UnitRepository {
  return {
    list: mock(async () => ({ units: [], total: 0 })),
    getByUnitId: mock(async (unitId) => unitRow({ id: unitId })),
    create: mock(async () => unitRow()),
    update: mock(async (unitId, input) =>
      unitRow({
        id: unitId,
        rating: (input.rating as UnitWithRelations["rating"]) ?? "GENERAL",
        visibility:
          (input.visibility as UnitWithRelations["visibility"]) ?? "PUBLIC",
      }),
    ),
    getBySlug: mock(async () => null),
    setSlug: mock(async (unitId, slug) => unitRow({ id: unitId, slug })),
    delete: mock(async () => {}),
  };
}

async function createService(repository: UnitRepository) {
  const module = await import("./unit.service");
  return new module.UnitService(repository) as UnitService;
}

function resetMocks() {
  enqueueMock.mockClear();
  cleanupReactionsMock.mockClear();
}

describe("UnitService search job producers", () => {
  test("create enqueues content sync", async () => {
    resetMocks();
    const service = await createService(createRepositoryStub());

    await service.create({
      userId: "user-1",
      type: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
      translations: [],
    } as never);

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.sync",
      payload: { unitId: "unit-1" },
      source: { type: "server", service: "unit" },
    });
  });

  test("update enqueues content metadata patch", async () => {
    resetMocks();
    const service = await createService(createRepositoryStub());

    await service.update("unit-1", {
      rating: "GENERAL",
      visibility: "PUBLIC",
    } as never);

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchMetadata",
      payload: {
        targetId: "unit-1",
        fields: { rating: "GENERAL", visibility: "PUBLIC" },
      },
    });
  });

  test("delete enqueues content delete and leaves reaction cleanup fire-and-forget", async () => {
    resetMocks();
    const service = await createService(createRepositoryStub());

    await service.delete("unit-1");

    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.delete",
      payload: { unitId: "unit-1" },
    });
    expect(cleanupReactionsMock).toHaveBeenCalledWith("unit-1");
  });
});
