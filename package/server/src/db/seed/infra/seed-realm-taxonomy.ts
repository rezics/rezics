import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  markdownContentDoc,
} from "@rezics/contract";
import { and, eq, sql } from "drizzle-orm";
import type { ServerDb } from "../../client";
import {
  ContentTranslation,
  Post,
  Realm,
  RealmMember,
  RealmTagApplication,
  RealmTagApplicationVote,
  RealmTagContext,
  TagVote,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
} from "../../schema";
import type { SlugScopesMap } from "./seed-slug-scopes";

export interface RealmTaxonomySeedResult {
  communityRealmId: string;
  sharedTagIds: string[];
}

type RealmTaxonomySeedDb = Pick<
  ServerDb,
  "insert" | "select" | "transaction" | "update"
>;
type RealmTaxonomyWriteDb = Pick<ServerDb, "insert">;

async function findUnitByScopedSlug(
  db: RealmTaxonomySeedDb,
  slugScope: string,
  slug: string,
): Promise<{ id: string; type: string } | null> {
  return (
    (
      await db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(eq(Unit.slugScope, slugScope), eq(Unit.slug, slug)))
        .limit(1)
    )[0] ?? null
  );
}

async function syncUnitTranslations(
  db: RealmTaxonomyWriteDb,
  unitId: string,
  translations: Array<{
    language: string;
    title: string;
    description?: unknown;
  }>,
): Promise<void> {
  for (const [sortOrder, translation] of translations.entries()) {
    await db
      .insert(UnitTranslation)
      .values({
        unitId,
        language: translation.language,
        title: translation.title,
        description: translation.description,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UnitTranslation.unitId, UnitTranslation.language],
        set: {
          title: translation.title,
          description: translation.description,
          updatedAt: new Date(),
        },
      });
    await db
      .insert(UnitSupportLanguage)
      .values({
        unitId,
        language: translation.language,
        isPrimary: translation.language === DEFAULT_LANGUAGE,
        sortOrder,
      })
      .onConflictDoUpdate({
        target: [UnitSupportLanguage.unitId, UnitSupportLanguage.language],
        set: {
          isPrimary: translation.language === DEFAULT_LANGUAGE,
          sortOrder,
        },
      });
  }
}

async function ensureGlobalTag(
  db: RealmTaxonomySeedDb,
  tagScope: string,
  slug: string,
  title: string,
): Promise<string> {
  const existing = await findUnitByScopedSlug(db, tagScope, slug);
  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(`[Seed] Slug "${slug}" under tag scope is not a TAG.`);
    }
    await syncUnitTranslations(db, existing.id, [
      { language: DEFAULT_LANGUAGE, title },
      { language: FALLBACK_LANGUAGE, title },
    ]);
    return existing.id;
  }

  return db.transaction(async (tx) => {
    const now = new Date();
    const [tag] = await tx
      .insert(Unit)
      .values({
        type: "TAG",
        slug,
        slugScope: tagScope,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        isLanguageNeutral: true,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: now,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!tag) throw new Error(`Failed to create tag Unit "${slug}"`);

    for (const [sortOrder, language] of [
      DEFAULT_LANGUAGE,
      FALLBACK_LANGUAGE,
    ].entries()) {
      await tx.insert(UnitTranslation).values({
        unitId: tag.id,
        language,
        title,
        updatedAt: now,
      });
      await tx.insert(UnitSupportLanguage).values({
        unitId: tag.id,
        language,
        isPrimary: language === DEFAULT_LANGUAGE,
        sortOrder,
      });
    }

    return tag.id;
  });
}

/**
 * Ensure a POST unit owned by `userId`. POST units have no slug in the new
 * substrate (POST is not slug-bearing); existence is determined by an
 * idempotency tuple of (owner, kind, content translation main source) seeded
 * only at infra time.
 */
