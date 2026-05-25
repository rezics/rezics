import { describe, expect, mock, test } from "bun:test";
import { installPrismaClientMock, prismaMock } from "@/test/prisma-client-mock";

installPrismaClientMock();

const refRules = [
  {
    externalKind: "book",
    externalIdName: "bookId",
    urlTemplate: "https://book.qidian.com/info/{externalId}",
    urlMatchPattern: "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
  },
] as const;

function freshMocks() {
  const createdRef = {
    id: "ref-1",
    unitId: "unit-1",
    sourceSiteEntityUnitId: "source-site-1",
    externalKind: "book",
    externalId: "123",
    canonicalUrl: "https://book.qidian.com/info/123",
    originalUrl: null,
    firstSeenAt: new Date("2026-05-25T00:00:00.000Z"),
    lastSeenAt: new Date("2026-05-25T00:00:00.000Z"),
    createdAt: new Date("2026-05-25T00:00:00.000Z"),
    updatedAt: new Date("2026-05-25T00:00:00.000Z"),
    sourceSite: null,
  };
  Object.assign(prismaMock, {
    unit: {
      findUniqueOrThrow: mock(async () => ({ id: "unit-1" })),
    },
    sourceSite: {
      findUniqueOrThrow: mock(async () => ({ refRules })),
    },
    unitExternalRef: {
      create: mock(async ({ data }: any) => ({ ...createdRef, ...data })),
      update: mock(async ({ data }: any) => ({ ...createdRef, ...data })),
      findUniqueOrThrow: mock(async () => createdRef),
      findMany: mock(async () => [createdRef]),
      count: mock(async () => 1),
      delete: mock(async () => createdRef),
    },
  });
}

describe("UnitExternalRefService", () => {
  test("derives and caches canonical URL from source rules", async () => {
    freshMocks();
    const { unitExternalRefService } = await import(
      "./unit-external-ref.service"
    );

    await unitExternalRefService.create({
      unitId: "unit-1",
      sourceSiteEntityUnitId: "source-site-1",
      externalKind: "book",
      externalId: "123",
    });

    expect(prismaMock.unitExternalRef.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalKind: "book",
          externalId: "123",
          canonicalUrl: "https://book.qidian.com/info/123",
        }),
      }),
    );
  });

  test("reverse parses pasted URLs", async () => {
    freshMocks();
    const { unitExternalRefService } = await import(
      "./unit-external-ref.service"
    );

    const parsed = await unitExternalRefService.parseUrl(
      "source-site-1",
      "https://book.qidian.com/info/123?from=share",
    );

    expect(parsed).toEqual({ externalKind: "book", externalId: "123" });
  });

  test("rejects external kinds not declared by the source", async () => {
    freshMocks();
    const { unitExternalRefService } = await import(
      "./unit-external-ref.service"
    );

    await expect(
      unitExternalRefService.create({
        unitId: "unit-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "author",
        externalId: "a-1",
      }),
    ).rejects.toThrow(/not declared/);
  });

  test("does not validate external kind against Unit kind", async () => {
    freshMocks();
    const { unitExternalRefService } = await import(
      "./unit-external-ref.service"
    );

    await expect(
      unitExternalRefService.create({
        unitId: "publisher-entity-unit",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
      }),
    ).resolves.toBeDefined();
  });
});
