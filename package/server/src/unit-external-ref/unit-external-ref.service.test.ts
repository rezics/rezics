import { describe, expect, mock, test } from "bun:test";
import {
  type UnitExternalRefRepository,
  UnitExternalRefService,
} from "./unit-external-ref.service";

const refRules = [
  {
    externalKind: "book",
    externalIdName: "bookId",
    urlTemplate: "https://book.qidian.com/info/{externalId}",
    urlMatchPattern: "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
  },
] as const;

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

function freshRepository(): UnitExternalRefRepository {
  return {
    list: mock(async () => ({ rows: [createdRef], total: 1 })),
    unitExists: mock(async () => true),
    getSourceSiteRules: mock(async () => ({ refRules })),
    create: mock(async (data) => ({ ...createdRef, ...data })),
    getCurrent: mock(async () => ({
      sourceSiteEntityUnitId: "source-site-1",
      externalKind: "book",
      externalId: "123",
      originalUrl: null,
    })),
    update: mock(async (_id, data) => ({ ...createdRef, ...data })),
    delete: mock(async () => undefined),
  };
}

describe("UnitExternalRefService", () => {
  test("derives and caches canonical URL from source rules", async () => {
    const repository = freshRepository();
    const service = new UnitExternalRefService(repository);

    await service.create({
      unitId: "unit-1",
      sourceSiteEntityUnitId: "source-site-1",
      externalKind: "book",
      externalId: "123",
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        externalKind: "book",
        externalId: "123",
        canonicalUrl: "https://book.qidian.com/info/123",
      }),
    );
  });

  test("reverse parses pasted URLs", async () => {
    const service = new UnitExternalRefService(freshRepository());

    const parsed = await service.parseUrl(
      "source-site-1",
      "https://book.qidian.com/info/123?from=share",
    );

    expect(parsed).toEqual({ externalKind: "book", externalId: "123" });
  });

  test("rejects external kinds not declared by the source", async () => {
    const service = new UnitExternalRefService(freshRepository());

    await expect(
      service.create({
        unitId: "unit-1",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "author",
        externalId: "a-1",
      }),
    ).rejects.toThrow(/not declared/);
  });

  test("does not validate external kind against Unit kind", async () => {
    const service = new UnitExternalRefService(freshRepository());

    await expect(
      service.create({
        unitId: "publisher-entity-unit",
        sourceSiteEntityUnitId: "source-site-1",
        externalKind: "book",
        externalId: "123",
      }),
    ).resolves.toBeDefined();
  });
});
