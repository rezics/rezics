import { randomUUID } from "node:crypto";
import { DEFAULT_LANGUAGE, LANGUAGES } from "@rezics/contract";
import { eq } from "drizzle-orm";
import {
  CreditAttribution,
  CreditAttributionEvidence,
  Entity,
  Unit,
  UnitExternalLink,
  UnitTranslation,
} from "../schema";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { SeedCtx } from "./strategy.js";
import type { CreatedEntity, CreatedUnit } from "./types.js";
import { withUpdatedAt } from "./utils.js";

async function ensureSourceEntity(
  ctx: SeedCtx,
  input: {
    slug: string;
    zhHantTitle: string;
    enTitle: string;
    zhHantSummary: string;
    enSummary: string;
  },
) {
  const [existing] = await ctx.db
    .select({ unitId: Unit.id })
    .from(Unit)
    .where(eq(Unit.slug, input.slug))
    .limit(1);
  if (existing) return existing.unitId;

  const unitId = randomUUID();
  await ctx.db.insert(Unit).values(
    withUpdatedAt({
      id: unitId,
      type: UnitType.ENTITY,
      slug: input.slug,
      slugScope: ctx.slugScopes.entity,
      status: UnitStatus.PUBLISHED,
      defaultLanguage: DEFAULT_LANGUAGE,
    }),
  );
  await ctx.db.insert(UnitTranslation).values([
    withUpdatedAt({
      unitId,
      language: LANGUAGES.ZH_HANT,
      title: input.zhHantTitle,
      summary: input.zhHantSummary,
    }),
    withUpdatedAt({
      unitId,
      language: LANGUAGES.EN,
      title: input.enTitle,
      summary: input.enSummary,
    }),
  ]);
  await ctx.db.insert(Entity).values(
    withUpdatedAt({
      unitId,
      kind: "organization",
      verified: true,
      eligibleCreditRoles: ["publisher", "distributor"],
      eligibleSubjectRoles: [],
    }),
  );
  await ctx.sync.entity(unitId);
  return unitId;
}

export async function ensureQidianSourceEntity(ctx: SeedCtx) {
  return ensureSourceEntity(ctx, {
    slug: "qidian",
    zhHantTitle: "起點中文網",
    enTitle: "Qidian",
    zhHantSummary: "外部來源實體，用於示範作品外部鏈接。",
    enSummary: "Source Entity for external link fixtures.",
  });
}

export async function ensureFandomSourceEntity(ctx: SeedCtx) {
  return ensureSourceEntity(ctx, {
    slug: "fandom",
    zhHantTitle: "Fandom",
    enTitle: "Fandom",
    zhHantSummary: "外部來源實體，用於示範 wiki 外部鏈接。",
    enSummary: "Source Entity for wiki external link fixtures.",
  });
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

export async function seedExternalLinkFixtures(
  ctx: SeedCtx,
  books: CreatedUnit[],
  organizations: CreatedEntity[],
): Promise<void> {
  const book = books[0];
  const publisher = organizations[0];
  if (!book || !publisher) {
    console.log(
      "[Seed] External link fixture skipped: missing book or publisher",
    );
    return;
  }

  const qidianSourceEntityUnitId = await ensureQidianSourceEntity(ctx);
  await findOrCreatePublisherCredit(ctx, book, publisher);

  const url = "https://book.qidian.com/info/123456?from=seed";
  const [sourceLink] = await ctx.db
    .insert(UnitExternalLink)
    .values(
      withUpdatedAt({
        unitId: book.id,
        sourceEntityUnitId: qidianSourceEntityUnitId,
        url,
        normalizedUrl: "https://book.qidian.com/info/123456?from=seed",
        normalizedUrlHash:
          "c7dce3f01ca91e295b55222954f0f38ee026b1d3126b8d652c72004bd3b71fab",
        role: "source",
      }),
    )
    .onConflictDoNothing()
    .returning({ id: UnitExternalLink.id });
  if (!sourceLink) return;

  await ctx.db.insert(CreditAttributionEvidence).values(
    withUpdatedAt({
      unitId: book.id,
      entityId: publisher.unitId,
      role: "publisher",
      sourceExternalLinkId: sourceLink.id,
      claimPath: "$.bookInfo.publisher",
      observedUrl: url,
      confidence: 0.9,
    }),
  );

  await ctx.sync.content(book.id);
  console.log("[Seed]   Qidian external link + attribution evidence fixture");
}
