import { beforeEach, describe, expect, mock, test } from "bun:test";
import type {
  CreditAttributionRepository,
  CreditAttributionService,
} from "./credit-attribution.service";

const enqueueMock = mock(async (_command: any) => ({
  status: "created" as const,
}));
mock.module("../job/job-boundary", () => ({
  serverJobProducer: {
    enqueue: enqueueMock,
  },
}));

const now = new Date("2026-05-18T00:00:00.000Z");

function makeCreditRow(overrides: Record<string, any> = {}) {
  return {
    unitId: overrides.unitId ?? "book-1",
    entityId: overrides.entityId ?? "entity-1",
    role: overrides.role ?? "author",
    sortOrder: overrides.sortOrder ?? 0,
    entity: {
      id: overrides.entityId ?? "entity-1",
      type: "ENTITY",
      slug: "liu-cixin",
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
      entity: { kind: "person", verified: false },
      translations: [
        {
          unitId: overrides.entityId ?? "entity-1",
          language: "en",
          title: "Liu Cixin",
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
    evidence: overrides.evidence ?? [],
  } as any;
}

function createRepository() {
  const repository: CreditAttributionRepository = {
    getCreditEntity: mock(async () => ({ eligibleCreditRoles: ["author"] })),
    create: mock(async (input) =>
      makeCreditRow({
        unitId: input.unitId,
        entityId: input.entityId,
        role: input.role,
        sortOrder: input.sortOrder,
      }),
    ),
    delete: mock(async () => {}),
    listByUnit: mock(async () => [makeCreditRow()]),
    createEvidence: mock(async (input) =>
      makeCreditRow({
        unitId: input.unitId,
        entityId: input.entityId,
        role: input.role,
      }),
    ),
  };
  return repository;
}

async function createService(repository: CreditAttributionRepository) {
  const { CreditAttributionService } = await import(
    "./credit-attribution.service"
  );
  return new CreditAttributionService(repository);
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("CreditAttributionService.link", () => {
  test("creates an eligible credit row and enqueues content credit search fields", async () => {
    const repository = createRepository();
    const service = await createService(repository);

    const row = await service.link({
      unitId: "book-1",
      entityId: "entity-1",
      role: "author",
      sortOrder: 2,
    });

    expect(row.entityId).toBe("entity-1");
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
      }),
      undefined,
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.content.patchCredits",
        payload: { unitId: "book-1" },
        source: { type: "server", service: "credit-attribution" },
      }),
    );
  });

  test("rejects an ineligible credit role before creating a row", async () => {
    const repository = createRepository();
    (repository.getCreditEntity as any).mockResolvedValueOnce({
      eligibleCreditRoles: ["translator"],
    });
    const service = await createService(repository);

    await expect(
      service.link({
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
      }),
    ).rejects.toThrow(/not eligible for credit role/);
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("CreditAttributionService.createEvidence", () => {
  test("delegates validation and evidence creation to the repository", async () => {
    const repository = createRepository();
    const service = await createService(repository);

    await service.createEvidence({
      unitId: "book-1",
      entityId: "entity-1",
      role: "author",
      sourceRefId: "source-ref-1",
      claimPath: "$.bookInfo.author",
    });

    expect(repository.createEvidence).toHaveBeenCalledWith({
      unitId: "book-1",
      entityId: "entity-1",
      role: "author",
      sourceRefId: "source-ref-1",
      claimPath: "$.bookInfo.author",
    });
  });

  test("hydrates evidence summaries on read DTOs", async () => {
    const evidence = [
      {
        id: "evidence-1",
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
        sourceRefId: "source-ref-1",
        claimPath: "$.bookInfo.author",
        observedUrl: "https://book.qidian.com/info/123",
        observedAt: now,
        confidence: 0.9,
        createdAt: now,
        updatedAt: now,
        sourceRef: {
          id: "source-ref-1",
          unitId: "book-1",
          sourceSiteEntityUnitId: "source-site-1",
          externalKind: "book",
          externalId: "123",
          canonicalUrl: "https://book.qidian.com/info/123",
          originalUrl: null,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
          sourceSite: {
            entityUnitId: "source-site-1",
            key: "qidian",
            crawlSupport: "none",
            crawlEnabled: false,
            crawlerAdapterKey: null,
            refRules: {},
            createdAt: now,
            updatedAt: now,
            entity: {
              unitId: "source-site-1",
              kind: "organization",
              avatar: null,
              verified: true,
              eligibleCreditRoles: [],
              eligibleSubjectRoles: [],
              unit: {
                id: "source-site-1",
                type: "ENTITY",
                slug: "qidian",
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
              },
            },
          },
        },
      },
    ];
    const repository = createRepository();
    (repository.listByUnit as any).mockResolvedValueOnce([
      makeCreditRow({ evidence }),
    ]);
    const service = await createService(repository);

    const [row] = await service.listByUnit("book-1");

    expect(row!.evidence?.[0]).toMatchObject({
      sourceRefId: "source-ref-1",
      sourceSiteEntityUnitId: "source-site-1",
      externalKind: "book",
      externalId: "123",
      sourceSite: { key: "qidian" },
    });
  });
});
