import { DEFAULT_LANGUAGE, LANGUAGES } from "@rezics/contract";
import type { PrismaClient } from "../generated/client.js";
import { UnitStatus, UnitType } from "../generated/client.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedEntity, CreatedUnit } from "./types.js";

const QIDIAN_REF_RULES = [
  {
    externalKind: "book",
    externalIdName: "bookId",
    urlTemplate: "https://book.qidian.com/info/{externalId}",
    urlMatchPattern: "^https://book\\.qidian\\.com/info/(?<externalId>[^/?#]+)",
    crawlerActionKey: "qidian.book",
    crawlSupported: true,
  },
  {
    externalKind: "publisher",
    externalIdName: "publisherId",
    urlTemplate: "https://www.qidian.com/publisher/{externalId}",
    urlMatchPattern:
      "^https://www\\.qidian\\.com/publisher/(?<externalId>[^/?#]+)",
    crawlerActionKey: "qidian.publisher",
    crawlSupported: false,
  },
] as const;

async function ensureQidianSourceSite(ctx: SeedCtx) {
  const existing = await ctx.prisma.sourceSite.findUnique({
    where: { key: "qidian" },
    select: { entityUnitId: true },
  });
  if (existing) return existing.entityUnitId;

  const sourceUnit = await ctx.prisma.unit.create({
    data: {
      type: UnitType.ENTITY,
      slug: "qidian",
      slugScope: ctx.slugScopes.entity,
      status: UnitStatus.PUBLISHED,
      defaultLanguage: DEFAULT_LANGUAGE,
      translations: {
        create: [
          {
            language: LANGUAGES.ZH_HANT,
            title: "起點中文網",
            summary: "來源站點實體，用於示範外部來源規則。",
          },
          {
            language: LANGUAGES.EN,
            title: "Qidian",
            summary: "Source site Entity for external reference fixtures.",
          },
        ],
      },
      entity: {
        create: {
          kind: "organization",
          verified: true,
          eligibleCreditRoles: ["publisher", "distributor"],
          eligibleSubjectRoles: [],
          sourceSite: {
            create: {
              key: "qidian",
              crawlSupport: "supported",
              crawlEnabled: false,
              crawlerAdapterKey: "qidian",
              refRules: QIDIAN_REF_RULES as any,
            },
          },
        },
      },
    },
    select: { id: true },
  });

  await ctx.sync.entity(sourceUnit.id);
  return sourceUnit.id;
}

async function findOrCreatePublisherCredit(
  prisma: PrismaClient,
  book: CreatedUnit,
  publisher: CreatedEntity,
) {
  return prisma.creditAttribution.upsert({
    where: {
      unitId_entityId_role: {
        unitId: book.id,
        entityId: publisher.unitId,
        role: "publisher",
      },
    },
    create: {
      unitId: book.id,
      entityId: publisher.unitId,
      role: "publisher",
      sortOrder: 0,
    },
    update: {},
  });
}

export async function seedSourceSiteFixtures(
  ctx: SeedCtx,
  books: CreatedUnit[],
  organizations: CreatedEntity[],
): Promise<void> {
  const book = books[0];
  const publisher = organizations[0];
  if (!book || !publisher) {
    console.log("[Seed] SourceSite fixture skipped: missing book or publisher");
    return;
  }

  const qidianEntityUnitId = await ensureQidianSourceSite(ctx);
  await findOrCreatePublisherCredit(ctx.prisma, book, publisher);

  const externalId = "123456";
  const canonicalUrl = `https://book.qidian.com/info/${externalId}`;
  const sourceRef = await ctx.prisma.unitExternalRef.upsert({
    where: {
      sourceSiteEntityUnitId_externalKind_externalId: {
        sourceSiteEntityUnitId: qidianEntityUnitId,
        externalKind: "book",
        externalId,
      },
    },
    create: {
      unitId: book.id,
      sourceSiteEntityUnitId: qidianEntityUnitId,
      externalKind: "book",
      externalId,
      canonicalUrl,
      originalUrl: `${canonicalUrl}?from=seed`,
    },
    update: {
      unitId: book.id,
      canonicalUrl,
      originalUrl: `${canonicalUrl}?from=seed`,
    },
  });

  await ctx.prisma.creditAttributionEvidence.create({
    data: {
      unitId: book.id,
      entityId: publisher.unitId,
      role: "publisher",
      sourceRefId: sourceRef.id,
      claimPath: "$.bookInfo.publisher",
      observedUrl: `${canonicalUrl}?from=seed`,
      confidence: 0.9,
    },
  });

  await ctx.sync.content(book.id);
  console.log("[Seed]   Qidian SourceSite + attribution evidence fixture");
}
