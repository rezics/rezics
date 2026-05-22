import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const patchContentSubjectsToMeili = mock(async (_unitId: string) => {});
mock.module("@/meili/content/sync", () => ({
  patchContentSubjectsToMeili,
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
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
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
          sourceReleaseUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    unit: {
      id: overrides.unitId ?? "work-1",
      type: "BOOK",
      slug: null,
      userId: "user-1",
      workUnitId: null,
      defaultLanguage: "en",
      isLanguageNeutral: false,
      translationGroupId: null,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      rating: "GENERAL",
      extra: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
      translations: [],
      supportLanguages: [],
    },
  };
}

function freshMocks() {
  const subjectRow = makeSubjectRow();
  Object.assign(prismaMock, {
    unit: {
      findUnique: mock(async () => ({ id: "character-1", type: "ENTITY" })),
    },
    entity: {
      findUnique: mock(async () => ({
        eligibleSubjectRoles: ["primary_character"],
      })),
    },
    subjectAttribution: {
      create: mock(async () => subjectRow),
      delete: mock(async () => subjectRow),
      findMany: mock(async () => [subjectRow]),
    },
  });
  return { subjectRow };
}

beforeEach(() => {
  patchContentSubjectsToMeili.mockClear();
});

describe("SubjectAttributionService.link", () => {
  test("rejects a subject entityId that does not point at an ENTITY Unit", async () => {
    freshMocks();
    (prismaMock.unit.findUnique as any).mockImplementation(async () => ({
      id: "book-1",
      type: "BOOK",
    }));
    const { subjectAttributionService } = await import(
      "./subject-attribution.service"
    );

    await expect(
      subjectAttributionService.link({
        unitId: "work-1",
        entityId: "book-1",
        role: "primary_character",
      }),
    ).rejects.toThrow(/must reference an ENTITY Unit/);
    expect(
      (prismaMock.subjectAttribution.create as any).mock.calls.length,
    ).toBe(0);
  });

  test("creates the subject row and patches subject search fields", async () => {
    freshMocks();
    const { subjectAttributionService } = await import(
      "./subject-attribution.service"
    );

    const row = await subjectAttributionService.link({
      unitId: "work-1",
      entityId: "character-1",
      role: "primary_character",
      sortOrder: 2,
      weight: 0.8,
    });

    expect(row.entity?.kind).toBe("character");
    expect(patchContentSubjectsToMeili).toHaveBeenCalledWith("work-1");
  });

  test("rejects an ineligible subject role before creating a row", async () => {
    freshMocks();
    (prismaMock.entity.findUnique as any).mockImplementation(async () => ({
      eligibleSubjectRoles: ["about"],
    }));
    const { subjectAttributionService } = await import(
      "./subject-attribution.service"
    );

    await expect(
      subjectAttributionService.link({
        unitId: "work-1",
        entityId: "character-1",
        role: "primary_character",
      }),
    ).rejects.toThrow(/not eligible for subject role/);
    expect(
      (prismaMock.subjectAttribution.create as any).mock.calls.length,
    ).toBe(0);
  });
});

describe("SubjectAttributionService.listBySubject", () => {
  test("passes role and target Unit filters into Prisma", async () => {
    freshMocks();
    const { subjectAttributionService } = await import(
      "./subject-attribution.service"
    );

    await subjectAttributionService.listBySubject("character-1", {
      role: "primary_character",
      unitType: "BOOK",
      status: "PUBLISHED",
      visibility: "PUBLIC",
    });

    const findCall = (prismaMock.subjectAttribution.findMany as any).mock
      .calls[0]?.[0];
    expect(findCall.where).toMatchObject({
      entityId: "character-1",
      role: "primary_character",
      unit: {
        type: "BOOK",
        status: "PUBLISHED",
        visibility: "PUBLIC",
      },
    });
  });
});
