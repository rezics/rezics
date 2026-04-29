import { randomUUID } from "node:crypto";
import { LANGUAGES } from "@rezics/contract";
import type { PrismaClient } from "../../generated/client.js";
import { UnitStatus, UnitType } from "../../generated/client.js";
import { generateTranslations, getFaker } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedEntity } from "./types.js";
import { randomBoolean } from "./utils.js";

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

const BATCH_SIZE = 500;

type EntityKind = "person" | "organization";

interface EntitySeedRow {
  id: string;
  primaryLang: string;
  primaryName: string;
  verified: boolean;
  translations: {
    language: string;
    title: string;
    description?: string;
  }[];
}

function localeName(lang: string, kind: EntityKind): string {
  const f = getFaker(lang as Parameters<typeof getFaker>[0]);
  return kind === "person" ? f.person.fullName() : f.company.name();
}

function buildEntityRow(kind: EntityKind, verifiedRate: number): EntitySeedRow {
  const primaryLang = pickRandomLocale();
  const primaryName = localeName(primaryLang, kind);

  const baseTranslations = generateTranslations(UnitType.ENTITY);
  const translations = baseTranslations.map((tr, i) => {
    const language = i === 0 ? primaryLang : tr.language;
    return {
      language,
      title: i === 0 ? primaryName : localeName(language, kind),
      description: tr.description,
    };
  });

  const seen = new Set<string>();
  const dedup = translations.filter((t) => {
    if (seen.has(t.language)) return false;
    seen.add(t.language);
    return true;
  });

  return {
    id: randomUUID(),
    primaryLang,
    primaryName,
    verified: randomBoolean(verifiedRate),
    translations: dedup,
  };
}

async function batchInsertEntities(
  prisma: PrismaClient,
  rows: EntitySeedRow[],
  kind: EntityKind,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.unit.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        type: UnitType.ENTITY,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: r.primaryLang,
      })),
    });
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.entity.createMany({
      data: chunk.map((r) => ({
        unitId: r.id,
        kind,
        verified: r.verified,
      })),
    });
  }

  const allTranslations = rows.flatMap((r) =>
    r.translations.map((tr) => ({
      unitId: r.id,
      language: tr.language,
      title: tr.title,
      description: tr.description,
    })),
  );
  for (let i = 0; i < allTranslations.length; i += BATCH_SIZE) {
    await prisma.unitTranslation.createMany({
      data: allTranslations.slice(i, i + BATCH_SIZE),
    });
  }

  const allSupport = rows.flatMap((r) =>
    r.translations.map((tr, i) => ({
      unitId: r.id,
      language: tr.language,
      isPrimary: i === 0,
      sortOrder: i,
    })),
  );
  for (let i = 0; i < allSupport.length; i += BATCH_SIZE) {
    await prisma.unitSupportLanguage.createMany({
      data: allSupport.slice(i, i + BATCH_SIZE),
    });
  }
}

export async function seedPeople(
  ctx: SeedCtx,
  spec: CountSpec,
): Promise<CreatedEntity[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} person entities...`);

  const rows = Array.from({ length: total }, () =>
    buildEntityRow("person", 0.05),
  );
  await batchInsertEntities(ctx.prisma, rows, "person");

  return rows.map((r) => ({
    unitId: r.id,
    name: r.primaryName,
    kind: "person",
  }));
}

export async function seedOrganizations(
  ctx: SeedCtx,
  spec: CountSpec,
): Promise<CreatedEntity[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} organization entities...`);

  const rows = Array.from({ length: total }, () =>
    buildEntityRow("organization", 0.1),
  );
  await batchInsertEntities(ctx.prisma, rows, "organization");

  return rows.map((r) => ({
    unitId: r.id,
    name: r.primaryName,
    kind: "organization",
  }));
}
