import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { LANGUAGES } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client.js";
import { getFaker } from "./generators.js";
import type { CreatedOrganization, CreatedPerson } from "./types.js";

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
 * Seed Person records via createMany.
 * Uses locale-appropriate faker instances for diverse name generation.
 */
export async function seedPeople(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedPerson[]> {
  console.log(`[Seed] Seeding ${total} people...`);

  const data = Array.from({ length: total }, () => {
    const lang = pickRandomLocale();
    const f = getFaker(lang);
    return {
      id: randomUUID(),
      name: f.person.fullName(),
      extra: {
        nationality: faker.location.country(),
        birthYear: faker.date.past({ years: 80 }).getFullYear(),
      },
    };
  });

  await prisma.person.createMany({ data });

  return data.map((p) => ({ id: p.id, name: p.name }));
}

/**
 * Seed Organization records via createMany.
 * Uses locale-appropriate faker instances for diverse company names.
 */
export async function seedOrganizations(
  prisma: PrismaClient,
  total: number,
): Promise<CreatedOrganization[]> {
  console.log(`[Seed] Seeding ${total} organizations...`);

  const data = Array.from({ length: total }, () => {
    const lang = pickRandomLocale();
    const f = getFaker(lang);
    return {
      id: randomUUID(),
      name: f.company.name(),
      extra: {
        country: faker.location.country(),
        foundedYear: faker.date.past({ years: 50 }).getFullYear(),
      },
    };
  });

  await prisma.organization.createMany({ data });

  return data.map((o) => ({ id: o.id, name: o.name }));
}
