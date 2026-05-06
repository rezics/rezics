import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";

export interface RealmTaxonomySeedResult {
  communityRealmId: string;
  sharedTagIds: string[];
}

async function ensureGlobalTag(
  prisma: PrismaClient,
  slug: string,
  title: string,
): Promise<string> {
  const existing = await prisma.unit.findUnique({
    where: { slug },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type !== "TAG") {
      throw new Error(`[Seed] Slug "${slug}" is not a TAG.`);
    }
    return existing.id;
  }

  const tag = await prisma.unit.create({
    data: {
      type: "TAG",
      slug,
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

async function ensurePostUnit(
  prisma: PrismaClient,
  slug: string,
  userId: string,
  title: string,
  body: string,
): Promise<string> {
  const existing = await prisma.unit.findUnique({
    where: { slug },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type !== "POST") {
      throw new Error(`[Seed] Slug "${slug}" is not a POST.`);
    }
    return existing.id;
  }

  const unit = await prisma.unit.create({
    data: {
      type: "POST",
      slug,
      userId,
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
          body,
        },
      },
    },
    select: { id: true },
  });
  return unit.id;
}

async function ensureCommunityRealm(
  prisma: PrismaClient,
  rootUserId: string,
  slowBurnTagId: string,
  hardScifiTagId: string,
): Promise<string> {
  const slug = "seed-scifi-readers";
  const existing = await prisma.unit.findUnique({
    where: { slug },
    select: { id: true, type: true },
  });
  if (existing) {
    if (existing.type !== "REALM") {
      throw new Error(`[Seed] Slug "${slug}" is not a REALM.`);
    }
    return existing.id;
  }

  const ruleId = await ensurePostUnit(
    prisma,
    "seed-scifi-readers-rules",
    rootUserId,
    "Sci-fi Readers Rules",
    "Discuss speculative fiction generously and mark spoilers clearly.",
  );
  const aboutId = await ensurePostUnit(
    prisma,
    "seed-scifi-readers-about",
    rootUserId,
    "About Sci-fi Readers",
    "A community space for hard sci-fi, space opera, and slow-burn discovery.",
  );

  const realm = await prisma.unit.create({
    data: {
      type: "REALM",
      slug,
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
            description: "Community discussion and curation for science fiction.",
          },
          {
            language: FALLBACK_LANGUAGE,
            title: "Sci-fi Readers",
            description: "Community discussion and curation for science fiction.",
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
  await prisma.realmTagUnit.upsert({
    where: { realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId } },
    update: {},
    create: { realmUnitId, tagUnitId, unitId, score: 1, voteCount: 1 },
  });
  await prisma.realmTagVote.upsert({
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
 * RealmTagUnit remains independent from RealmUnit feed membership.
 */
export async function seedRealmTaxonomy(
  prisma: PrismaClient,
  rootUserId: string,
  defaultRealmId: string,
): Promise<RealmTaxonomySeedResult> {
  console.log("[Seed] Seeding realm taxonomy examples...");

  const slowBurnTagId = await ensureGlobalTag(
    prisma,
    "seed-tag-slow-burn",
    "Slow burn",
  );
  const hardScifiTagId = await ensureGlobalTag(
    prisma,
    "seed-tag-hard-scifi",
    "Hard sci-fi",
  );

  const communityRealmId = await ensureCommunityRealm(
    prisma,
    rootUserId,
    slowBurnTagId,
    hardScifiTagId,
  );

  const contextUnitId = await ensurePostUnit(
    prisma,
    "seed-scifi-slow-burn-context",
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
    "seed-scifi-feed-target",
    rootUserId,
    "A patient orbital mystery",
    "A feed example for realm-tag classification.",
  );
  const outsideTargetId = await ensurePostUnit(
    prisma,
    "seed-scifi-outside-target",
    rootUserId,
    "An external hard-sci-fi reference",
    "A non-feed target that the realm can still classify.",
  );

  await prisma.realmUnit.upsert({
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