async function ensurePostUnit(
  db: RealmTaxonomySeedDb,
  userId: string,
  title: string,
  body: string,
): Promise<string> {
  const [existing] = await db
    .select({ id: Unit.id })
    .from(Unit)
    .innerJoin(Post, eq(Post.unitId, Unit.id))
    .innerJoin(ContentTranslation, eq(ContentTranslation.unitId, Unit.id))
    .where(
      and(
        eq(Unit.type, "POST"),
        eq(Unit.userId, userId),
        eq(Post.kind, "POST"),
        eq(ContentTranslation.language, DEFAULT_LANGUAGE),
        sql`${ContentTranslation.content}->'main'->>'source' = ${body}`,
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  return db.transaction(async (tx) => {
    const now = new Date();
    const [unit] = await tx
      .insert(Unit)
      .values({
        type: "POST",
        userId,
        // POSTs do not carry slugs; pin slugScope to the owner so the row is
        // owner-scoped if a slug is ever assigned in the future.
        slugScope: userId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: now,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!unit) throw new Error(`Failed to create post Unit "${title}"`);

    await tx.insert(UnitTranslation).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      title,
      updatedAt: now,
    });
    await tx.insert(UnitSupportLanguage).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      isPrimary: true,
      sortOrder: 0,
    });
    await tx.insert(Post).values({
      unitId: unit.id,
      authorUserId: userId,
      kind: "POST",
      updatedAt: now,
    });
    await tx.insert(ContentTranslation).values({
      unitId: unit.id,
      language: DEFAULT_LANGUAGE,
      content: markdownContentDoc(body),
      status: "PUBLISHED",
      authorUserId: userId,
      provenance: { importedFrom: "infra-realm-taxonomy-seed" },
      updatedAt: now,
    });

    return unit.id;
  });
}

