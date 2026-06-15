import { randomUUID } from "node:crypto";
import { faker } from "@faker-js/faker";
import {
  DEFAULT_LANGUAGE,
  ZONE_SECTION_QUERY_SORT_FIELDS,
  type ZoneBoundary,
  type ZoneBoundaryFilter,
  type ZoneCollectionItem,
  type ZoneContentSection,
  type ZoneDynamicTags,
  type ZoneMenu,
  type ZoneNav,
  type ZonePage as ZonePageConfig,
  type ZonePageSection,
  type ZoneSectionQuery,
  type ZoneTheme,
} from "@rezics/contract";
import { rebalance } from "../../shelf/fractional-index.js";
import {
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  Zone,
  ZonePage,
} from "../schema";
import { generateTranslations } from "./generators.js";
import { UnitStatus, UnitType } from "./storage-values.js";
import type { CountSpec, SeedCtx } from "./strategy.js";
import type { CreatedUnit } from "./types.js";
import { pickN, withUpdatedAt, withUpdatedAtRows } from "./utils.js";

/**
 * Fixture shapes covering every zone section kind except `richText`: the
 * synthetic seeder has no WIKI fragment posts to reference, so `richText`
 * coverage lives in the deterministic `toaru` factory scenario.
 * 覆盖除 `richText` 外所有专区分区 kind 的 fixture 形态：合成播种器没有
 * 可引用的 WIKI 片段帖子，因此 `richText` 的覆盖由确定性的 `toaru`
 * 工厂情境承担。
 */
export const ZONE_FIXTURE_KINDS = [
  "book-portal",
  "pulse-board",
  "tabbed-portal",
  "columns-portal",
  "realm-directory",
  "zone-directory",
] as const;

export type ZoneFixtureKind = (typeof ZONE_FIXTURE_KINDS)[number];

export interface ZoneFixtureRefs {
  // null → global context; the boundary may then not use realm: "context".
  // null → global 语境；此时边界不得使用 realm: "context"。
  contextRealmUnitId: string | null;
  workUnitIds: string[];
  tagUnitIds: string[];
  realmUnitIds: string[];
}

export type ZoneFixtureConfig = {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  pages: Array<{
    id: string;
    slug: string;
    position: string;
    config: ZonePageConfig;
  }>;
  homePageId: string;
};

type ZoneFixturePageIds = {
  home: string;
  search: string;
  feed: string;
};

const WORK_TYPE_FILTERS = [UnitType.BOOK, UnitType.GAME, UnitType.MEDIA];

const UNIT_SORT_FIELDS = ZONE_SECTION_QUERY_SORT_FIELDS.unit;
const POST_SORT_FIELDS = ZONE_SECTION_QUERY_SORT_FIELDS.post;
const REALM_SORT_FIELDS = ZONE_SECTION_QUERY_SORT_FIELDS.realm;
const ZONE_SORT_FIELDS = ZONE_SECTION_QUERY_SORT_FIELDS.zone;

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

function unitItems(unitIds: string[], max: number): ZoneCollectionItem[] {
  const picked =
    unitIds.length > 0 ? pickN(unitIds, Math.min(max, unitIds.length)) : [];
  return picked.map((unitId) => ({ target: { kind: "unit", unitId } }));
}

function fixtureMenus(
  refs: ZoneFixtureRefs,
  pageIds: ZoneFixturePageIds,
): ZoneMenu[] {
  const nodes: ZoneMenu["nodes"] = [
    { id: "home", target: { kind: "zonePage", pageId: pageIds.home } },
    { id: "search", target: { kind: "zonePage", pageId: pageIds.search } },
    { id: "feed", target: { kind: "zonePage", pageId: pageIds.feed } },
  ];
  // A unit-target group node resolves its label from the target unit, so it
  // is valid without a labelUnitId.
  // 指向 Unit 的分组节点从目标 Unit 解析标签，因此无需 labelUnitId。
  const groupChildren = unitItems(refs.realmUnitIds, 3);
  if (groupChildren.length > 1) {
    const [head, ...rest] = groupChildren;
    nodes.push({
      id: "related",
      target: head!.target,
      children: rest.map((item, index) => ({
        id: `related-${index}`,
        target: item.target,
      })),
    });
  }
  return [{ id: "main", nodes }];
}

