import {
  DEFAULT_LANGUAGE,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  DEFAULT_REALM,
  markdownContentDoc,
} from "@rezics/contract";
import type { PrismaClient } from "../../../../prisma/generated/client.js";
import type { SlugScopesMap } from "./seed-slug-scopes";

/**
 * Seed the default official realm owned by the root user with contract slug.
 *
 * Idempotent: matches by `(realmScope, slug)`, falls back to any
 * `isOfficial: true` realm. Returns the realm unit ID.
 */
export async function seedDefaultRealm(
  prisma: PrismaClient,
  rootUserId: string,
  slugScopes: SlugScopesMap,
): Promise<string> {
  console.log("[Seed] Seeding default realm...");

  const realmScope = slugScopes.realm;

  const bySlug = await prisma.unit.findUnique({
    where: {
      slugScope_slug: { slugScope: realmScope, slug: DEFAULT_REALM.slug },
    },
    select: { id: true, type: true },
  });

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

  const existingOfficial = await prisma.realm.findFirst({
    where: { isOfficial: true },
    select: { unitId: true },
  });

  if (existingOfficial) {
    console.log(
      `[Seed]   Official realm already exists (${existingOfficial.unitId}), setting slug and reusing.`,
    );
    await prisma.unit.update({
      where: { id: existingOfficial.unitId },
      data: { slug: DEFAULT_REALM.slug, slugScope: realmScope },
    });
    return existingOfficial.unitId;
  }

  const languages = Object.keys(DEFAULT_REALM.translations) as Array<
    keyof typeof DEFAULT_REALM.translations
  >;

  const unit = await prisma.unit.create({
    data: {
      type: "REALM",
      slug: DEFAULT_REALM.slug,
      slugScope: realmScope,
      userId: rootUserId,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      publishedAt: new Date(),
      defaultLanguage: DEFAULT_LANGUAGE,
      translations: {
        create: languages.map((lang) => ({
          language: lang,
          title: DEFAULT_REALM.translations[lang].title,
          description: markdownContentDoc(
            DEFAULT_REALM.translations[lang].description,
          ),
        })),
      },
      supportLanguages: {
        create: languages.map((lang, i) => ({
          language: lang,
          isPrimary: lang === DEFAULT_LANGUAGE,
          sortOrder: i,
        })),
      },
      realm: {
        create: {
          isPublic: DEFAULT_REALM.isPublic,
          isOfficial: DEFAULT_REALM.isOfficial,
          memberCount: 1,
          extra: {
            defaultLicenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
          },
        },
      },
    },
    select: { id: true },
  });

  await prisma.realmMember.create({
    data: {
      realmUnitId: unit.id,
      userId: rootUserId,
      roleKey: "owner",
    },
  });

  console.log(
    `[Seed]   Created default realm (${unit.id}, slug=${DEFAULT_REALM.slug})`,
  );
  return unit.id;
}
