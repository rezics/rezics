import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  type ZoneFilters,
  type ZonePages,
  type ZoneSection,
  type ZoneTheme,
} from "@rezics/contract";
import { Unit, UnitSupportLanguage, UnitTranslation, Zone } from "../schema";
import { generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit } from "./types.js";
import {
  pickN,
  randomBoolean,
  withUpdatedAt,
  withUpdatedAtRows,
} from "./utils.js";

const ZONE_FIXTURE_KINDS = [
  "content-latest",
  "content-popular",
  "feed-pulse",
  "wiki-collection",
  "realm-directory",
] as const;

const WORK_TYPE_FILTERS = [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA];
type ZoneFixtureKind = (typeof ZONE_FIXTURE_KINDS)[number];

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

function label(text: string) {
  return {
    translations: { en: text },
    fallbackLanguage: DEFAULT_LANGUAGE,
  };
}

function buildFilters(fixture: ZoneFixtureKind): ZoneFilters {
  const contentType = faker.helpers.arrayElement(WORK_TYPE_FILTERS);

  switch (fixture) {
    case "content-latest":
    case "content-popular":
      return { type: contentType };
    case "feed-pulse":
      return { postKind: "POST" };
    case "wiki-collection":
      return { type: contentType, postKind: "WIKI" };
    case "realm-directory":
      return { type: UnitType.REALM };
  }
}

function buildSections(
  fixture: ZoneFixtureKind,
  filters: ZoneFilters,
  workIds: string[],
  tagIds: string[],
  realms: CreatedUnit[],
): ZoneSection[] {
  switch (fixture) {
    case "content-latest":
      return [
        {
          id: "latest",
          kind: "latestContent",
          source: "unit",
          title: label("Latest content"),
          filters,
          limit: 24,
        },
        {
          id: "reviews",
          kind: "reviewStream",
          title: label("Recent reviews"),
          filters,
          limit: 12,
        },
      ];
    case "content-popular":
      return [
        {
          id: "popular",
          kind: "popularContent",
          metric: faker.helpers.arrayElement([
            "views",
            "bookmarks",
            "rating",
            "discussion",
          ]),
          title: label("Popular content"),
          filters,
          limit: 24,
        },
      ];
    case "feed-pulse":
      return [
        {
          id: "feed",
          kind: "feed",
          feedKind: faker.helpers.arrayElement(["all", "updates", "reviews"]),
          title: label("Feed"),
          filters,
          limit: 30,
        },
      ];
    case "wiki-collection": {
      const wikiUnitIds =
        workIds.length > 0 ? pickN(workIds, Math.min(8, workIds.length)) : [];
      return [
        {
          id: "wiki",
          kind: "wikiCollection",
          title: label("Wiki collection"),
          wikiUnitIds,
          filters: { ...filters, wikiUnitIds },
          limit: 24,
        },
        {
          id: "tags",
          kind: "tagNavigation",
          title: label("Topics"),
          tagUnitIds:
            tagIds.length > 0 ? pickN(tagIds, Math.min(8, tagIds.length)) : [],
        },
      ];
    }
    case "realm-directory":
      return [
        {
          id: "realms",
          kind: "realmList",
          title: label("Realms"),
          realmUnitIds: realms.map((realm) => realm.id).slice(0, 12),
          limit: 12,
        },
        {
          id: "activity",
          kind: "popularContent",
          metric: "discussion",
          title: label("Active discussions"),
          filters,
          limit: 20,
        },
      ];
  }
}

function buildPages(title: string, sections: ZoneSection[]): ZonePages {
  return {
    home: { title: label(title), sections },
    search: { title: label("Search"), sections: [] },
    feed: {
      title: label("Feed"),
      sections: [
        {
          id: "feed",
          kind: "feed",
          feedKind: "all",
          title: label("Feed"),
          limit: 30,
        },
      ],
    },
  };
}

function buildTheme(): ZoneTheme {
  return {
    tokens: {
      accent: faker.helpers.arrayElement([
        "#2563eb",
        "#0f766e",
        "#c2410c",
        "#7c3aed",
      ]),
      accentText: "#ffffff",
    },
    layout: {
      contentWidth: faker.helpers.arrayElement(["normal", "wide"]),
      navPosition: faker.helpers.arrayElement(["side", "top"]),
      density: faker.helpers.arrayElement(["compact", "comfortable"]),
    },
  };
}

export async function seedZones(
  ctx: SeedCtx,
  spec: CountSpec,
  workIds: string[],
  tagIds: string[],
  realms: CreatedUnit[],
): Promise<CreatedUnit[]> {
  const total = ctx.draw(spec);
  console.log(`[Seed] Seeding ${total} zones...`);
  const ownerRealm = realms[0];
  if (!ownerRealm) {
    console.log("[Seed]   No realms available, skipping zones.");
    return [];
  }

  const results: CreatedUnit[] = [];

  // Ensure every fixture shape appears at least once when total >= fixture count.
  // 当 total >= fixture 数量时，确保每种 zone 配置形态至少出现一次。
  const fixtureSchedule: ZoneFixtureKind[] = [];
  for (let i = 0; i < total; i++) {
    if (i < ZONE_FIXTURE_KINDS.length) {
      fixtureSchedule.push(ZONE_FIXTURE_KINDS[i]!);
    } else {
      fixtureSchedule.push(faker.helpers.arrayElement(ZONE_FIXTURE_KINDS));
    }
  }

  for (let i = 0; i < total; i++) {
    const fixture = fixtureSchedule[i]!;
    const translations = generateTranslations(UnitType.ZONE);
    const { startsAt, endsAt } = pickTemporalState();
    const filters = buildFilters(fixture);
    const sections = buildSections(fixture, filters, workIds, tagIds, realms);
    const pages = buildPages(translations[0]?.title ?? "Zone", sections);
    const theme = randomBoolean(0.8) ? buildTheme() : null;
    const template = filters.type === UnitType.BOOK ? "book" : "default";

    const id = randomUUID();
    await ctx.db.insert(Unit).values(
      withUpdatedAt({
        id,
        type: UnitType.ZONE,
        slugScope: ctx.slugScopes.zone,
        status: UnitStatus.PUBLISHED,
        defaultLanguage: DEFAULT_LANGUAGE,
        publishedAt: faker.date.past({ years: 1 }),
      }),
    );
    await ctx.db.insert(Zone).values(
      withUpdatedAt({
        unitId: id,
        ownerRealmUnitId: ownerRealm.id,
        template,
        filters,
        configVersion: 1,
        pages,
        sections,
        theme,
        styling: null,
        startsAt,
        endsAt,
      }),
    );
    await ctx.db.insert(UnitTranslation).values(
      withUpdatedAtRows(
        translations.map((t) => ({
          unitId: id,
          language: t.language,
          title: t.title,
          description: t.description,
        })),
      ),
    );
    await ctx.db.insert(UnitSupportLanguage).values(
      withUpdatedAtRows(
        translations.map((t, idx) => ({
          unitId: id,
          language: t.language,
          isPrimary: idx === 0,
          sortOrder: idx,
        })),
      ),
    );

    results.push({ id, type: UnitType.ZONE });
  }

  return results;
}
