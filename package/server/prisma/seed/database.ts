import type { PrismaClient } from "#/prisma/generated/client.js";

// ── Infrastructure Snapshot ────────────────────────────

/**
 * Permission role values assigned by seed CLI.
 * Used to identify the 4 seed users in the server DB
 * (which lacks email — permission is the stable identifier).
 */
const SEED_PERMISSION_ROLES = [
  { role: ["ROOT"] },
  { role: ["ADMIN"] },
  { role: ["USER"] },
  { role: ["BLOCKED"] },
];

/** Shape of the infrastructure snapshot preserved across resets. */
export interface InfraSnapshot {
  users: Awaited<ReturnType<PrismaClient["user"]["findMany"]>>;
  units: Awaited<ReturnType<PrismaClient["unit"]["findMany"]>>;
  translations: Awaited<ReturnType<PrismaClient["unitTranslation"]["findMany"]>>;
  supportLanguages: Awaited<ReturnType<PrismaClient["unitSupportLanguage"]["findMany"]>>;
  unitTags: Awaited<ReturnType<PrismaClient["unitTag"]["findMany"]>>;
  realms: Awaited<ReturnType<PrismaClient["realm"]["findMany"]>>;
  realmMembers: Awaited<ReturnType<PrismaClient["realmMember"]["findMany"]>>;
  echoKV: Awaited<ReturnType<PrismaClient["echoKV"]["findMany"]>>;
}

/**
 * Snapshot seed CLIed infrastructure before a database reset.
 *
 * Captures:
 * - Seed users (identified by known permission role values)
 * - Content-type tags (type=TAG + isLanguageNeutral=true)
 * - Official realm (isOfficial=true)
 * - Associated UnitTranslations, UnitSupportLanguages, UnitTags
 * - RealmMember owner entry
 * - EchoKV entries with `infra:` prefix
 */
export async function snapshotInfrastructure(
  prisma: PrismaClient,
): Promise<InfraSnapshot> {
  console.log("[Snapshot] Capturing infrastructure...");

  // Seed users — identified by their permission role values set by seed CLI.
  // Server User table has no email field, so permission is the stable identifier.
  const users = await prisma.user.findMany({
    where: {
      OR: SEED_PERMISSION_ROLES.map((perm) => ({
        permission: { equals: perm },
      })),
    },
  });

  // Content-type tags: type=TAG + isLanguageNeutral=true
  const tagUnits = await prisma.unit.findMany({
    where: { type: "TAG", isLanguageNeutral: true },
  });

  // Official realm
  const officialRealm = await prisma.realm.findFirst({
    where: { isOfficial: true },
    select: { unitId: true },
  });
  const realmUnits = officialRealm
    ? await prisma.unit.findMany({ where: { id: officialRealm.unitId } })
    : [];

  // Combine all infra unit IDs
  const infraUnitIds = [
    ...tagUnits.map((u) => u.id),
    ...realmUnits.map((u) => u.id),
  ];

  // Translations, support languages, and self-tags for infra units
  const [translations, supportLanguages, unitTags] =
    infraUnitIds.length > 0
      ? await Promise.all([
          prisma.unitTranslation.findMany({
            where: { unitId: { in: infraUnitIds } },
          }),
          prisma.unitSupportLanguage.findMany({
            where: { unitId: { in: infraUnitIds } },
          }),
          prisma.unitTag.findMany({
            where: {
              unitId: { in: tagUnits.map((t) => t.id) },
              tagUnitId: { in: tagUnits.map((t) => t.id) },
            },
          }),
        ])
      : [[], [], []];

  // Realm extension + member
  const [realms, realmMembers] = officialRealm
    ? await Promise.all([
        prisma.realm.findMany({ where: { unitId: officialRealm.unitId } }),
        prisma.realmMember.findMany({
          where: { realmUnitId: officialRealm.unitId },
        }),
      ])
    : [[], []];

  // EchoKV infra entries
  const echoKV = await prisma.echoKV.findMany({
    where: { key: { startsWith: "infra:" } },
  });

  const allUnits = [...tagUnits, ...realmUnits];

  console.log(
    `[Snapshot] Captured: ${users.length} users, ${allUnits.length} units, ${translations.length} translations, ${echoKV.length} EchoKV entries`,
  );

  return {
    users,
    units: allUnits,
    translations,
    supportLanguages,
    unitTags,
    realms,
    realmMembers,
    echoKV,
  };
}

