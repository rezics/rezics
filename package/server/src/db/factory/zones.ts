import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import { DEFAULT_LANGUAGE } from "@rezics/contract";
import type { Prisma } from "../../../prisma/generated/client.js";
import { UnitStatus, UnitType } from "../../../prisma/generated/client.js";
import { Unit, UnitSupportLanguage, UnitTranslation, Zone } from "../schema";
import { generateTranslations } from "./generators.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit } from "./types.js";
import { pickN, randomBoolean } from "./utils.js";

const ZONE_TEMPLATES = [
  "featured-carousel",
  "trending-grid",
  "seasonal-banner",
  "topic-spotlight",
  "new-releases",
] as const;

const ZONE_STYLING_PRESETS: Prisma.InputJsonValue[] = [
  { layout: "hero", backgroundColor: "#0f172a", textColor: "#f8fafc" },
  { layout: "grid", columns: 4 },
  { layout: "carousel", autoplay: true, interval: 5000 },
  {
    layout: "banner",
    backgroundImageUrl: "https://picsum.photos/seed/zone/1600/400",
  },
  { theme: "seasonal", accentColor: "#f97316" },
  { theme: "dark", accentColor: "#6366f1" },
];

const WORK_TYPE_FILTERS = [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA];

interface ZoneTemporalState {
  startsAt: Date | null;
  endsAt: Date | null;
}

function pickTemporalState(): ZoneTemporalState {
  const r = Math.random();
  if (r < 0.4) return { startsAt: null, endsAt: null };
  if (r < 0.7) {
    return {
      startsAt: faker.date.past({ years: 1 }),
      endsAt: faker.date.future({ years: 1 }),
    };
  }
  if (r < 0.9) {
    const startsAt = faker.date.future({ years: 1 });
    const endsAt = faker.date.soon({ days: 180, refDate: startsAt });
    return { startsAt, endsAt };
  }
  const endsAt = faker.date.past({ years: 1 });
  const startsAt = faker.date.past({ years: 2, refDate: endsAt });
  return { startsAt, endsAt };
}

function buildFilters(
  template: (typeof ZONE_TEMPLATES)[number],
  workIds: string[],
  tagIds: string[],
): Prisma.InputJsonValue {
  const contentType = faker.helpers.arrayElement(WORK_TYPE_FILTERS);

  switch (template) {
    case "featured-carousel": {
      const picks =
        workIds.length > 0 ? pickN(workIds, Math.min(8, workIds.length)) : [];
      return { type: contentType, workIds: picks };
    }
    case "trending-grid":
      return {
        type: contentType,
        sort: "trending",
        since: faker.date.past({ years: 1 }).toISOString(),
      };
    case "seasonal-banner":
      return {
        season: faker.helpers.arrayElement([
          "spring",
          "summer",
          "autumn",
          "winter",
        ]),
        type: contentType,
      };
    case "topic-spotlight": {
      const picks =
        tagIds.length > 0 ? pickN(tagIds, Math.min(3, tagIds.length)) : [];
      return { type: contentType, tagIds: picks };
    }
    case "new-releases":
      return {
        type: contentType,
        sort: "newest",
        since: faker.date.recent({ days: 90 }).toISOString(),
      };
  }
}

export async function seedZones(
  ctx: SeedCtx,
  spec: CountSpec,
  workIds: string[],
  tagIds: string[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} zones...`);

  const results: CreatedUnit[] = [];

  // Ensure every template appears at least once when total >= templates count
  const templateSchedule: (typeof ZONE_TEMPLATES)[number][] = [];
  for (let i = 0; i < total; i++) {
    if (i < ZONE_TEMPLATES.length) {
      templateSchedule.push(ZONE_TEMPLATES[i]!);
    } else {
      templateSchedule.push(faker.helpers.arrayElement(ZONE_TEMPLATES));
    }
  }

  for (let i = 0; i < total; i++) {
    const template = templateSchedule[i]!;
    const translations = generateTranslations(UnitType.ZONE);
    const { startsAt, endsAt } = pickTemporalState();
    const styling = randomBoolean(0.6)
      ? faker.helpers.arrayElement(ZONE_STYLING_PRESETS)
      : null;
    const filters = buildFilters(template, workIds, tagIds);

    const id = randomUUID();
    await ctx.db.insert(Unit).values({
      id,
      type: UnitType.ZONE,
      slugScope: ctx.slugScopes.zone,
      status: UnitStatus.PUBLISHED,
      defaultLanguage: DEFAULT_LANGUAGE,
      publishedAt: faker.date.past({ years: 1 }),
    });
    await ctx.db.insert(Zone).values({
      unitId: id,
      template,
      filters,
      styling,
      startsAt,
      endsAt,
    });
    await ctx.db.insert(UnitTranslation).values(
      translations.map((t) => ({
        unitId: id,
        language: t.language,
        title: t.title,
        description: t.description,
      })),
    );
    await ctx.db.insert(UnitSupportLanguage).values(
      translations.map((t, idx) => ({
        unitId: id,
        language: t.language,
        isPrimary: idx === 0,
        sortOrder: idx,
      })),
    );

    results.push({ id, type: UnitType.ZONE });
  }

  return results;
}
