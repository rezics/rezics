import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  markdownContentDoc,
} from "@rezics/contract";
import type { PrismaClient } from "../../generated/client.js";
import type { SlugScopesMap } from "./seed-slug-scopes";

export interface RealmTaxonomySeedResult {
  communityRealmId: string;
  sharedTagIds: string[];
}

async function ensureGlobalTag(
  prisma: PrismaClient,
  tagScope: string,
  slug: string,
  title: string,
): Promise<string> {
  const existing = await prisma.unit.findUnique({
    where: { slugScope_slug: { slugScope: tagScope, slug } },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(`[Seed] Slug "${slug}" under tag scope is not a TAG.`);
    }
    return existing.id;
  }

  const tag = await prisma.unit.create({
    data: {
      type: "TAG",
      slug,
      slugScope: tagScope,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isLanguageNeutral: true,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: [
          { language: DEFAULT_LANGUAGE, title },
          { language: FALLBACK_LANGUAGE, title },
        ],
      },
      supportLanguages: {
        create: [
          { language: DEFAULT_LANGUAGE, isPrimary: true, sortOrder: 0 },
          { language: FALLBACK_LANGUAGE, isPrimary: false, sortOrder: 1 },
        ],
      },
    },
    select: { id: true },
  });
  return tag.id;
}

/**
 * Ensure a POST unit owned by `userId`. POST units have no slug in the new
 * substrate (POST is not slug-bearing); existence is determined by an
 * idempotency tuple of (owner, kind, content translation main source) seeded
 * only at infra time.
 */
