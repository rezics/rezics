import { describe, expect, mock, test } from "bun:test";
import { mapSourceSiteToDTO } from "./source-site.mapper";
import {
  SourceSiteService,
  type SourceSiteRepository,
} from "./source-site.service";

const now = new Date("2026-05-25T00:00:00.000Z");
const refRules = [
  {
    externalKind: "book",
    externalIdName: "bookId",
    urlTemplate: "https://book.qidian.com/info/{externalId}",
    urlMatchPattern: "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
  },
] as const;

function sourceSiteRow(overrides: Record<string, any> = {}) {
  return {
    entityUnitId: "source-site-1",
    key: "qidian",
    crawlSupport: overrides.crawlSupport ?? "supported",
    crawlEnabled: overrides.crawlEnabled ?? true,
    crawlerAdapterKey: overrides.crawlerAdapterKey ?? "qidian",
    refRules,
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
        userId: "user-1",
        createdAt: now,
        updatedAt: now,
        translations: [],
      },
    },
  };
}

function freshRepository(): SourceSiteRepository {
  const row = sourceSiteRow();
  return {
    list: mock(async () => ({ rows: [row], total: 1 })),
    getByEntityUnitId: mock(async () => row),
    entityExists: mock(async () => true),
    create: mock(async () => row),
    update: mock(async () => row),
    delete: mock(async () => undefined),
  };
}

describe("SourceSiteService", () => {
  test("creates a SourceSite bound to an existing Entity Unit", async () => {
    const repository = freshRepository();
    const service = new SourceSiteService(repository);

    const row = await service.create({
      entityUnitId: "source-site-1",
      key: "qidian",
      crawlSupport: "supported",
      crawlEnabled: true,
      crawlerAdapterKey: "qidian",
      refRules: [...refRules],
    });

    expect(row.key).toBe("qidian");
    expect(repository.entityExists).toHaveBeenCalledWith("source-site-1");
  });

  test("rejects duplicated display fields", async () => {
    const service = new SourceSiteService(freshRepository());

    await expect(
      service.create({
        entityUnitId: "source-site-1",
        key: "qidian",
        crawlSupport: "supported",
        refRules: [...refRules],
        name: "Qidian",
      } as any),
    ).rejects.toThrow(/display fields/);
  });

  test("hydrates derived crawl gates in DTO mapping", () => {
    const dto = mapSourceSiteToDTO(
      sourceSiteRow({ crawlEnabled: false }) as any,
    );

    expect(dto.supportsCrawl).toBe(true);
    expect(dto.canScheduleCrawl).toBe(false);
    expect(dto.entity?.slug).toBe("qidian");
  });
});