async function ensureCommunityRealm(
  db: RealmTaxonomySeedDb,
  realmScope: string,
  rootUserId: string,
  slowBurnTagId: string,
  hardScifiTagId: string,
): Promise<string> {
  const slug = "seed-scifi-readers";
  const existing = await findUnitByScopedSlug(db, realmScope, slug);
  if (existing) {
    if (existing.type !== "REALM") {
      throw new Error(
        `[Seed] Slug "${slug}" under realm scope is not a REALM.`,
      );
    }
    return existing.id;
  }

  const ruleId = await ensurePostUnit(
    db,
    rootUserId,
    "Sci-fi Readers Rules",
    "Discuss speculative fiction generously and mark spoilers clearly.",
  );
  const aboutId = await ensurePostUnit(
    db,
    rootUserId,
    "About Sci-fi Readers",
    "A community space for hard sci-fi, space opera, and slow-burn discovery.",
  );

  return db.transaction(async (tx) => {
    const now = new Date();
    const [realm] = await tx
      .insert(Unit)
      .values({
        type: "REALM",
        slug,
        slugScope: realmScope,
        userId: rootUserId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: now,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!realm) throw new Error(`Failed to create realm Unit "${slug}"`);

    for (const translation of [
      {
        language: DEFAULT_LANGUAGE,
        title: "Sci-fi Readers",
        description: markdownContentDoc(
          "Community discussion and curation for science fiction.",
        ),
      },
      {
        language: FALLBACK_LANGUAGE,
        title: "Sci-fi Readers",
        description: markdownContentDoc(
          "Community discussion and curation for science fiction.",
        ),
      },
    ]) {
      await tx.insert(UnitTranslation).values({
        unitId: realm.id,
        language: translation.language,
        title: translation.title,
        description: translation.description,
        updatedAt: now,
      });
      await tx.insert(UnitSupportLanguage).values({
        unitId: realm.id,
        language: translation.language,
        isPrimary: translation.language === DEFAULT_LANGUAGE,
        sortOrder: translation.language === DEFAULT_LANGUAGE ? 0 : 1,
      });
    }

    await tx.insert(Realm).values({
      unitId: realm.id,
      isPublic: true,
      isOfficial: false,
      memberCount: 1,
      extra: {
        rule: ruleId,
        about: aboutId,
        pinboard: [aboutId, ruleId],
        tagTree: [
          { tagUnitId: hardScifiTagId, title: "Hard sci-fi" },
          { tagUnitId: slowBurnTagId, title: "Slow burn" },
        ],
      },
      updatedAt: now,
    });
    await tx.insert(RealmMember).values({
      realmUnitId: realm.id,
      userId: rootUserId,
      roleKey: "owner",
      updatedAt: now,
    });

    return realm.id;
  });
}

async function ensureRealmTagApplication(
  db: RealmTaxonomySeedDb,
  userId: string,
  realmUnitId: string,
  tagUnitId: string,
  unitId: string,
): Promise<void> {
  await db
    .insert(RealmTagApplication)
    .values({
      realmUnitId,
      tagUnitId,
      unitId,
      score: 1,
      voteCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [
        RealmTagApplication.realmUnitId,
        RealmTagApplication.tagUnitId,
        RealmTagApplication.unitId,
      ],
    });
  await db
    .insert(RealmTagApplicationVote)
    .values({ realmUnitId, tagUnitId, unitId, userId, value: 1 })
    .onConflictDoUpdate({
      target: [
        RealmTagApplicationVote.realmUnitId,
        RealmTagApplicationVote.tagUnitId,
        RealmTagApplicationVote.unitId,
        RealmTagApplicationVote.userId,
      ],
      set: { value: 1 },
    });
  await db
    .insert(TagVote)
    .values({ userId, unitId, tagUnitId, value: 1 })
    .onConflictDoNothing({
      target: [TagVote.userId, TagVote.unitId, TagVote.tagUnitId],
    });
  await db
    .insert(UnitTag)
    .values({
      unitId,
      tagUnitId,
      score: 1,
      voteCount: 1,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [UnitTag.unitId, UnitTag.tagUnitId],
      set: { score: 1, voteCount: 1, updatedAt: new Date() },
    });
}

/**
 * Seed realm taxonomy examples that protect the product model:
 * realms are community spaces, global TAG Units are shared vocabulary, and
 * RealmTagApplication remains independent from UnitRealm feed membership.
 */
export async function seedRealmTaxonomy(
  db: RealmTaxonomySeedDb,
  rootUserId: string,
  defaultRealmId: string,
  slugScopes: SlugScopesMap,
): Promise<RealmTaxonomySeedResult> {
  console.log("[Seed] Seeding realm taxonomy examples...");

  const tagScope = slugScopes.tag;
  const realmScope = slugScopes.realm;

  const slowBurnTagId = await ensureGlobalTag(
    db,
    tagScope,
    "seed-tag-slow-burn",
    "Slow burn",
  );
  const hardScifiTagId = await ensureGlobalTag(
    db,
    tagScope,
    "seed-tag-hard-scifi",
    "Hard sci-fi",
  );

  const communityRealmId = await ensureCommunityRealm(
    db,
    realmScope,
    rootUserId,
    slowBurnTagId,
    hardScifiTagId,
  );

  const contextUnitId = await ensurePostUnit(
    db,
    rootUserId,
    "Slow burn in Sci-fi Readers",
    "In this realm, slow burn means patient speculative payoff, not simply low action.",
  );

  await db
    .insert(RealmTagContext)
    .values({
      realmUnitId: communityRealmId,
      tagUnitId: slowBurnTagId,
      contextUnitId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [RealmTagContext.realmUnitId, RealmTagContext.tagUnitId],
      set: { contextUnitId, updatedAt: new Date() },
    });

  await db
    .insert(RealmTagContext)
    .values({
      realmUnitId: defaultRealmId,
      tagUnitId: slowBurnTagId,
      updatedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [RealmTagContext.realmUnitId, RealmTagContext.tagUnitId],
    });

  const feedTargetId = await ensurePostUnit(
    db,
    rootUserId,
    "A patient orbital mystery",
    "A feed example for realm-tag classification.",
  );
  const outsideTargetId = await ensurePostUnit(
    db,
    rootUserId,
    "An external hard-sci-fi reference",
    "A non-feed target that the realm can still classify.",
  );

  await db
    .insert(UnitRealm)
    .values({ realmUnitId: communityRealmId, unitId: feedTargetId })
    .onConflictDoNothing({
      target: [UnitRealm.realmUnitId, UnitRealm.unitId],
    });

  await ensureRealmTagApplication(
    db,
    rootUserId,
    communityRealmId,
    slowBurnTagId,
    feedTargetId,
  );
  await ensureRealmTagApplication(
    db,
    rootUserId,
    communityRealmId,
    hardScifiTagId,
    outsideTargetId,
  );
  await ensureRealmTagApplication(
    db,
    rootUserId,
    defaultRealmId,
    slowBurnTagId,
    outsideTargetId,
  );

  return {
    communityRealmId,
    sharedTagIds: [slowBurnTagId, hardScifiTagId],
  };
}