function fixtureTheme(): ZoneTheme {
  return {
    schema: "rezics/zone-theme",
    version: 1,
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
      contentMaxWidth: faker.helpers.arrayElement([1152, 1280, 1440]),
      density: faker.helpers.arrayElement(["compact", "comfortable"]),
    },
  };
}

function fixtureBoundary(
  kind: ZoneFixtureKind,
  refs: ZoneFixtureRefs,
): ZoneBoundaryFilter {
  const contentType = faker.helpers.arrayElement(WORK_TYPE_FILTERS);
  switch (kind) {
    case "book-portal":
      return { types: [UnitType.BOOK] };
    case "tabbed-portal":
      return { types: [contentType] };
    case "pulse-board":
      return { postKinds: ["POST", "REVIEW", "REMARK"] };
    case "columns-portal":
      return refs.contextRealmUnitId ? { realm: "context" } : {};
    case "realm-directory":
      return { types: [UnitType.REALM] };
    case "zone-directory":
      return { types: [UnitType.ZONE] };
  }
}

function fixtureBookDynamicTags(
  tagUnitIds: readonly string[],
): ZoneDynamicTags {
  const options = pickN(tagUnitIds, Math.min(8, tagUnitIds.length)).map(
    (tagUnitId) => ({
      tagUnitIds: [tagUnitId],
      probability:
        tagUnitIds.length > 0 ? 0.8 / Math.min(8, tagUnitIds.length) : 0,
    }),
  );
  return {
    groupId: "book-portal-topics",
    fallback: true,
    options,
  };
}

function unitQuerySection(input: {
  id: string;
  types?: ZoneSectionQuery["types"];
  tagUnitIds?: string[];
  limit: number;
}): ZoneContentSection {
  return {
    id: input.id,
    kind: "query",
    display: faker.helpers.arrayElement(["grid", "covers", "tiles", "list"]),
    limit: input.limit,
    loadMore: true,
    query: {
      target: "unit",
      languages: "viewer",
      ...(input.types ? { types: input.types } : {}),
      ...(input.tagUnitIds && input.tagUnitIds.length > 0
        ? { tagUnitIds: input.tagUnitIds }
        : {}),
      sort: {
        field: faker.helpers.arrayElement(UNIT_SORT_FIELDS),
        direction: "desc",
      },
    },
  };
}

function postQuerySection(input: {
  id: string;
  limit: number;
}): ZoneContentSection {
  return {
    id: input.id,
    kind: "query",
    display: "list",
    limit: input.limit,
    loadMore: true,
    query: {
      target: "post",
      postKinds: ["POST", "REVIEW"],
      languages: "viewer",
      sort: {
        field: faker.helpers.arrayElement(POST_SORT_FIELDS),
        direction: "desc",
      },
    },
  };
}

function realmQuerySection(input: {
  id: string;
  limit: number;
}): ZoneContentSection {
  return {
    id: input.id,
    kind: "query",
    display: faker.helpers.arrayElement(["tiles", "list", "avatar-wall"]),
    limit: input.limit,
    loadMore: true,
    query: {
      target: "realm",
      types: ["REALM"],
      languages: "viewer",
      sort: {
        field: faker.helpers.arrayElement(REALM_SORT_FIELDS),
        direction: "desc",
      },
    },
  };
}

function zoneQuerySection(input: {
  id: string;
  limit: number;
}): ZoneContentSection {
  return {
    id: input.id,
    kind: "query",
    display: faker.helpers.arrayElement(["tiles", "list"]),
    limit: input.limit,
    loadMore: true,
    query: {
      target: "zone",
      types: ["ZONE"],
      languages: "viewer",
      sort: {
        field: faker.helpers.arrayElement(ZONE_SORT_FIELDS),
        direction: "desc",
      },
    },
  };
}

