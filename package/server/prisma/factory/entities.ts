import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  type CreditAttributionRole,
  creditAttributionRoleRegistry,
  creditAttributionRoles,
  type EntityKind,
  LANGUAGES,
  type SubjectAttributionRole,
  subjectAttributionRoleRegistry,
  subjectAttributionRoles,
} from "@rezics/contract";
import type { Prisma, PrismaClient } from "../generated/client.js";
import { UnitStatus, UnitType } from "../generated/client.js";
import { generateTranslations, getFaker } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedEntity } from "./types.js";
import { pickN, randomBoolean, randomInt } from "./utils.js";

/** Locale distribution for entity names — diverse locale mix. */
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

const SUBJECT_KINDS = [
  "character",
  "faction",
  "family",
  "location",
  "artifact",
  "event",
  "concept",
] as const satisfies readonly EntityKind[];

interface EntitySeedRow {
  id: string;
  primaryLang: string;
  primaryName: string;
  verified: boolean;
  translations: {
    language: string;
    title: string;
    description?: Prisma.InputJsonValue;
  }[];
}

export function eligibleCreditRolesForKind(
  kind: EntityKind,
): CreditAttributionRole[] {
  return creditAttributionRoles.filter((role) =>
    (
      creditAttributionRoleRegistry[role]
        .entityKindHints as readonly EntityKind[]
    ).includes(kind),
  );
}

export function eligibleSubjectRolesForKind(
  kind: EntityKind,
): SubjectAttributionRole[] {
  return subjectAttributionRoles.filter((role) =>
    (
      subjectAttributionRoleRegistry[role]
        .entityKindHints as readonly EntityKind[]
    ).includes(kind),
  );
}

function localeName(lang: string, kind: EntityKind): string {
  const f = getFaker(lang as Parameters<typeof getFaker>[0]);
  if (kind === "person") return f.person.fullName();
  if (kind === "organization") return f.company.name();
  if (kind === "location") return f.location.city();
  if (kind === "event") return `${f.word.adjective()} ${f.word.noun()}`;
  if (kind === "artifact") return `${f.word.adjective()} ${f.word.noun()}`;
  if (kind === "concept") return f.word.noun();
  return `${f.word.adjective()} ${f.person.firstName()}`;
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
  entityScope: string,
  rows: EntitySeedRow[],
  kind: EntityKind,
): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    await prisma.unit.createMany({
      data: chunk.map((r) => ({
        id: r.id,
        type: UnitType.ENTITY,
        slugScope: entityScope,
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
        eligibleCreditRoles: eligibleCreditRolesForKind(kind),
        eligibleSubjectRoles: eligibleSubjectRolesForKind(kind),
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
  await batchInsertEntities(ctx.prisma, ctx.slugScopes.entity, rows, "person");

  return rows.map((r) => ({
    unitId: r.id,
    name: r.primaryName,
    kind: "person",
    eligibleCreditRoles: eligibleCreditRolesForKind("person"),
    eligibleSubjectRoles: eligibleSubjectRolesForKind("person"),
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
  await batchInsertEntities(
    ctx.prisma,
    ctx.slugScopes.entity,
    rows,
    "organization",
  );

  return rows.map((r) => ({
    unitId: r.id,
    name: r.primaryName,
    kind: "organization",
    eligibleCreditRoles: eligibleCreditRolesForKind("organization"),
    eligibleSubjectRoles: eligibleSubjectRolesForKind("organization"),
  }));
}

export async function seedSubjectEntities(
  ctx: SeedCtx,
  spec: CountSpec,
): Promise<CreatedEntity[]> {
  const total = Math.max(7, ctx.draw(spec));
  console.log(`[Seed] Seeding ${total} subject entities...`);

  const rows = Array.from({ length: total }, (_, index) => {
    const kind = SUBJECT_KINDS[index % SUBJECT_KINDS.length]!;
    return { kind, row: buildEntityRow(kind, 0.05) };
  });

  for (const kind of SUBJECT_KINDS) {
    const kindRows = rows.filter((entry) => entry.kind === kind);
    if (kindRows.length === 0) continue;
    await batchInsertEntities(
      ctx.prisma,
      ctx.slugScopes.entity,
      kindRows.map((entry) => entry.row),
      kind,
    );
  }

  return rows.map(({ kind, row }) => ({
    unitId: row.id,
    name: row.primaryName,
    kind,
    eligibleCreditRoles: eligibleCreditRolesForKind(kind),
    eligibleSubjectRoles: eligibleSubjectRolesForKind(kind),
  }));
}

export async function seedSubjectAttributions(
  prisma: PrismaClient,
  works: Array<{ id: string }>,
  subjects: CreatedEntity[],
): Promise<number> {
  if (works.length === 0 || subjects.length === 0) return 0;

  const rows: Prisma.SubjectAttributionCreateManyInput[] = [];
  for (const work of works) {
    if (!randomBoolean(0.7)) continue;
    for (const [index, subject] of pickN(subjects, randomInt(1, 3)).entries()) {
      const eligibleSubjectRoles = subject.eligibleSubjectRoles ?? [];
      if (eligibleSubjectRoles.length === 0) continue;
      rows.push({
        unitId: work.id,
        entityId: subject.unitId,
        role:
          subject.kind === "character"
            ? faker.helpers.arrayElement([
                "primary_character",
                "featured_character",
                "appears",
              ])
            : faker.helpers.arrayElement(eligibleSubjectRoles),
        sortOrder: index,
        weight: Number(faker.number.float({ min: 0.1, max: 1 }).toFixed(2)),
      });
    }
  }

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.subjectAttribution.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }

  return rows.length;
}
