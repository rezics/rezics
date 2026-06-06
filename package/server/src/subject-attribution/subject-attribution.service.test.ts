import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  SubjectAttributionRepository,
  SubjectAttributionService,
} from "./subject-attribution.service";

const enqueueMock = mock(async (_command: any) => ({ status: "created" }));
mock.module("../job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const now = new Date("2026-05-18T00:00:00.000Z");

function makeSubjectRow(overrides: Record<string, any> = {}) {
  return {
    unitId: overrides.unitId ?? "work-1",
    entityId: overrides.entityId ?? "character-1",
    role: overrides.role ?? "primary_character",
    sortOrder: overrides.sortOrder ?? 0,
    weight: overrides.weight ?? null,
    entity: {
      id: overrides.entityId ?? "character-1",
      type: "ENTITY",
      slug: "aster",
      slugScope: "scope-1",
      userId: "user-1",
      defaultLanguage: "en",
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      subscriberCount: 0,
      licenseSlug: null,
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      catalogEntryKind: null,
      targetUnitId: null,
      moderationStatus: "APPROVED",
      entity: { kind: "character", verified: false },
      translations: [
        {
          unitId: overrides.entityId ?? "character-1",
          language: "en",
          title: "Aster",
          subtitle: null,
          summary: null,
          description: null,
          extra: null,
          sourceUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    unit: {
      id: overrides.unitId ?? "work-1",
      type: "BOOK",
      slug: null,
      slugScope: "scope-1",
      userId: "user-1",
      defaultLanguage: "en",
      isLanguageNeutral: false,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      subscriberCount: 0,
      licenseSlug: null,
      aiDisclosureMode: "UNKNOWN",
      aiDisclosureDetails: null,
      catalogEntryKind: null,
      targetUnitId: null,
      moderationStatus: "APPROVED",
      translations: [],
      supportLanguages: [],
    },
  } as any;
}

function createRepository() {
  const repository: SubjectAttributionRepository = {
    getEntityUnit: mock(async () => ({ id: "character-1", type: "ENTITY" })),
    getSubjectEntity: mock(async () => ({
      eligibleSubjectRoles: ["primary_character"],
    })),
    create: mock(async (input) =>
      makeSubjectRow({
        unitId: input.unitId,
        entityId: input.entityId,
        role: input.role,
        sortOrder: input.sortOrder,
        weight: input.weight,
      }),
    ),
    delete: mock(async () => {}),
    listByUnit: mock(async () => [makeSubjectRow()]),
    listBySubject: mock(async () => [makeSubjectRow()]),
  };
  return repository;
}

async function createService(repository: SubjectAttributionRepository) {
  const { SubjectAttributionService } = await import(
    "./subject-attribution.service"
  );
  return new SubjectAttributionService(repository);
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("SubjectAttributionService.link", () => {
  test("rejects a subject entityId that does not point at an ENTITY Unit", async () => {
    const repository = createRepository();
    (repository.getEntityUnit as any).mockResolvedValueOnce({
      id: "book-1",
      type: "BOOK",
    });
    const service = await createService(repository);

    await expect(
      service.link({
        unitId: "work-1",
        entityId: "book-1",
        role: "primary_character",
      }),
    ).rejects.toThrow(/must reference an ENTITY Unit/);
    expect(repository.create).not.toHaveBeenCalled();
  });

  test("creates the subject row and patches subject search fields", async () => {
    const repository = createRepository();
    const service = await createService(repository);

    const row = await service.link({
      unitId: "work-1",
      entityId: "character-1",
      role: "primary_character",
      sortOrder: 2,
      weight: 0.8,
    });

    expect(row.entity?.kind).toBe("character");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "work-1",
        entityId: "character-1",
        role: "primary_character",
      }),
      undefined,
    );
    expect(enqueueMock.mock.calls[0]?.[0]).toMatchObject({
      kind: "search.content.patchSubjects",
      payload: { unitId: "work-1" },
      source: { type: "server", service: "subject-attribution" },
    });
  });

  test("rejects an ineligible subject role before creating a row", async () => {
    const repository = createRepository();
    (repository.getSubjectEntity as any).mockResolvedValueOnce({
      eligibleSubjectRoles: ["about"],
    });
    const service = await createService(repository);

    await expect(
      service.link({
        unitId: "work-1",
        entityId: "character-1",
        role: "primary_character",
      }),
    ).rejects.toThrow(/not eligible for subject role/);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("SubjectAttributionService.listBySubject", () => {
  test("passes role and target Unit filters into repository", async () => {
    const repository = createRepository();
    const service = await createService(repository);

    await service.listBySubject("character-1", {
      role: "primary_character",
      unitType: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
    });

    expect(repository.listBySubject).toHaveBeenCalledWith("character-1", {
      role: "primary_character",
      unitType: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
    });
  });
});
