import { beforeEach, describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const enqueueMock = mock(async (_command: any) => ({
  status: "created" as const,
}));
mock.module("@/job/job-boundary", () => ({
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
      userId: "user-1",
      createdAt: now,
      updatedAt: now,
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
          sourceReleaseUnitId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
  };
}

function freshMocks() {
  const creditRow = makeCreditRow();
  Object.assign(prismaMock, {
    entity: {
      findUnique: mock(async () => ({ eligibleCreditRoles: ["author"] })),
    },
    creditAttribution: {
      create: mock(async () => creditRow),
      delete: mock(async () => creditRow),
      findMany: mock(async () => [creditRow]),
    },
  });
}

beforeEach(() => {
  enqueueMock.mockClear();
});

describe("CreditAttributionService.link", () => {
  test("creates an eligible credit row and enqueues content credit search fields", async () => {
    freshMocks();
    const { creditAttributionService } = await import(
      "./credit-attribution.service"
    );

    const row = await creditAttributionService.link({
      unitId: "book-1",
      entityId: "entity-1",
      role: "author",
      sortOrder: 2,
    });

    expect(row.entityId).toBe("entity-1");
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "search.content.patchCredits",
        payload: { unitId: "book-1" },
        source: { type: "server", service: "credit-attribution" },
      }),
    );
  });

  test("rejects an ineligible credit role before creating a row", async () => {
    freshMocks();
    (prismaMock.entity.findUnique as any).mockImplementation(async () => ({
      eligibleCreditRoles: ["translator"],
    }));
    const { creditAttributionService } = await import(
      "./credit-attribution.service"
    );

    await expect(
      creditAttributionService.link({
        unitId: "book-1",
        entityId: "entity-1",
        role: "author",
      }),
    ).rejects.toThrow(/not eligible for credit role/);
    expect((prismaMock.creditAttribution.create as any).mock.calls.length).toBe(
      0,
    );
  });
});