/**
 * Reset database by deleting all data in FK-safe order.
 * Groups at the same FK level are deleted in parallel.
 *
 * This wipes everything — run `seed:cross` again afterward
 * to re-establish infrastructure before mock seeding.
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  console.log("[Reset] Resetting database...");

  // Group 1: Leaf tables with no dependents
  await Promise.all([
    prisma.apiToken.deleteMany(),
    prisma.feedback.deleteMany(),
    prisma.tagVote.deleteMany(),
    prisma.shelfItemReview.deleteMany(),
    prisma.follow.deleteMany(),
    prisma.attribution.deleteMany(),
    prisma.scoreRealmField.deleteMany(),
    prisma.scoreAggregate.deleteMany(),
  ]);

  // Group 2: Aggregate / junction leaves
  await Promise.all([
    prisma.realmTagUnit.deleteMany(),
  ]);

  // Group 3: Realm + shelf + tag junction
  await Promise.all([
    prisma.realmUnit.deleteMany(),
    prisma.realmMember.deleteMany(),
    prisma.shelfItem.deleteMany(),
    prisma.unitTag.deleteMany(),
  ]);

  // Group 4: Extension children
  await Promise.all([
    prisma.bookIndex.deleteMany(),
    prisma.gamePlatform.deleteMany(),
  ]);

  // Group 5: Type extensions (1:1 with Unit)
  // Post must be deleted before ScoreEntry (FK constraint)
  await prisma.post.deleteMany();
  await prisma.scoreEntry.deleteMany();
  await Promise.all([
    prisma.shelf.deleteMany(),
    prisma.realm.deleteMany(),
    prisma.book.deleteMany(),
    prisma.game.deleteMany(),
    prisma.media.deleteMany(),
    prisma.link.deleteMany(),
  ]);

  // Group 6: Translation layer
  await Promise.all([
    prisma.unitTranslation.deleteMany(),
    prisma.unitSupportLanguage.deleteMany(),
  ]);

  // Group 7: Core
  await prisma.unit.deleteMany();

  // Group 8: Identity + entity
  await Promise.all([
    prisma.user.deleteMany(),
    prisma.entity.deleteMany(),
  ]);

  // Group 9: Platform misc
  await Promise.all([
    prisma.echoKV.deleteMany(),
    prisma.jwks.deleteMany(),
  ]);
  await prisma.jwtService.deleteMany();

  console.log("[Reset] Database reset complete.");
}

/**
 * Restore snapshotted infrastructure after a database reset.
 * Inserts data in FK-safe order:
 * Users → Units → UnitTranslations → UnitSupportLanguages → UnitTags → Realm → RealmMember → EchoKV
 */
export async function restoreInfrastructure(
  prisma: PrismaClient,
  snapshot: InfraSnapshot,
): Promise<void> {
  console.log("[Restore] Restoring infrastructure...");

  // Snapshot data comes directly from findMany — the JSON fields are typed as
  // JsonValue (includes null) but createMany expects InputJsonValue. Since the
  // data was just read from the DB, it's safe to cast.

  // Users first (no FK deps in server DB)
  if (snapshot.users.length > 0) {
    await prisma.user.createMany({ data: snapshot.users as any });
  }

  // Units (tags + realm unit)
  if (snapshot.units.length > 0) {
    await prisma.unit.createMany({ data: snapshot.units as any });
  }

  // Translations + support languages (depend on Unit)
  await Promise.all([
    snapshot.translations.length > 0
      ? prisma.unitTranslation.createMany({
          data: snapshot.translations as any,
        })
      : Promise.resolve(),
    snapshot.supportLanguages.length > 0
      ? prisma.unitSupportLanguage.createMany({
          data: snapshot.supportLanguages,
        })
      : Promise.resolve(),
  ]);

  // UnitTags (self-referencing tag entries, depend on Unit)
  if (snapshot.unitTags.length > 0) {
    await prisma.unitTag.createMany({ data: snapshot.unitTags });
  }

  // Realm extension (depends on Unit)
  if (snapshot.realms.length > 0) {
    await prisma.realm.createMany({ data: snapshot.realms as any });
  }

  // RealmMember (depends on Realm + User)
  if (snapshot.realmMembers.length > 0) {
    await prisma.realmMember.createMany({ data: snapshot.realmMembers });
  }

  // EchoKV (no FK deps)
  if (snapshot.echoKV.length > 0) {
    await prisma.echoKV.createMany({ data: snapshot.echoKV as any });
  }

  console.log(
    `[Restore] Restored: ${snapshot.users.length} users, ${snapshot.units.length} units, ${snapshot.echoKV.length} EchoKV entries`,
  );
}

/**
 * Reset the database while preserving seed CLIed infrastructure.
 * Snapshots infra → runs full reset → restores snapshotted data.
 *
 * Preserved infrastructure includes:
 * - Seed users (root, admin, regular, blocked)
 * - Content-type tags (Book, Game, Media, Post, Link)
 * - Official realm + owner membership
 * - Infrastructure EchoKV entries (infra:*)
 */
export async function resetDatabasePreserveInfra(
  prisma: PrismaClient,
): Promise<void> {
  const snapshot = await snapshotInfrastructure(prisma);
  await resetDatabase(prisma);
  await restoreInfrastructure(prisma, snapshot);
}
