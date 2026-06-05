import { randomUUID } from "node:crypto";
import { DEFAULT_LANGUAGE, LANGUAGES } from "@rezics/contract";
import { eq } from "drizzle-orm";
import { UnitStatus, UnitType } from "./storage-values.js";
import {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  SourceSite,
  Unit,
  UnitExternalRef,
  UnitTranslation,
} from "../schema";
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
  const [existing] = await ctx.db
    .select({ entityUnitId: SourceSite.entityUnitId })
    .from(SourceSite)
    .where(eq(SourceSite.key, "qidian"))
    .limit(1);
  if (existing) return existing.entityUnitId;

  const sourceUnit = { id: randomUUID() };
  await ctx.db.insert(Unit).values({
    id: sourceUnit.id,
    type: UnitType.ENTITY,
    slug: "qidian",
    slugScope: ctx.slugScopes.entity,
    status: UnitStatus.PUBLISHED,
    defaultLanguage: DEFAULT_LANGUAGE,
  });
  await ctx.db.insert(UnitTranslation).values([
    {
      unitId: sourceUnit.id,
      language: LANGUAGES.ZH_HANT,
      title: "起點中文網",
      summary: "來源站點實體，用於示範外部來源規則。",
    },
    {
      unitId: sourceUnit.id,
      language: LANGUAGES.EN,
      title: "Qidian",
      summary: "Source site Entity for external reference fixtures.",
    },
  ]);
  await ctx.db.insert(Entity).values({
    unitId: sourceUnit.id,
    kind: "organization",
    verified: true,
    eligibleCreditRoles: ["publisher", "distributor"],
    eligibleSubjectRoles: [],
  });
  await ctx.db.insert(SourceSite).values({
    entityUnitId: sourceUnit.id,
    key: "qidian",
    crawlSupport: "supported",
    crawlEnabled: false,
    crawlerAdapterKey: "qidian",
    refRules: QIDIAN_REF_RULES as any,
  });

  await ctx.sync.entity(sourceUnit.id);
  return sourceUnit.id;
}

async function findOrCreatePublisherCredit(
  ctx: SeedCtx,
  book: CreatedUnit,
  publisher: CreatedEntity,
) {
  await ctx.db
    .insert(CreditAttribution)
    .values({
      unitId: book.id,
      entityId: publisher.unitId,
      role: "publisher",
      sortOrder: 0,
    })
    .onConflictDoNothing();
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
  await findOrCreatePublisherCredit(ctx, book, publisher);

  const externalId = "123456";
  const canonicalUrl = `https://book.qidian.com/info/${externalId}`;
  const [sourceRef] = await ctx.db
    .insert(UnitExternalRef)
    .values({
      unitId: book.id,
      sourceSiteEntityUnitId: qidianEntityUnitId,
      externalKind: "book",
      externalId,
      canonicalUrl,
      originalUrl: `${canonicalUrl}?from=seed`,
    })
    .onConflictDoUpdate({
      target: [
        UnitExternalRef.sourceSiteEntityUnitId,
        UnitExternalRef.externalKind,
        UnitExternalRef.externalId,
      ],
      set: {
        unitId: book.id,
        canonicalUrl,
        originalUrl: `${canonicalUrl}?from=seed`,
      },
    })
    .returning({ id: UnitExternalRef.id });
  if (!sourceRef) throw new Error("Failed to upsert Qidian external ref.");

  await ctx.db.insert(CreditAttributionEvidence).values({
    unitId: book.id,
    entityId: publisher.unitId,
    role: "publisher",
    sourceRefId: sourceRef.id,
    claimPath: "$.bookInfo.publisher",
    observedUrl: `${canonicalUrl}?from=seed`,
    confidence: 0.9,
  });

  await ctx.sync.content(book.id);
  console.log("[Seed]   Qidian SourceSite + attribution evidence fixture");
}
