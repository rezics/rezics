import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  DEFAULT_REALM,
  markdownContentDoc,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import type { ServerDb } from "../../client";
import {
  Realm,
  RealmMember,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
} from "../../schema";
import type { SlugScopesMap } from "./seed-slug-scopes";

type DefaultRealmSeedDb = Pick<
  ServerDb,
  "insert" | "select" | "transaction" | "update"
>;

/**
 * Seed the default official realm owned by the root user with contract slug.
 *
 * Idempotent: matches by `(realmScope, slug)`, falls back to any
 * `isOfficial: true` realm. Returns the realm unit ID.
 */
export async function seedDefaultRealm(
  db: DefaultRealmSeedDb,
  rootUserId: string,
  slugScopes: SlugScopesMap,
): Promise<string> {
  console.log("[Seed] Seeding default realm...");

  const realmScope = slugScopes.realm;

  const [bySlug] = await db
    .select({ id: Unit.id, type: Unit.type })
    .from(Unit)
    .where(
      and(eq(Unit.slugScope, realmScope), eq(Unit.slug, DEFAULT_REALM.slug)),
    )
    .limit(1);

  if (bySlug) {
    if (bySlug.type !== "REALM") {
      throw new Error(
        `[Seed] Slug "${DEFAULT_REALM.slug}" under realm scope is already used by a non-REALM unit (type=${bySlug.type}).`,
      );
    }
    console.log(
      `[Seed]   Default realm already exists by slug (${bySlug.id}), skipping.`,
    );
    return bySlug.id;
  }

  const [existingOfficial] = await db
    .select({ unitId: Realm.unitId })
    .from(Realm)
    .where(eq(Realm.isOfficial, true))
    .limit(1);

  if (existingOfficial) {
    console.log(
      `[Seed]   Official realm already exists (${existingOfficial.unitId}), setting slug and reusing.`,
    );
    await db
      .update(Unit)
      .set({
        slug: DEFAULT_REALM.slug,
        slugScope: realmScope,
        updatedAt: new Date(),
      })
      .where(eq(Unit.id, existingOfficial.unitId));
    return existingOfficial.unitId;
  }

  const languages = Object.keys(DEFAULT_REALM.translations) as Array<
    keyof typeof DEFAULT_REALM.translations
  >;

  const unitId = await db.transaction(async (tx) => {
    const now = new Date();
    const [unit] = await tx
      .insert(Unit)
      .values({
        type: "REALM",
        slug: DEFAULT_REALM.slug,
        slugScope: realmScope,
        userId: rootUserId,
        status: "PUBLISHED",
        visibility: "PUBLIC",
        publishedAt: now,
        defaultLanguage: DEFAULT_LANGUAGE,
        updatedAt: now,
      })
      .returning({ id: Unit.id });
    if (!unit) throw new Error("Failed to create default realm Unit");

    for (const [index, lang] of languages.entries()) {
      await tx.insert(UnitTranslation).values({
        unitId: unit.id,
        language: lang,
        title: DEFAULT_REALM.translations[lang].title,
        description: markdownContentDoc(
          DEFAULT_REALM.translations[lang].description,
        ),
        updatedAt: now,
      });
      await tx.insert(UnitSupportLanguage).values({
        unitId: unit.id,
        language: lang,
        isPrimary: lang === DEFAULT_LANGUAGE,
        sortOrder: index,
      });
    }

    await tx.insert(Realm).values({
      unitId: unit.id,
      isPublic: DEFAULT_REALM.isPublic,
      isOfficial: DEFAULT_REALM.isOfficial,
      memberCount: 1,
      extra: {
        defaultLicenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      },
      updatedAt: now,
    });

    await tx.insert(RealmMember).values({
      realmUnitId: unit.id,
      userId: rootUserId,
      roleKey: "owner",
      updatedAt: now,
    });

    return unit.id;
  });

  console.log(
    `[Seed]   Created default realm (${unitId}, slug=${DEFAULT_REALM.slug})`,
  );
  return unitId;
}