function fixtureHomeSections(
  kind: ZoneFixtureKind,
  refs: ZoneFixtureRefs,
): ZonePageSection[] {
  switch (kind) {
    case "book-portal": {
      return [
        {
          id: "stage",
          kind: "stage",
          sections: [{ id: "zone-info", kind: "zoneInfo" }],
        },
        {
          id: "latest",
          kind: "query",
          display: "carousel",
          limit: 24,
          loadMore: true,
          query: {
            target: "unit",
            types: [UnitType.BOOK],
            languages: "viewer",
            sort: { field: "publishedAt", direction: "desc" },
          },
        },
        {
          id: "topic-a",
          kind: "query",
          display: "carousel",
          limit: 18,
          loadMore: true,
          query: {
            target: "unit",
            types: [UnitType.BOOK],
            languages: "viewer",
            sort: { field: "qualityScore", direction: "desc" },
          },
          dynamicTags: fixtureBookDynamicTags(refs.tagUnitIds),
        },
        {
          id: "topic-b",
          kind: "query",
          display: "carousel",
          limit: 18,
          loadMore: true,
          query: {
            target: "unit",
            types: [UnitType.BOOK],
            languages: "viewer",
            sort: { field: "risingScore", direction: "desc" },
          },
          dynamicTags: fixtureBookDynamicTags(refs.tagUnitIds),
        },
        {
          id: "topic-c",
          kind: "query",
          display: "carousel",
          limit: 18,
          loadMore: true,
          query: {
            target: "unit",
            types: [UnitType.BOOK],
            languages: "viewer",
            sort: { field: "trendingScore", direction: "desc" },
          },
          dynamicTags: fixtureBookDynamicTags(refs.tagUnitIds),
        },
        {
          id: "hot-feed",
          kind: "query",
          display: "stream",
          limit: 24,
          loadMore: true,
          query: {
            target: "unit",
            types: [UnitType.BOOK],
            languages: "viewer",
            sort: { field: "hotScore", direction: "desc" },
          },
        },
      ];
    }
    case "pulse-board":
      return [
        postQuerySection({ id: "pulse", limit: 30 }),
        {
          id: "home-feed",
          kind: "feed",
          feedKind: faker.helpers.arrayElement(["all", "updates", "reviews"]),
          limit: 30,
        },
      ];
    case "tabbed-portal":
      return [
        {
          id: "stage",
          kind: "stage",
          sections: [{ id: "zone-info", kind: "zoneInfo" }],
        },
        {
          id: "portal-tabs",
          kind: "tabs",
          defaultTabId: "works",
          tabs: [
            {
              id: "works",
              sections: [unitQuerySection({ id: "tab-works", limit: 12 })],
            },
            {
              id: "posts",
              sections: [postQuerySection({ id: "tab-posts", limit: 12 })],
            },
            {
              id: "activity",
              sections: [
                {
                  id: "tab-feed",
                  kind: "feed",
                  feedKind: "updates",
                  limit: 12,
                },
              ],
            },
          ],
        },
      ];
    case "columns-portal":
      return [
        {
          id: "stage",
          kind: "stage",
          sections: [{ id: "zone-info", kind: "zoneInfo" }],
        },
        {
          id: "layout",
          kind: "columns",
          columns: [
            {
              id: "main",
              ratio: 3,
              sections: [
                unitQuerySection({ id: "main-works", limit: 18 }),
                {
                  id: "main-tabs",
                  kind: "tabs",
                  tabs: [
                    {
                      id: "hot",
                      sections: [
                        postQuerySection({ id: "main-hot", limit: 10 }),
                      ],
                    },
                    {
                      id: "recent",
                      sections: [
                        {
                          id: "main-feed",
                          kind: "feed",
                          feedKind: "all",
                          limit: 10,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: "side",
              ratio: 1,
              sections: [
                {
                  id: "side-picks",
                  kind: "collection",
                  display: "list",
                  items: unitItems(refs.workUnitIds, 6),
                },
                {
                  id: "side-stats",
                  kind: "stats",
                  metrics: ["articles", "members"],
                },
              ],
            },
          ],
        },
      ];
    case "realm-directory":
      return [
        {
          id: "stage",
          kind: "stage",
          sections: [{ id: "zone-info", kind: "zoneInfo" }],
        },
        {
          id: "featured",
          kind: "collection",
          display: "tiles",
          items: unitItems(refs.realmUnitIds, 12),
        },
        realmQuerySection({ id: "all-realms", limit: 24 }),
      ];
    case "zone-directory":
      return [
        {
          id: "stage",
          kind: "stage",
          sections: [{ id: "zone-info", kind: "zoneInfo" }],
        },
        zoneQuerySection({ id: "latest-zones", limit: 24 }),
        {
          id: "featured-realms",
          kind: "collection",
          display: "tiles",
          items: unitItems(refs.realmUnitIds, 12),
        },
      ];
  }
}

/**
 * Pure split-envelope builder for one fixture shape. The factory writes Zone
 * and ZonePage rows directly (bypassing service write validation), while the
 * read path throws on invalid envelopes — so every generated shell/page
 * envelope must satisfy its contract schema.
 * 单个 fixture 形态的拆分信封构造器。工厂直接写入 Zone 与 ZonePage 行
 * （绕过 service 写入校验），而读取路径会对非法信封抛错——因此生成的
 * 每个 shell/page 信封都必须满足对应契约 schema。
 */
export function buildZoneFixtureConfig(
  kind: ZoneFixtureKind,
  refs: ZoneFixtureRefs,
): ZoneFixtureConfig {
  const pageIds = {
    home: randomUUID(),
    search: randomUUID(),
    feed: randomUUID(),
  };
  const pagePositions = rebalance(3);
  return {
    boundary: {
      schema: "rezics/zone-boundary",
      version: 1,
      context: refs.contextRealmUnitId
        ? { kind: "realm", realmUnitId: refs.contextRealmUnitId }
        : { kind: "global" },
      filters: fixtureBoundary(kind, refs),
    },
    nav: {
      schema: "rezics/zone-nav",
      version: 1,
      menus: fixtureMenus(refs, pageIds),
      header: { menuId: "main" },
    },
    pages: [
      {
        id: pageIds.home,
        slug: "home",
        position: pagePositions[0]!,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: fixtureHomeSections(kind, refs),
        },
      },
      {
        id: pageIds.search,
        slug: "search",
        position: pagePositions[1]!,
        config: { schema: "rezics/zone-page", version: 1, sections: [] },
      },
      {
        id: pageIds.feed,
        slug: "feed",
        position: pagePositions[2]!,
        config: {
          schema: "rezics/zone-page",
          version: 1,
          sections: [{ id: "feed", kind: "feed", feedKind: "all", limit: 30 }],
        },
      },
    ],
    homePageId: pageIds.home,
    theme: fixtureTheme(),
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
    const config = buildZoneFixtureConfig(fixture, {
      // columns-portal exercises the realm context + "context" boundary;
      // the other shapes stay global like the official zones.
      // columns-portal 演练 realm 语境与 "context" 边界；其余形态与官方
      // 专区一样保持 global。
      contextRealmUnitId: fixture === "columns-portal" ? ownerRealm.id : null,
      workUnitIds: workIds,
      tagUnitIds: tagIds,
      realmUnitIds: realms.map((realm) => realm.id),
    });

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
        boundary: config.boundary,
        nav: config.nav,
        theme: config.theme,
        homePageId: config.homePageId,
        startsAt,
        endsAt,
      }),
    );
    await ctx.db.insert(ZonePage).values(
      withUpdatedAtRows(
        config.pages.map((page) => ({
          id: page.id,
          zoneUnitId: id,
          slug: page.slug,
          position: page.position,
          config: page.config,
        })),
      ),
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
          position: rebalance(translations.length)[idx]!,
        })),
      ),
    );

    await ctx.sync.zone(id);
    results.push({ id, type: UnitType.ZONE });
  }

  return results;
}
