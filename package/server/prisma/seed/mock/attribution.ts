import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE, LANGUAGES } from "@rezics/contract";
import { UnitStatus, UnitType } from "#/prisma/generated/client.js";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { getFaker } from "./generators.js";
import type { CreatedEntity } from "./types.js";

/** Locale distribution for attribution names — diverse locale mix. */
const LOCALE_WEIGHTS = [
  { lang: LANGUAGES.ZH_HANT, weight: 0.35 },
  { lang: LANGUAGES.EN, weight: 0.25 },
  { lang: LANGUAGES.JA, weight: 0.2 },
  { lang: LANGUAGES.ZH_HANS, weight: 0.1 },
  { lang: LANGUAGES.DE, weight: 0.1 },
] as const;

function pickRandomLocale(): (typeof LOCALE_WEIGHTS)[number]["lang"] {
  const r = Math.random();
  let cumulative = 0;
  for (const { lang, weight } of LOCALE_WEIGHTS) {
    cumulative += weight;
    if (r < cumulative) return lang;
  }
  return LANGUAGES.EN;
}

/**
 * Seed Entity units (kind='person') via individual creates.
 * Each entity = Unit (type=ENTITY) + Entity extension + UnitTranslation.
 */
export async function seedPeople(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedEntity[]> {
  console.log(`[Seed] Seeding ${total} person entities...`);

  const results: CreatedEntity[] = [];

  for (let i = 0; i < total; i++) {
    const lang = pickRandomLocale();
    const f = getFaker(lang);
    const id = randomUUID();
    const name = f.person.fullName();

    await prisma.unit.create({
      data: {
        id,
        type: UnitType.ENTITY,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: lang,
        entity: {
          create: {
            kind: "person",
            verified: false,
          },
        },
        translations: {
          create: {
            language: lang,
            title: name,
          },
        },
      },
    });

    results.push({ unitId: id, name, kind: "person" });
  }

  return results;
}

/**
 * Seed Entity units (kind='organization') via individual creates.
 * Each entity = Unit (type=ENTITY) + Entity extension + UnitTranslation.
 */
export async function seedOrganizations(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedEntity[]> {
  console.log(`[Seed] Seeding ${total} organization entities...`);

  const results: CreatedEntity[] = [];

  for (let i = 0; i < total; i++) {
    const lang = pickRandomLocale();
    const f = getFaker(lang);
    const id = randomUUID();
    const name = f.company.name();

    await prisma.unit.create({
      data: {
        id,
        type: UnitType.ENTITY,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: lang,
        entity: {
          create: {
            kind: "organization",
            verified: false,
          },
        },
        translations: {
          create: {
            language: lang,
            title: name,
          },
        },
      },
    });

    results.push({ unitId: id, name, kind: "organization" });
  }

  return results;
}