async function ensurePostUnit(
  prisma: PrismaClient,
  userId: string,
  title: string,
  body: string,
): Promise<string> {
  const existing = await prisma.unit.findFirst({
    where: {
      type: "POST",
      userId,
      post: { is: { kind: "POST" } },
      contentTranslations: {
        some: {
          language: DEFAULT_LANGUAGE,
          content: { path: ["main", "source"], equals: body },
        },
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const unit = await prisma.unit.create({
    data: {
      type: "POST",
      userId,
      // POSTs do not carry slugs; pin slugScope to the owner so the row is
      // owner-scoped if a slug is ever assigned in the future.
      slugScope: userId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: [{ language: DEFAULT_LANGUAGE, title }],
      },
      supportLanguages: {
        create: [{ language: DEFAULT_LANGUAGE, isPrimary: true, sortOrder: 0 }],
      },
      post: {
        create: {
          authorUserId: userId,
          kind: "POST",
        },
      },
      contentTranslations: {
        create: {
          language: DEFAULT_LANGUAGE,
          content: markdownContentDoc(body) as never,
          status: "PUBLISHED",
          authorUserId: userId,
          provenance: { importedFrom: "infra-realm-taxonomy-seed" },
        },
      },
    },
    select: { id: true },
  });
  return unit.id;
}

async function ensureCommunityRealm(
  prisma: PrismaClient,
  realmScope: string,
  rootUserId: string,
  slowBurnTagId: string,
  hardScifiTagId: string,
): Promise<string> {
  const slug = "seed-scifi-readers";
  const existing = await prisma.unit.findUnique({
    where: { slugScope_slug: { slugScope: realmScope, slug } },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type !== "REALM") {
      throw new Error(
        `[Seed] Slug "${slug}" under realm scope is not a REALM.`,
      );
    }
    return existing.id;
  }

  const ruleId = await ensurePostUnit(
    prisma,
    rootUserId,
    "Sci-fi Readers Rules",
    "Discuss speculative fiction generously and mark spoilers clearly.",
  );
  const aboutId = await ensurePostUnit(
    prisma,
    rootUserId,
    "About Sci-fi Readers",
    "A community space for hard sci-fi, space opera, and slow-burn discovery.",
  );

  const realm = await prisma.unit.create({
    data: {
      type: "REALM",
      slug,
      slugScope: realmScope,
      userId: rootUserId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: new Date(),
      translations: {
        create: [
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
        ],
      },
      supportLanguages: {
        create: [
          { language: DEFAULT_LANGUAGE, isPrimary: true, sortOrder: 0 },
          { language: FALLBACK_LANGUAGE, isPrimary: false, sortOrder: 1 },
        ],
      },
      realm: {
        create: {
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
        },
      },
    },
    select: { id: true },
  });

  await prisma.realmMember.create({
    data: {
      realmUnitId: realm.id,
      userId: rootUserId,
      roleKey: "owner",
    },
  });

  return realm.id;
}

async function ensureRealmTagApplication(
  prisma: PrismaClient,
  userId: string,
  realmUnitId: string,
  tagUnitId: string,
  unitId: string,
): Promise<void> {
  await prisma.realmTagApplication.upsert({
    where: { realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId } },
    update: {},
    create: { realmUnitId, tagUnitId, unitId, score: 1, voteCount: 1 },
  });
  await prisma.realmTagApplicationVote.upsert({
    where: {
      realmUnitId_tagUnitId_unitId_userId: {
        realmUnitId,
        tagUnitId,
        unitId,
        userId,
      },
    },
    update: { value: 1 },
    create: { realmUnitId, tagUnitId, unitId, userId, value: 1 },
  });
  await prisma.tagVote.upsert({
    where: { userId_unitId_tagUnitId: { userId, unitId, tagUnitId } },
    update: {},
    create: { userId, unitId, tagUnitId, value: 1 },
  });
  await prisma.unitTag.upsert({
    where: { unitId_tagUnitId: { unitId, tagUnitId } },
    update: { score: 1, voteCount: 1 },
    create: { unitId, tagUnitId, score: 1, voteCount: 1 },
  });
}

/**
 * Seed realm taxonomy examples that protect the product model:
 * realms are community spaces, global TAG Units are shared vocabulary, and
 * RealmTagApplication remains independent from UnitRealm feed membership.
 */
export async function seedRealmTaxonomy(
  prisma: PrismaClient,
  rootUserId: string,
  defaultRealmId: string,
  slugScopes: SlugScopesMap,
): Promise<RealmTaxonomySeedResult> {
  console.log("[Seed] Seeding realm taxonomy examples...");

  const tagScope = slugScopes.tag;
  const realmScope = slugScopes.realm;

  const slowBurnTagId = await ensureGlobalTag(
    prisma,
    tagScope,
    "seed-tag-slow-burn",
    "Slow burn",
  );
  const hardScifiTagId = await ensureGlobalTag(
    prisma,
    tagScope,
    "seed-tag-hard-scifi",
    "Hard sci-fi",
  );

  const communityRealmId = await ensureCommunityRealm(
    prisma,
    realmScope,
    rootUserId,
    slowBurnTagId,
    hardScifiTagId,
  );

  const contextUnitId = await ensurePostUnit(
    prisma,
    rootUserId,
    "Slow burn in Sci-fi Readers",
    "In this realm, slow burn means patient speculative payoff, not simply low action.",
  );

  await prisma.realmTagContext.upsert({
    where: {
      realmUnitId_tagUnitId: {
        realmUnitId: communityRealmId,
        tagUnitId: slowBurnTagId,
      },
    },
    update: { contextUnitId },
    create: {
      realmUnitId: communityRealmId,
      tagUnitId: slowBurnTagId,
      contextUnitId,
    },
  });

  await prisma.realmTagContext.upsert({
    where: {
      realmUnitId_tagUnitId: {
        realmUnitId: defaultRealmId,
        tagUnitId: slowBurnTagId,
      },
    },
    update: {},
    create: {
      realmUnitId: defaultRealmId,
      tagUnitId: slowBurnTagId,
    },
  });

  const feedTargetId = await ensurePostUnit(
    prisma,
    rootUserId,
    "A patient orbital mystery",
    "A feed example for realm-tag classification.",
  );
  const outsideTargetId = await ensurePostUnit(
    prisma,
    rootUserId,
    "An external hard-sci-fi reference",
    "A non-feed target that the realm can still classify.",
  );

  await prisma.unitRealm.upsert({
    where: {
      realmUnitId_unitId: {
        realmUnitId: communityRealmId,
        unitId: feedTargetId,
      },
    },
    update: {},
    create: { realmUnitId: communityRealmId, unitId: feedTargetId },
  });

  await ensureRealmTagApplication(
    prisma,
    rootUserId,
    communityRealmId,
    slowBurnTagId,
    feedTargetId,
  );
  await ensureRealmTagApplication(
    prisma,
    rootUserId,
    communityRealmId,
    hardScifiTagId,
    outsideTargetId,
  );
  await ensureRealmTagApplication(
    prisma,
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
