import { DEFAULT_LANGUAGE } from "../../../package/contract/src/language";
import {
  SEED_TAG_NAMES,
  SEED_TAG_SCORE,
  SEED_TAG_TITLES,
  type SeedTagName,
} from "../../../package/contract/src/seed-tags";
import type { ServerPrismaClient } from "./create-prisma";

/**
 * Seed content-type tags with DB-generated UUIDv7 IDs.
 * Idempotent: looks up existing tags by English title + type TAG, skips if found.
 * Returns a name→ID map for EchoKV registration.
 */
export async function seedContentTypeTags(
  prisma: ServerPrismaClient,
): Promise<Record<SeedTagName, string>> {
  console.log("[Seed] Seeding content-type tags...");

  const tagMap = {} as Record<SeedTagName, string>;

  for (const name of SEED_TAG_NAMES) {
    const title = SEED_TAG_TITLES[name];

    // Look up existing tag by English title + type TAG
    const existing = await prisma.unit.findFirst({
      where: {
        type: "TAG",
        translations: {
          some: { language: DEFAULT_LANGUAGE, title },
        },
      },
      select: { id: true },
    });

    if (existing) {
      console.log(
        `[Seed]   Content-type tag "${name}" already exists, skipping.`,
      );
      tagMap[name] = existing.id;
    } else {
      const unit = await prisma.unit.create({
        data: {
          type: "TAG",
          status: "PUBLISHED",
          visibility: "PUBLIC",
          isLanguageNeutral: true,
          publishedAt: new Date(),
          translations: {
            create: {
              language: DEFAULT_LANGUAGE,
              title,
            },
          },
        },
        select: { id: true },
      });
      tagMap[name] = unit.id;
      console.log(`[Seed]   Created content-type tag "${name}" (${unit.id})`);
    }

    // Self-tag score boost
    await prisma.unitTag.upsert({
      where: {
        unitId_tagUnitId: { unitId: tagMap[name], tagUnitId: tagMap[name] },
      },
      update: { score: SEED_TAG_SCORE },
      create: {
        unitId: tagMap[name],
        tagUnitId: tagMap[name],
        score: SEED_TAG_SCORE,
        voteCount: 0,
      },
    });
  }

  return tagMap;
}

/**
 * Seed the default official realm owned by the root user.
 * Idempotent: skips if an official realm already exists.
 * Returns the realm unit ID.
 */
export async function seedDefaultRealm(
  prisma: ServerPrismaClient,
  rootUserId: string,
): Promise<string> {
  console.log("[Seed] Seeding default realm...");

  const existing = await prisma.realm.findFirst({
    where: { isOfficial: true },
    select: { unitId: true },
  });

  if (existing) {
    console.log(
      `[Seed]   Official realm already exists (${existing.unitId}), skipping.`,
    );
    return existing.unitId;
  }

  const unit = await prisma.unit.create({
    data: {
      type: "REALM",
      userId: rootUserId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date(),
      translations: {
        create: {
          language: DEFAULT_LANGUAGE,
          title: "rezics",
        },
      },
      realm: {
        create: {
          isPublic: true,
          isOfficial: true,
          memberCount: 1,
        },
      },
    },
    select: { id: true },
  });

  // Add root user as owner member
  await prisma.realmMember.create({
    data: {
      realmUnitId: unit.id,
      userId: rootUserId,
      roleKey: "owner",
    },
  });

  console.log(`[Seed]   Created default realm (${unit.id})`);
  return unit.id;
}

/**
 * Upsert infrastructure IDs into EchoKV.
 */
export async function seedInfraEchoKV(
  prisma: ServerPrismaClient,
  tagMap: Record<SeedTagName, string>,
  realmId: string,
): Promise<void> {
  console.log("[Seed] Writing infrastructure EchoKV entries...");

  await prisma.echoKV.upsert({
    where: { key: "infra:seed_tags" },
    create: {
      key: "infra:seed_tags",
      value: tagMap,
    },
    update: {
      value: tagMap,
    },
  });

  await prisma.echoKV.upsert({
    where: { key: "infra:default_realm" },
    create: {
      key: "infra:default_realm",
      value: { id: realmId },
    },
    update: {
      value: { id: realmId },
    },
  });

  console.log("[Seed]   infra:seed_tags and infra:default_realm written.");
}
