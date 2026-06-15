import {
  type ContentDoc,
  type Language,
  type ListLanguageMode,
  markdownContentDoc,
  parseZoneBoundary,
  parseZoneNav,
  parseZonePage,
  parseZoneTheme,
  resolveReadLanguage,
  type StreamRow,
  type UnitType,
  ZONE_MENU_MAX_DEPTH,
  type ZoneBoundary,
  type ZoneCollectionItem,
  type ZoneContentSection,
  type ZoneDynamicTags,
  type ZoneListView,
  type ZoneMenuNode,
  type ZoneNav,
  type ZonePage as ZonePageConfig,
  type ZonePageSection,
  type ZoneSectionData,
  type ZoneSectionItem,
  type ZoneSectionQuery,
  type ZoneStageChildSection,
  type ZoneTheme,
  type ZoneTranslation,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ne,
  notInArray,
} from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import {
  compileZoneSectionQuery,
  zoneSectionQueryUnsupportedFields,
} from "@/meili/search/filters";
import { unitService } from "@/unit";
import { AppError } from "@/utils/errors";
import {
  ContentTranslation,
  Entity,
  Post,
  Realm,
  RealmMember,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
  UserSubscriptionListEntry,
  Zone,
  ZonePage,
} from "../db/schema";
import { generateBetween, rebalance } from "../shelf/fractional-index";
import {
  mapBookToStreamRow,
  mapPostToStreamRow,
  mapUnitToStreamRow,
} from "../stream";

const SECTION_DEFAULT_LIMIT = 12;

export type ZonePageWithConfig = Omit<
  typeof ZonePage.$inferSelect,
  "config"
> & {
  config: ZonePageConfig;
};

export type ZoneWithRelations = Omit<
  typeof Zone.$inferSelect,
  "boundary" | "nav" | "theme"
> & {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  pages: ZonePageWithConfig[];
  unit?:
    | (typeof Unit.$inferSelect & {
        translations: (typeof UnitTranslation.$inferSelect)[];
        supportLanguages: (typeof UnitSupportLanguage.$inferSelect)[];
      })
    | null;
};

type UnitRef = { id: string; type: string };

type TranslatedUnitRow = {
  id: string;
  type?: string;
  slug?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  translations?: Array<{
    language?: string | null;
    title?: string | null;
    summary?: string | null;
    description?: unknown;
    extra?: unknown;
  }>;
  supportLanguages?: Array<{
    language: string;
    isPrimary?: boolean;
    position?: string;
  }>;
  post?: { kind?: string | null } | null;
  entity?: { kind?: string | null } | null;
};

type ZoneCreateData = {
  unitId: string;
  ownerRealmUnitId: string;
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  homePage: ZonePageConfig;
  homePageSlug: string;
  startsAt: Date | null;
  endsAt: Date | null;
};

type ZoneUpdateData = Partial<{
  ownerRealmUnitId: string;
  startsAt: Date | null;
  endsAt: Date | null;
}>;

type ZonePageCreateData = {
  slug: string;
  position?: string;
  config: ZonePageConfig;
};

type ZonePageUpdateData = Partial<{
  slug: string;
  position: string;
  config: ZonePageConfig;
}>;

export type ZoneRepository = {
  findUnitRefs(ids: string[]): Promise<UnitRef[]>;
  // Post kinds for richText fragment refs (POST units only).
  // richText 片段引用的 Post kind（仅 POST Unit）。
  findPostKinds(
    unitIds: string[],
  ): Promise<Array<{ unitId: string; kind: string }>>;
  getByUnitId(unitId: string): Promise<ZoneWithRelations | null>;
  listSubscribedZoneIds(input: {
    userUnitId: string;
    publicOnly?: boolean;
    offset: number;
    limit: number;
  }): Promise<{ unitIds: string[]; total: number }>;
  listManageableZoneIds(input: {
    userUnitId: string;
    publicOnly?: boolean;
    offset: number;
    limit: number;
  }): Promise<{ unitIds: string[]; total: number }>;
  findPageBySlug(
    zoneUnitId: string,
    slug: string,
  ): Promise<ZonePageWithConfig | null>;
  getPage(
    zoneUnitId: string,
    pageId: string,
  ): Promise<ZonePageWithConfig | null>;
  findUnitBySlug(
    slugScope: string,
    slug: string,
  ): Promise<{ id: string; type: string; visibility: string } | null>;
  createZone(data: ZoneCreateData): Promise<ZoneWithRelations>;
  updateZone(unitId: string, data: ZoneUpdateData): Promise<ZoneWithRelations>;
  updateZoneBoundary(
    unitId: string,
    boundary: ZoneBoundary,
  ): Promise<ZoneWithRelations>;
  updateZoneNav(unitId: string, nav: ZoneNav): Promise<ZoneWithRelations>;
  updateZoneTheme(unitId: string, theme: ZoneTheme): Promise<ZoneWithRelations>;
  createPage(
    zoneUnitId: string,
    data: ZonePageCreateData,
  ): Promise<ZoneWithRelations>;
  updatePage(
    zoneUnitId: string,
    pageId: string,
    data: ZonePageUpdateData,
  ): Promise<ZoneWithRelations>;
  deletePage(zoneUnitId: string, pageId: string): Promise<ZoneWithRelations>;
  // Full-replace semantics: the array is the authoritative language set, so
  // the manage editor can both add and remove languages in one write.
  // 全量替换语义：数组即权威语言集合，使管理编辑器能在一次写入中同时
  // 增删语言。
  replaceTranslations(
    unitId: string,
    translations: ZoneTranslation[],
  ): Promise<void>;
  hydrateUnits(
    unitIds: string[],
    options?: { includeEntity?: boolean },
  ): Promise<Map<string, TranslatedUnitRow>>;
  findFragmentTranslations(
    unitId: string,
  ): Promise<Array<{ language: string; content: unknown }>>;
  searchSection(input: {
    index: "content" | "posts" | "realms" | "zones";
    filter: string[];
    sort: string[];
    offset: number;
    limit: number;
  }): Promise<{ ids: string[]; total: number }>;
  countWikiArticles(realmUnitId: string): Promise<number>;
  getRealmMemberCount(realmUnitId: string): Promise<number | null>;
  deleteUnit(unitId: string): Promise<void>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function pushIfPresent(target: Set<string>, value: string | null | undefined) {
  if (value) target.add(value);
}

function enqueueZoneSearch(
  kind:
    | typeof SEARCH_COMMAND_KINDS.zoneSync
    | typeof SEARCH_COMMAND_KINDS.zoneDelete,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { unitId }, { type: "server", service: "zone" }),
  );
}

function sectionLimit(section: { limit?: number }): number {
  return Math.min(Math.max(section.limit ?? SECTION_DEFAULT_LIMIT, 1), 100);
}

const ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON = 0.000001;

function dynamicTagsProbabilityTotal(dynamicTags: ZoneDynamicTags): number {
  return dynamicTags.options.reduce(
    (sum, option) => sum + option.probability,
    0,
  );
}

function dynamicTagsProbabilityValid(dynamicTags: ZoneDynamicTags): boolean {
  const total = dynamicTagsProbabilityTotal(dynamicTags);
  if (dynamicTags.fallback) {
    return total <= 1 + ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON;
  }
  return Math.abs(total - 1) <= ZONE_DYNAMIC_TAG_PROBABILITY_EPSILON;
}

function preferredTranslation(
  row: TranslatedUnitRow,
  preferredLanguages: readonly string[] = [],
) {
  const translations = row.translations ?? [];
  const resolvedLanguage = resolveReadLanguage({
    languages: preferredLanguages,
    supportLanguages: row.supportLanguages,
  });
  return resolvedLanguage
    ? (translations.find((tr) => tr.language === resolvedLanguage) ?? null)
    : (translations[0] ?? null);
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function translationImageUrl(translation: { extra?: unknown }): string | null {
  const extra = translation?.extra;
  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    const coverUrl = (extra as Record<string, unknown>).coverUrl;
    if (typeof coverUrl === "string" && coverUrl.length > 0) return coverUrl;
  }
  return null;
}

function mapUnitToSectionItem(
  row: TranslatedUnitRow,
  preferredLanguages: readonly string[] = [],
): ZoneSectionItem {
  const translation = preferredTranslation(row, preferredLanguages);
  return {
    unitId: row.id,
    type: (row.type ?? "POST") as UnitType,
    slug: row.slug ?? null,
    title: translation?.title ?? null,
    summary: translation?.summary ?? null,
    language: (translation?.language ?? null) as Language | null,
    imageUrl: translation ? translationImageUrl(translation) : null,
    postKind: row.post?.kind ?? null,
    entityKind: row.entity?.kind ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function sectionItemToStreamUnit(item: ZoneSectionItem) {
  return {
    unitId: item.unitId,
    type: item.type,
    slug: item.slug ?? null,
    title: item.title ?? null,
    coverUrl: item.imageUrl ?? null,
    description: item.summary ?? null,
    createdAt: item.createdAt,
  };
}

// ANCHOR: zone reference collection
// ANCHOR: 专区引用收集

export type ZoneRefAccumulator = {
  labelUnitIds: Set<string>;
  realmUnitIds: Set<string>;
  fragmentUnitIds: Set<string>;
  targetUnitIds: Set<string>;
};

function collectMenuNodeRefs(node: ZoneMenuNode, refs: ZoneRefAccumulator) {
  pushIfPresent(refs.labelUnitIds, node.labelUnitId);
  if (node.target?.kind === "unit") refs.targetUnitIds.add(node.target.unitId);
  for (const child of node.children ?? []) collectMenuNodeRefs(child, refs);
}

function collectCollectionItemRefs(
  items: readonly ZoneCollectionItem[] | undefined,
  refs: ZoneRefAccumulator,
) {
  for (const item of items ?? []) {
    pushIfPresent(refs.labelUnitIds, item.labelUnitId);
    pushIfPresent(refs.targetUnitIds, item.displayUnitId);
    if (item.target.kind === "unit") refs.targetUnitIds.add(item.target.unitId);
  }
}

function collectLinkTargetRefs(
  target: ZoneCollectionItem["target"] | undefined,
  refs: ZoneRefAccumulator,
) {
  if (target?.kind === "unit") refs.targetUnitIds.add(target.unitId);
}

function collectQueryRefs(query: ZoneSectionQuery, refs: ZoneRefAccumulator) {
  if (query.realm && query.realm !== "context") {
    for (const id of query.realm.unitIds) refs.realmUnitIds.add(id);
  }
}

function collectContentSectionRefs(
  section: ZoneContentSection,
  refs: ZoneRefAccumulator,
) {
  pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
  switch (section.kind) {
    case "image":
      pushIfPresent(refs.labelUnitIds, section.altLabelUnitId);
      collectLinkTargetRefs(section.target, refs);
      break;
    case "actions":
      collectCollectionItemRefs(section.items, refs);
      break;
    case "richText":
      refs.fragmentUnitIds.add(section.contentUnitId);
      break;
    case "collection":
      collectCollectionItemRefs(section.items, refs);
      break;
    case "query":
      collectQueryRefs(section.query, refs);
      for (const option of section.dynamicTags?.options ?? []) {
        for (const tagUnitId of option.tagUnitIds) {
          refs.targetUnitIds.add(tagUnitId);
        }
      }
      break;
    case "feed":
    case "stats":
    case "sources":
      break;
  }
}

function collectStageChildSectionRefs(
  section: ZoneStageChildSection,
  refs: ZoneRefAccumulator,
) {
  if (section.kind === "zoneInfo") return;
  if (section.kind === "tabs") {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    for (const tab of section.tabs) {
      pushIfPresent(refs.labelUnitIds, tab.titleLabelUnitId);
      for (const inner of tab.sections) collectContentSectionRefs(inner, refs);
    }
    return;
  }
  if (section.kind === "columns") {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    for (const column of section.columns) {
      for (const inner of column.sections) {
        if (inner.kind === "tabs") {
          collectStageChildSectionRefs(inner, refs);
        } else {
          collectContentSectionRefs(inner, refs);
        }
      }
    }
    return;
  }
  collectContentSectionRefs(section, refs);
}

function collectPageSectionRefs(
  section: ZonePageSection,
  refs: ZoneRefAccumulator,
) {
  if (section.kind === "stage") {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    for (const child of section.sections) {
      collectStageChildSectionRefs(child, refs);
    }
    return;
  }
  if (section.kind === "tabs") {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    for (const tab of section.tabs) {
      pushIfPresent(refs.labelUnitIds, tab.titleLabelUnitId);
      for (const inner of tab.sections) collectContentSectionRefs(inner, refs);
    }
    return;
  }
  if (section.kind === "columns") {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    for (const column of section.columns) {
      for (const inner of column.sections) {
        if (inner.kind === "tabs") {
          collectPageSectionRefs(inner, refs);
        } else {
          collectContentSectionRefs(inner, refs);
        }
      }
    }
    return;
  }
  collectContentSectionRefs(section, refs);
}

export function collectZoneRefs(input: {
  boundary: ZoneBoundary;
  nav: ZoneNav;
  theme: ZoneTheme;
  pages?: readonly ZonePageWithConfig[] | readonly { config: ZonePageConfig }[];
}): ZoneRefAccumulator {
  const refs: ZoneRefAccumulator = {
    labelUnitIds: new Set(),
    realmUnitIds: new Set(),
    fragmentUnitIds: new Set(),
    targetUnitIds: new Set(),
  };

  if (input.boundary.context.kind === "realm") {
    refs.realmUnitIds.add(input.boundary.context.realmUnitId);
  }
  if (
    input.boundary.filters.realm &&
    input.boundary.filters.realm !== "context"
  ) {
    for (const id of input.boundary.filters.realm.unitIds) {
      refs.realmUnitIds.add(id);
    }
  }
  pushIfPresent(refs.targetUnitIds, input.boundary.filters.targetUnitId);
  for (const menu of input.nav.menus) {
    for (const node of menu.nodes) collectMenuNodeRefs(node, refs);
  }
  for (const page of input.pages ?? []) {
    for (const section of page.config.sections) {
      collectPageSectionRefs(section, refs);
    }
  }

  return refs;
}

// ANCHOR: section traversal
// ANCHOR: 分区遍历

type LocatedSection =
  | { kind: "content"; section: ZoneContentSection }
  | { kind: "container"; section: ZonePageSection | ZoneStageChildSection };

function isZoneContentSection(
  section: ZonePageSection | ZoneStageChildSection,
): section is ZoneContentSection {
  switch (section.kind) {
    case "image":
    case "actions":
    case "richText":
    case "collection":
    case "query":
    case "feed":
    case "stats":
    case "sources":
      return true;
    case "stage":
    case "zoneInfo":
    case "tabs":
    case "columns":
      return false;
  }
}

function* iterateColumnSections(
  sections: readonly (
    | ZoneContentSection
    | Extract<ZonePageSection, { kind: "tabs" }>
  )[],
): Generator<{
  section: ZoneContentSection | Extract<ZonePageSection, { kind: "tabs" }>;
  container: boolean;
}> {
  for (const inner of sections) {
    yield { section: inner, container: inner.kind === "tabs" };
    if (inner.kind === "tabs") {
      for (const tab of inner.tabs) {
        for (const paneSection of tab.sections) {
          yield { section: paneSection, container: false };
        }
      }
    }
  }
}

function* iteratePageSections(page: ZonePageConfig): Generator<{
  section: ZonePageSection | ZoneStageChildSection;
  container: boolean;
}> {
  for (const section of page.sections) {
    yield {
      section,
      container: !isZoneContentSection(section),
    };
    if (section.kind === "stage") {
      for (const child of section.sections) {
        yield { section: child, container: !isZoneContentSection(child) };
        if (child.kind === "tabs") {
          for (const tab of child.tabs) {
            for (const inner of tab.sections) {
              yield { section: inner, container: false };
            }
          }
        }
        if (child.kind === "columns") {
          yield* iterateColumnSections(
            child.columns.flatMap((c) => c.sections),
          );
        }
      }
    }
    if (section.kind === "tabs") {
      for (const tab of section.tabs) {
        for (const inner of tab.sections) {
          yield { section: inner, container: false };
        }
      }
    }
    if (section.kind === "columns") {
      for (const column of section.columns) {
        yield* iterateColumnSections(column.sections);
      }
    }
  }
}

function findSectionById(
  page: ZonePageConfig,
  sectionId: string,
): LocatedSection | null {
  for (const { section, container } of iteratePageSections(page)) {
    if (section.id !== sectionId) continue;
    return container
      ? { kind: "container", section: section as ZonePageSection }
      : { kind: "content", section: section as ZoneContentSection };
  }
  return null;
}

function menuDepth(nodes: readonly ZoneMenuNode[]): number {
  let depth = 0;
  for (const node of nodes) {
    depth = Math.max(depth, 1 + (node.children ? menuDepth(node.children) : 0));
  }
  return depth;
}

function* iterateMenuNodes(
  nodes: readonly ZoneMenuNode[],
): Generator<ZoneMenuNode> {
  for (const node of nodes) {
    yield node;
    if (node.children) yield* iterateMenuNodes(node.children);
  }
}

function findNavPageReferences(nav: ZoneNav, pageId: string) {
  const references: Array<{ menuId: string; nodeId: string; path: string[] }> =
    [];
  const visit = (
    menuId: string,
    nodes: readonly ZoneMenuNode[],
    path: string[],
  ) => {
    for (const node of nodes) {
      const nextPath = [...path, node.id];
      if (node.target?.kind === "zonePage" && node.target.pageId === pageId) {
        references.push({ menuId, nodeId: node.id, path: nextPath });
      }
      if (node.children) visit(menuId, node.children, nextPath);
    }
  };
  for (const menu of nav.menus) visit(menu.id, menu.nodes, []);
  return references;
}

// ANCHOR: drizzle repository
// ANCHOR: drizzle 仓储

async function hydrateTranslatedUnits(
  unitIds: string[],
  options: { includeEntity?: boolean } = {},
): Promise<Map<string, TranslatedUnitRow>> {
  const uniqueIds = [...new Set(unitIds)];
  if (uniqueIds.length === 0) return new Map();
  const db = await getServerDb();
  const [units, translations, supportLanguages, posts, entities] =
    await Promise.all([
      db.select().from(Unit).where(inArray(Unit.id, uniqueIds)),
      db
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, uniqueIds)),
      db
        .select()
        .from(UnitSupportLanguage)
        .where(inArray(UnitSupportLanguage.unitId, uniqueIds)),
      db.select().from(Post).where(inArray(Post.unitId, uniqueIds)),
      options.includeEntity
        ? db.select().from(Entity).where(inArray(Entity.unitId, uniqueIds))
        : Promise.resolve([]),
    ]);

  const translationsByUnit = new Map<string, typeof translations>();
  for (const translation of translations) {
    const list = translationsByUnit.get(translation.unitId) ?? [];
    list.push(translation);
    translationsByUnit.set(translation.unitId, list);
  }

  const supportByUnit = new Map<string, typeof supportLanguages>();
  for (const language of supportLanguages) {
    const list = supportByUnit.get(language.unitId) ?? [];
    list.push(language);
    supportByUnit.set(language.unitId, list);
  }

  const postByUnit = new Map(posts.map((post) => [post.unitId, post]));
  const entityByUnit = new Map(
    entities.map((entity) => [entity.unitId, entity]),
  );

  return new Map(
    units.map((unit) => [
      unit.id,
      {
        id: unit.id,
        type: unit.type,
        slug: unit.slug,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        translations: translationsByUnit.get(unit.id) ?? [],
        supportLanguages: supportByUnit.get(unit.id) ?? [],
        post: postByUnit.get(unit.id) ?? null,
        entity: entityByUnit.get(unit.id) ?? null,
      } as TranslatedUnitRow,
    ]),
  );
}

export function parseZoneRowShell(
  zone: Pick<typeof Zone.$inferSelect, "unitId" | "boundary" | "nav" | "theme">,
): { boundary: ZoneBoundary; nav: ZoneNav; theme: ZoneTheme } {
  const boundary = parseZoneBoundary(zone.boundary);
  const nav = parseZoneNav(zone.nav);
  const theme = parseZoneTheme(zone.theme);
  if (!boundary || !nav || !theme) {
    // No old-shape compatibility (development-stage cutover); a row that fails
    // a split envelope needs a factory reseed, not a silent skip.
    throw new AppError(500, "Zone shell failed envelope validation", {
      code: "ZONE_SHELL_INVALID",
      details: { unitId: zone.unitId },
    });
  }
  return { boundary, nav, theme };
}

export function parseZonePageRowConfig(
  page: Pick<typeof ZonePage.$inferSelect, "id" | "config">,
): ZonePageConfig {
  const config = parseZonePage(page.config);
  if (!config) {
    throw new AppError(500, "Zone page failed envelope validation", {
      code: "ZONE_PAGE_INVALID",
      details: { pageId: page.id },
    });
  }
  return config;
}

async function hydrateZone(
  zone: typeof Zone.$inferSelect,
): Promise<ZoneWithRelations> {
  if (!zone.homePageId) {
    throw new AppError(500, "Zone is missing a home page", {
      code: "ZONE_HOME_PAGE_MISSING",
      details: { unitId: zone.unitId },
    });
  }
  const map = await hydrateTranslatedUnits([zone.unitId]);
  const unit = map.get(zone.unitId);
  const db = await getServerDb();
  const pages = await db
    .select()
    .from(ZonePage)
    .where(eq(ZonePage.zoneUnitId, zone.unitId))
    .orderBy(asc(ZonePage.position), asc(ZonePage.id));
  const shell = parseZoneRowShell(zone);
  return {
    ...zone,
    ...shell,
    pages: pages.map((page) => ({
      ...page,
      config: parseZonePageRowConfig(page),
    })),
    unit: unit ? ({ ...unit } as unknown as ZoneWithRelations["unit"]) : null,
  };
}

async function nextZonePagePosition(
  db: Pick<Awaited<ReturnType<typeof getServerDb>>, "select">,
  zoneUnitId: string,
): Promise<string> {
  const [last] = await db
    .select({ position: ZonePage.position })
    .from(ZonePage)
    .where(eq(ZonePage.zoneUnitId, zoneUnitId))
    .orderBy(desc(ZonePage.position), desc(ZonePage.id))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

function createDrizzleZoneRepository(): ZoneRepository {
  return {
    async findUnitRefs(ids) {
      if (ids.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(inArray(Unit.id, ids), ne(Unit.status, "DELETED")));
    },
    async findPostKinds(unitIds) {
      if (unitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ unitId: Post.unitId, kind: Post.kind })
        .from(Post)
        .where(inArray(Post.unitId, unitIds));
      return rows.map((row) => ({ unitId: row.unitId, kind: row.kind ?? "" }));
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      const [zone] = await db
        .select()
        .from(Zone)
        .where(eq(Zone.unitId, unitId))
        .limit(1);
      return zone ? hydrateZone(zone) : null;
    },
    async listSubscribedZoneIds(input) {
      const db = await getServerDb();
      const where = and(
        eq(UserSubscriptionListEntry.userUnitId, input.userUnitId),
        eq(UserSubscriptionListEntry.state, "ACTIVE"),
        eq(UserSubscriptionListEntry.subscribedType, "ZONE"),
        input.publicOnly ? ne(Unit.visibility, "PRIVATE") : undefined,
      );
      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: UserSubscriptionListEntry.subscribedUnitId })
          .from(UserSubscriptionListEntry)
          .innerJoin(
            Unit,
            eq(UserSubscriptionListEntry.subscribedUnitId, Unit.id),
          )
          .where(where)
          .orderBy(
            desc(UserSubscriptionListEntry.pinned),
            asc(UserSubscriptionListEntry.position),
            asc(UserSubscriptionListEntry.createdAt),
          )
          .offset(input.offset)
          .limit(input.limit),
        db
          .select({ total: count() })
          .from(UserSubscriptionListEntry)
          .innerJoin(
            Unit,
            eq(UserSubscriptionListEntry.subscribedUnitId, Unit.id),
          )
          .where(where),
      ]);
      return {
        unitIds: rows.map((row) => row.unitId),
        total: totalRows[0]?.total ?? 0,
      };
    },
    async listManageableZoneIds(input) {
      const db = await getServerDb();
      const manageRoles = ["owner", "admin", "moderator"] as const;
      const where = and(
        eq(RealmMember.userId, input.userUnitId),
        eq(RealmMember.state, "ACTIVE"),
        inArray(RealmMember.roleKey, [...manageRoles]),
        input.publicOnly ? ne(Unit.visibility, "PRIVATE") : undefined,
      );
      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: Zone.unitId })
          .from(Zone)
          .innerJoin(
            RealmMember,
            eq(Zone.ownerRealmUnitId, RealmMember.realmUnitId),
          )
          .innerJoin(Unit, eq(Zone.unitId, Unit.id))
          .where(where)
          .orderBy(desc(Unit.createdAt), asc(Zone.unitId))
          .offset(input.offset)
          .limit(input.limit),
        db
          .select({ total: count() })
          .from(Zone)
          .innerJoin(
            RealmMember,
            eq(Zone.ownerRealmUnitId, RealmMember.realmUnitId),
          )
          .innerJoin(Unit, eq(Zone.unitId, Unit.id))
          .where(where),
      ]);
      return {
        unitIds: rows.map((row) => row.unitId),
        total: totalRows[0]?.total ?? 0,
      };
    },
    async findPageBySlug(zoneUnitId, slug) {
      const db = await getServerDb();
      const [page] = await db
        .select()
        .from(ZonePage)
        .where(
          and(eq(ZonePage.zoneUnitId, zoneUnitId), eq(ZonePage.slug, slug)),
        )
        .limit(1);
      return page ? { ...page, config: parseZonePageRowConfig(page) } : null;
    },
    async getPage(zoneUnitId, pageId) {
      const db = await getServerDb();
      const [page] = await db
        .select()
        .from(ZonePage)
        .where(
          and(eq(ZonePage.zoneUnitId, zoneUnitId), eq(ZonePage.id, pageId)),
        )
        .limit(1);
      return page ? { ...page, config: parseZonePageRowConfig(page) } : null;
    },
    async findUnitBySlug(slugScope, slug) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id, type: Unit.type, visibility: Unit.visibility })
        .from(Unit)
        .where(and(eq(Unit.slugScope, slugScope), eq(Unit.slug, slug)))
        .limit(1);
      return unit ?? null;
    },
    async createZone(data) {
      const db = await getServerDb();
      const now = new Date();
      const created = await db.transaction(async (tx) => {
        const [zone] = await tx
          .insert(Zone)
          .values({
            unitId: data.unitId,
            ownerRealmUnitId: data.ownerRealmUnitId,
            boundary: data.boundary,
            nav: data.nav,
            theme: data.theme,
            startsAt: data.startsAt,
            endsAt: data.endsAt,
            updatedAt: now,
          })
          .returning();
        if (!zone) throw new AppError(500, "Failed to create zone");
        const [homePage] = await tx
          .insert(ZonePage)
          .values({
            zoneUnitId: data.unitId,
            slug: data.homePageSlug,
            position: generateBetween(undefined, undefined),
            config: data.homePage,
            updatedAt: now,
          })
          .returning();
        if (!homePage) throw new AppError(500, "Failed to create home page");
        const [updated] = await tx
          .update(Zone)
          .set({ homePageId: homePage.id, updatedAt: now })
          .where(eq(Zone.unitId, data.unitId))
          .returning();
        if (!updated) throw new AppError(500, "Failed to link home page");
        return updated;
      });
      return hydrateZone(created);
    },
    async updateZone(unitId, data) {
      const db = await getServerDb();
      const [zone] = await db
        .update(Zone)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(Zone.unitId, unitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async updateZoneBoundary(unitId, boundary) {
      const db = await getServerDb();
      const [zone] = await db
        .update(Zone)
        .set({ boundary, updatedAt: new Date() })
        .where(eq(Zone.unitId, unitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async updateZoneNav(unitId, nav) {
      const db = await getServerDb();
      const [zone] = await db
        .update(Zone)
        .set({ nav, updatedAt: new Date() })
        .where(eq(Zone.unitId, unitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async updateZoneTheme(unitId, theme) {
      const db = await getServerDb();
      const [zone] = await db
        .update(Zone)
        .set({ theme, updatedAt: new Date() })
        .where(eq(Zone.unitId, unitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async createPage(zoneUnitId, data) {
      const db = await getServerDb();
      const [page] = await db
        .insert(ZonePage)
        .values({
          zoneUnitId,
          slug: data.slug,
          position:
            data.position ?? (await nextZonePagePosition(db, zoneUnitId)),
          config: data.config,
          updatedAt: new Date(),
        })
        .returning();
      if (!page) throw new AppError(500, "Failed to create zone page");
      const [zone] = await db
        .update(Zone)
        .set({ updatedAt: new Date() })
        .where(eq(Zone.unitId, zoneUnitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async updatePage(zoneUnitId, pageId, data) {
      const db = await getServerDb();
      const [page] = await db
        .update(ZonePage)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(eq(ZonePage.zoneUnitId, zoneUnitId), eq(ZonePage.id, pageId)),
        )
        .returning();
      if (!page) throw new AppError(404, "Zone page not found");
      const [zone] = await db
        .update(Zone)
        .set({ updatedAt: new Date() })
        .where(eq(Zone.unitId, zoneUnitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async deletePage(zoneUnitId, pageId) {
      const db = await getServerDb();
      await db
        .delete(ZonePage)
        .where(
          and(eq(ZonePage.zoneUnitId, zoneUnitId), eq(ZonePage.id, pageId)),
        );
      const [zone] = await db
        .update(Zone)
        .set({ updatedAt: new Date() })
        .where(eq(Zone.unitId, zoneUnitId))
        .returning();
      if (!zone) throw new AppError(404, "Zone not found");
      return hydrateZone(zone);
    },
    async replaceTranslations(unitId, translations) {
      const db = await getServerDb();
      const languages = translations.map((tr) => tr.language);
      await db.transaction(async (tx) => {
        await tx
          .delete(UnitTranslation)
          .where(
            and(
              eq(UnitTranslation.unitId, unitId),
              notInArray(UnitTranslation.language, languages),
            ),
          );
        await tx
          .delete(UnitSupportLanguage)
          .where(
            and(
              eq(UnitSupportLanguage.unitId, unitId),
              notInArray(UnitSupportLanguage.language, languages),
            ),
          );
        const positions = rebalance(translations.length);
        for (const [index, tr] of translations.entries()) {
          const description = tr.description
            ? markdownContentDoc(tr.description)
            : null;
          await tx
            .insert(UnitTranslation)
            .values({
              unitId,
              language: tr.language,
              title: tr.title ?? null,
              description,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UnitTranslation.unitId, UnitTranslation.language],
              set: {
                title: tr.title ?? null,
                description,
                updatedAt: new Date(),
              },
            });
          await tx
            .insert(UnitSupportLanguage)
            .values({
              unitId,
              language: tr.language,
              isPrimary: index === 0,
              position: positions[index]!,
            })
            .onConflictDoUpdate({
              target: [
                UnitSupportLanguage.unitId,
                UnitSupportLanguage.language,
              ],
              set: { isPrimary: index === 0, position: positions[index]! },
            });
        }
      });
    },
    async hydrateUnits(unitIds, options) {
      return hydrateTranslatedUnits(unitIds, options);
    },
    async findFragmentTranslations(unitId) {
      const db = await getServerDb();
      const rows = await db
        .select({
          language: ContentTranslation.language,
          content: ContentTranslation.content,
        })
        .from(ContentTranslation)
        .where(
          and(
            eq(ContentTranslation.unitId, unitId),
            eq(ContentTranslation.status, "PUBLISHED"),
          ),
        );
      return rows;
    },
    async searchSection(input) {
      const { searchClient } = await import("@/meili/search-client");
      const index =
        input.index === "content"
          ? searchClient.contentIndex
          : input.index === "zones"
            ? searchClient.zoneIndex
            : input.index === "realms"
              ? searchClient.realmIndex
              : searchClient.postIndex;
      const resp = await index.search<{ id: string }>("", {
        filter:
          input.filter.length > 0 ? input.filter.join(" AND ") : undefined,
        sort: input.sort,
        offset: input.offset,
        limit: input.limit,
      });
      return {
        ids: resp.hits.map((hit) => hit.id),
        total: resp.estimatedTotalHits ?? resp.hits.length,
      };
    },
    async countWikiArticles(realmUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ value: count() })
        .from(Unit)
        .innerJoin(Post, eq(Post.unitId, Unit.id))
        .innerJoin(UnitRealm, eq(UnitRealm.unitId, Unit.id))
        .where(
          and(
            eq(Unit.type, "POST"),
            eq(Unit.status, "PUBLISHED"),
            // PUBLIC only: UNLISTED zone fragments are not articles.
            // 仅 PUBLIC：UNLISTED 专区片段不算条目。
            eq(Unit.visibility, "PUBLIC"),
            eq(Unit.moderationStatus, "APPROVED"),
            eq(Post.kind, "WIKI"),
            eq(UnitRealm.realmUnitId, realmUnitId),
            eq(UnitRealm.moderationStatus, "APPROVED"),
          ),
        );
      return row?.value ?? 0;
    },
    async getRealmMemberCount(realmUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ memberCount: Realm.memberCount })
        .from(Realm)
        .where(eq(Realm.unitId, realmUnitId))
        .limit(1);
      return row?.memberCount ?? null;
    },
    async deleteUnit(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
  };
}

// ANCHOR: zone service
// ANCHOR: 专区服务

export class ZoneService {
  constructor(
    private readonly repository: ZoneRepository = createDrizzleZoneRepository(),
  ) {}

  private async assertUnitRefs(
    refs: Set<string>,
    expectedType: string,
    code: string,
    message: string,
  ): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await this.repository.findUnitRefs(ids);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const invalid = ids.filter((id) => byId.get(id)?.type !== expectedType);
    if (invalid.length > 0) {
      throw new AppError(400, message, {
        code,
        details: { ids: invalid, expectedType },
      });
    }
  }

  private async assertAnyUnitRefs(refs: Set<string>): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await this.repository.findUnitRefs(ids);
    const found = new Set(rows.map((row) => row.id));
    const invalid = ids.filter((id) => !found.has(id));
    if (invalid.length > 0) {
      throw new AppError(400, "Zone config references missing Units", {
        code: "ZONE_UNIT_REF_INVALID",
        details: { ids: invalid },
      });
    }
  }

  private async assertWikiFragments(refs: Set<string>): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const [unitRows, postRows] = await Promise.all([
      this.repository.findUnitRefs(ids),
      this.repository.findPostKinds(ids),
    ]);
    const typeById = new Map(unitRows.map((row) => [row.id, row.type]));
    const kindById = new Map(postRows.map((row) => [row.unitId, row.kind]));
    const invalid = ids.filter(
      (id) => typeById.get(id) !== "POST" || kindById.get(id) !== "WIKI",
    );
    if (invalid.length > 0) {
      throw new AppError(400, "richText sections require WIKI post fragments", {
        code: "ZONE_FRAGMENT_REF_INVALID",
        details: { ids: invalid },
      });
    }
  }

  private assertPageStructure(page: ZonePageConfig) {
    const fail = (
      code: string,
      message: string,
      details?: Record<string, unknown>,
    ) => {
      throw new AppError(400, message, { code, details });
    };

    // Section ids are page-local because section data routes include pageId.
    const sectionIds = new Set<string>();
    for (const { section } of iteratePageSections(page)) {
      if (sectionIds.has(section.id)) {
        fail(
          "ZONE_SECTION_ID_DUPLICATE",
          "Zone page section ids must be unique",
          {
            id: section.id,
          },
        );
      }
      sectionIds.add(section.id);
      if (section.kind === "tabs") {
        const tabIds = new Set(section.tabs.map((tab) => tab.id));
        if (tabIds.size !== section.tabs.length) {
          fail("ZONE_TAB_ID_DUPLICATE", "Zone tab ids must be unique", {
            sectionId: section.id,
          });
        }
        if (section.defaultTabId && !tabIds.has(section.defaultTabId)) {
          fail(
            "ZONE_TAB_DEFAULT_INVALID",
            "defaultTabId must reference one of the tabs",
            { sectionId: section.id, defaultTabId: section.defaultTabId },
          );
        }
      }
      if (section.kind === "query") {
        const unsupported = zoneSectionQueryUnsupportedFields(section.query);
        if (unsupported.length > 0) {
          fail(
            "ZONE_QUERY_FIELD_UNSUPPORTED",
            "Zone section query uses fields the target index cannot filter or sort",
            { sectionId: section.id, fields: unsupported },
          );
        }
        if (section.dynamicTags) {
          if (section.query.target !== "unit") {
            fail(
              "ZONE_DYNAMIC_TAG_TARGET_UNSUPPORTED",
              "Dynamic tag filters require a unit query",
              { sectionId: section.id },
            );
          }
          if (!dynamicTagsProbabilityValid(section.dynamicTags)) {
            fail(
              "ZONE_DYNAMIC_TAG_PROBABILITY_INVALID",
              "Dynamic tag probabilities must resolve to 1",
              {
                sectionId: section.id,
                total: dynamicTagsProbabilityTotal(section.dynamicTags),
              },
            );
          }
        }
      }
    }
  }

  private assertNavStructure(nav: ZoneNav) {
    const fail = (
      code: string,
      message: string,
      details?: Record<string, unknown>,
    ) => {
      throw new AppError(400, message, { code, details });
    };

    const menuIds = new Set<string>();
    for (const menu of nav.menus) {
      if (menuIds.has(menu.id)) {
        fail("ZONE_MENU_ID_DUPLICATE", "Zone menu ids must be unique", {
          id: menu.id,
        });
      }
      menuIds.add(menu.id);
      if (menuDepth(menu.nodes) > ZONE_MENU_MAX_DEPTH) {
        fail("ZONE_MENU_TOO_DEEP", "Zone menu trees are capped at depth 3", {
          menuId: menu.id,
        });
      }
      for (const node of iterateMenuNodes(menu.nodes)) {
        const isGroup = (node.children?.length ?? 0) > 0;
        // Leaves need a target; groups need something to resolve a label
        // from (labelUnitId or a unit target).
        // 叶子需要 target；分组需要可解析标签的来源（labelUnitId 或
        // unit target）。
        if (!isGroup && !node.target) {
          fail("ZONE_MENU_NODE_INVALID", "Leaf menu nodes require a target", {
            menuId: menu.id,
            nodeId: node.id,
          });
        }
        if (isGroup && !node.labelUnitId && !node.target) {
          fail(
            "ZONE_MENU_NODE_INVALID",
            "Group menu nodes require a labelUnitId or target to resolve a label",
            { menuId: menu.id, nodeId: node.id },
          );
        }
      }
    }
    if (!menuIds.has(nav.header.menuId)) {
      fail("ZONE_HEADER_MENU_INVALID", "header.menuId must reference a menu", {
        menuId: nav.header.menuId,
      });
    }
  }

  async validateZoneShell(input: {
    boundary: ZoneBoundary;
    nav: ZoneNav;
    theme: ZoneTheme;
  }): Promise<void> {
    this.assertNavStructure(input.nav);
    const refs = collectZoneRefs(input);
    await Promise.all([
      this.assertUnitRefs(
        refs.labelUnitIds,
        "LABEL",
        "ZONE_LABEL_REF_INVALID",
        "Zone config references invalid LABEL units",
      ),
      this.assertUnitRefs(
        refs.realmUnitIds,
        "REALM",
        "ZONE_REALM_REF_INVALID",
        "Zone config references invalid REALM units",
      ),
      this.assertWikiFragments(refs.fragmentUnitIds),
      this.assertAnyUnitRefs(refs.targetUnitIds),
    ]);
  }

  async validateZonePage(input: {
    boundary: ZoneBoundary;
    nav: ZoneNav;
    theme: ZoneTheme;
    page: ZonePageConfig;
  }): Promise<void> {
    this.assertPageStructure(input.page);
    const refs = collectZoneRefs({
      boundary: input.boundary,
      nav: input.nav,
      theme: input.theme,
      pages: [{ config: input.page }],
    });
    await Promise.all([
      this.assertUnitRefs(
        refs.labelUnitIds,
        "LABEL",
        "ZONE_LABEL_REF_INVALID",
        "Zone page references invalid LABEL units",
      ),
      this.assertUnitRefs(
        refs.realmUnitIds,
        "REALM",
        "ZONE_REALM_REF_INVALID",
        "Zone page references invalid REALM units",
      ),
      this.assertWikiFragments(refs.fragmentUnitIds),
      this.assertAnyUnitRefs(refs.targetUnitIds),
    ]);
  }

  async getByUnitId(unitId: string): Promise<ZoneWithRelations | null> {
    return this.repository.getByUnitId(unitId);
  }

  async listByUser(input: {
    userUnitId: string;
    view?: ZoneListView | null;
    publicOnly?: boolean;
    start?: number | string | null;
    limit?: number | string | null;
  }): Promise<{ zones: ZoneWithRelations[]; total: number }> {
    const offset = Math.max(0, Number(input.start ?? 0) || 0);
    const limit = Math.min(Math.max(Number(input.limit ?? 50) || 50, 1), 100);
    const list =
      (input.view ?? "subscribed") === "managing"
        ? await this.repository.listManageableZoneIds({
            userUnitId: input.userUnitId,
            publicOnly: input.publicOnly,
            offset,
            limit,
          })
        : await this.repository.listSubscribedZoneIds({
            userUnitId: input.userUnitId,
            publicOnly: input.publicOnly,
            offset,
            limit,
          });
    const zones = (
      await Promise.all(
        list.unitIds.map((unitId) => this.repository.getByUnitId(unitId)),
      )
    ).filter((zone): zone is ZoneWithRelations => Boolean(zone));
    return { zones, total: list.total };
  }

  async getBySlug(slug: string): Promise<ZoneWithRelations | null> {
    const { getSlugScopeId } = await import("@/infra/slug-scopes");
    const zoneScope = getSlugScopeId("zone");
    if (!zoneScope) return null;
    const unit = await this.repository.findUnitBySlug(zoneScope, slug);
    if (!unit || unit.type !== "ZONE") return null;
    return this.repository.getByUnitId(unit.id);
  }

  async getPageBySlug(
    zoneUnitId: string,
    pageSlug: string,
  ): Promise<ZonePageWithConfig | null> {
    return this.repository.findPageBySlug(zoneUnitId, pageSlug);
  }

  /**
   * Check lifecycle constraints.
   * Returns null if accessible, or a reason string if not.
   */
  checkLifecycle(zone: ZoneWithRelations): string | null {
    const now = new Date();
    if (zone.startsAt && now < zone.startsAt) return "not_started";
    if (zone.endsAt && now > zone.endsAt) return "ended";
    return null;
  }

  async create(input: {
    userId: string;
    slug: string;
    translations: ZoneTranslation[];
    ownerRealmUnitId: string;
    boundary: ZoneBoundary;
    nav: ZoneNav;
    theme: ZoneTheme;
    homePage: ZonePageConfig;
    homePageSlug?: string;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<ZoneWithRelations> {
    await this.assertUnitRefs(
      new Set([input.ownerRealmUnitId]),
      "REALM",
      "ZONE_REALM_REF_INVALID",
      "Zone owner must be a REALM unit",
    );
    await this.validateZoneShell({
      boundary: input.boundary,
      nav: input.nav,
      theme: input.theme,
    });
    await this.validateZonePage({
      boundary: input.boundary,
      nav: input.nav,
      theme: input.theme,
      page: input.homePage,
    });

    const unit = await unitService.create({
      userId: input.userId,
      type: "ZONE",
      status: "PUBLISHED",
      translations: input.translations.map((tr) => ({
        language: tr.language as Language,
        title: tr.title,
        description: tr.description
          ? markdownContentDoc(tr.description)
          : undefined,
      })),
    });

    await unitService.setSlug(unit.id, input.slug);

    const zone = await this.repository.createZone({
      unitId: unit.id,
      ownerRealmUnitId: input.ownerRealmUnitId,
      boundary: input.boundary,
      nav: input.nav,
      theme: input.theme,
      homePage: input.homePage,
      homePageSlug: input.homePageSlug ?? "home",
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, zone.unitId);
    return zone;
  }

  async update(
    unitId: string,
    input: {
      ownerRealmUnitId?: string;
      translations?: ZoneTranslation[];
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<ZoneWithRelations> {
    if (input.ownerRealmUnitId) {
      await this.assertUnitRefs(
        new Set([input.ownerRealmUnitId]),
        "REALM",
        "ZONE_REALM_REF_INVALID",
        "Zone owner must be a REALM unit",
      );
    }
    if (input.translations) {
      if (input.translations.length === 0) {
        throw new AppError(400, "Zones require at least one translation", {
          code: "ZONE_TRANSLATIONS_EMPTY",
        });
      }
      await this.repository.replaceTranslations(unitId, input.translations);
    }
    const zone = await this.repository.updateZone(unitId, {
      ownerRealmUnitId: input.ownerRealmUnitId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, unitId);
    return zone;
  }

  async updateBoundary(
    unitId: string,
    boundary: ZoneBoundary,
  ): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(unitId);
    if (!current) throw new AppError(404, "Zone not found");
    await this.validateZoneShell({
      boundary,
      nav: current.nav,
      theme: current.theme,
    });
    for (const page of current.pages) {
      await this.validateZonePage({
        boundary,
        nav: current.nav,
        theme: current.theme,
        page: page.config,
      });
    }
    const zone = await this.repository.updateZoneBoundary(unitId, boundary);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, unitId);
    return zone;
  }

  async updateNav(unitId: string, nav: ZoneNav): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(unitId);
    if (!current) throw new AppError(404, "Zone not found");
    await this.validateZoneShell({
      boundary: current.boundary,
      nav,
      theme: current.theme,
    });
    const zone = await this.repository.updateZoneNav(unitId, nav);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, unitId);
    return zone;
  }

  async updateTheme(
    unitId: string,
    theme: ZoneTheme,
  ): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(unitId);
    if (!current) throw new AppError(404, "Zone not found");
    await this.validateZoneShell({
      boundary: current.boundary,
      nav: current.nav,
      theme,
    });
    const zone = await this.repository.updateZoneTheme(unitId, theme);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, unitId);
    return zone;
  }

  async createPage(
    zoneUnitId: string,
    input: ZonePageCreateData,
  ): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(zoneUnitId);
    if (!current) throw new AppError(404, "Zone not found");
    await this.validateZonePage({
      boundary: current.boundary,
      nav: current.nav,
      theme: current.theme,
      page: input.config,
    });
    const zone = await this.repository.createPage(zoneUnitId, input);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, zoneUnitId);
    return zone;
  }

  async updatePage(
    zoneUnitId: string,
    pageId: string,
    input: ZonePageUpdateData,
  ): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(zoneUnitId);
    if (!current) throw new AppError(404, "Zone not found");
    const page = current.pages.find((candidate) => candidate.id === pageId);
    if (!page) throw new AppError(404, "Zone page not found");
    if (input.config) {
      await this.validateZonePage({
        boundary: current.boundary,
        nav: current.nav,
        theme: current.theme,
        page: input.config,
      });
    }
    const zone = await this.repository.updatePage(zoneUnitId, pageId, input);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, zoneUnitId);
    return zone;
  }

  async deletePage(
    zoneUnitId: string,
    pageId: string,
  ): Promise<ZoneWithRelations> {
    const current = await this.getByUnitId(zoneUnitId);
    if (!current) throw new AppError(404, "Zone not found");
    if (current.homePageId === pageId) {
      throw new AppError(400, "Zone home page cannot be deleted", {
        code: "ZONE_HOME_PAGE_DELETE",
        details: { pageId },
      });
    }
    const references = findNavPageReferences(current.nav, pageId);
    if (references.length > 0) {
      throw new AppError(400, "Zone page is still referenced by navigation", {
        code: "ZONE_PAGE_NAV_REFERENCED",
        details: { pageId, references },
      });
    }
    const zone = await this.repository.deletePage(zoneUnitId, pageId);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneSync, zoneUnitId);
    return zone;
  }

  /**
   * Portal read: zone + batch summaries for every unit the config
   * references. List data is intentionally absent — it hydrates lazily per
   * section id via `getSectionData` (only the active tab pane fetches
   * initially).
   * 门户读取：专区 + 配置引用的每个 Unit 的批量摘要。列表数据有意缺席——
   * 它通过 `getSectionData` 按分区 id 惰性水合（初始只有活动标签页面板
   * 拉取）。
   */
  async getPortalRefUnits(
    zone: ZoneWithRelations,
    page: ZonePageWithConfig,
    options: { preferredLanguages?: string[] } = {},
  ): Promise<Record<string, ZoneSectionItem>> {
    const refs = collectZoneRefs({
      boundary: zone.boundary,
      nav: zone.nav,
      theme: zone.theme,
      pages: [page],
    });
    const ids = [
      ...refs.labelUnitIds,
      ...refs.realmUnitIds,
      ...refs.fragmentUnitIds,
      ...refs.targetUnitIds,
    ];
    const rows = await this.repository.hydrateUnits(ids, {
      includeEntity: true,
    });
    const out: Record<string, ZoneSectionItem> = {};
    for (const [id, row] of rows) {
      out[id] = mapUnitToSectionItem(row, options.preferredLanguages);
    }
    return out;
  }

  private feedSectionQuery(
    feedKind: "all" | "updates" | "reviews" | undefined,
  ): ZoneSectionQuery {
    // Feed sections are query presets over the posts index: the standalone
    // feed service keeps serving the zone /feed page, while sections share
    // the single compiled-query execution path (one renderer, one boundary
    // intersection).
    // feed 分区是 posts 索引上的查询预设：独立的 feed service 继续服务
    // 专区 /feed 页面，而分区共享单一的编译查询执行路径（单一渲染器、
    // 单一边界交集）。
    switch (feedKind) {
      case "reviews":
        return {
          target: "post",
          postKinds: ["REVIEW"],
          realm: "context",
          languages: "viewer",
          sort: { field: "createdAt", direction: "desc" },
        };
      case "updates":
        return {
          target: "post",
          realm: "context",
          languages: "viewer",
          sort: { field: "updatedAt", direction: "desc" },
        };
      default:
        return {
          target: "post",
          realm: "context",
          languages: "viewer",
          sort: { field: "hotScore", direction: "desc" },
        };
    }
  }

  private async executeQuerySection(input: {
    zone: ZoneWithRelations;
    pageId: string;
    sectionId: string;
    query: ZoneSectionQuery;
    output?: "items" | "stream";
    limit: number;
    cursor?: string | null;
    preferredLanguages?: string[];
    languageMode?: ListLanguageMode | null;
    dynamicTagUnitIds?: string[];
  }): Promise<ZoneSectionData> {
    const offset = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
    const boundary = input.zone.boundary;
    let query = input.query;
    if (input.dynamicTagUnitIds && input.dynamicTagUnitIds.length > 0) {
      if (query.target !== "unit") {
        throw new AppError(400, "Dynamic tag filters require a unit query", {
          code: "ZONE_DYNAMIC_TAG_TARGET_UNSUPPORTED",
          details: { sectionId: input.sectionId },
        });
      }
      // Dynamic tags are a transient execution-time filter chosen by the
      // frontend. They compose with saved tags as additional AND constraints.
      query = {
        ...query,
        tagUnitIds: [
          ...new Set([...(query.tagUnitIds ?? []), ...input.dynamicTagUnitIds]),
        ],
      };
    }
    const compiled = compileZoneSectionQuery(query, boundary.filters, {
      contextRealmUnitId:
        boundary.context.kind === "realm" ? boundary.context.realmUnitId : null,
      viewerLanguageCandidates: input.preferredLanguages ?? [],
      viewerLanguageMode: input.languageMode,
    });
    const result = await this.repository.searchSection({
      index: compiled.index,
      filter: compiled.filter,
      sort: compiled.sort,
      offset,
      limit: input.limit,
    });
    const rows = await this.repository.hydrateUnits(result.ids, {
      includeEntity: true,
    });
    const items = result.ids.flatMap((id) => {
      const row = rows.get(id);
      return row ? [mapUnitToSectionItem(row, input.preferredLanguages)] : [];
    });
    const nextOffset = offset + input.limit;
    if (input.output === "stream") {
      return {
        pageId: input.pageId,
        sectionId: input.sectionId,
        items: [],
        rows: await this.mapSectionItemsToStreamRows({
          ids: result.ids,
          items,
          query: input.query,
          preferredLanguages: input.preferredLanguages,
        }),
        nextCursor: nextOffset < result.total ? String(nextOffset) : null,
      };
    }
    return {
      pageId: input.pageId,
      sectionId: input.sectionId,
      items,
      nextCursor: nextOffset < result.total ? String(nextOffset) : null,
    };
  }

  private async mapSectionItemsToStreamRows(input: {
    ids: string[];
    items: ZoneSectionItem[];
    query: ZoneSectionQuery;
    preferredLanguages?: string[];
  }): Promise<StreamRow[]> {
    if (input.ids.length === 0 || input.items.length === 0) return [];
    const listLanguages = input.preferredLanguages?.join(",");

    if (input.query.target === "post") {
      const [{ postService }, { mapPostToDTO }] = await Promise.all([
        import("../post"),
        import("../post/post.mapper"),
      ]);
      const posts = await postService.list({
        ids: input.ids.join(","),
        limit: input.ids.length,
        languages: listLanguages,
      });
      const postById = new Map(posts.posts.map((post) => [post.unitId, post]));
      return input.ids.flatMap((id) => {
        const post = postById.get(id);
        return post
          ? [
              mapPostToStreamRow(
                mapPostToDTO(post, undefined, input.preferredLanguages ?? []),
                { reason: "zone-stream-post" },
              ),
            ]
          : [];
      });
    }

    const bookIds = input.items
      .filter((item) => item.type === "BOOK")
      .map((item) => item.unitId);
    const { bookService, mapBookToDTO } =
      bookIds.length > 0
        ? await import("../book")
        : { bookService: null, mapBookToDTO: null };
    const books =
      bookIds.length > 0 && bookService
        ? await bookService.list({
            ids: bookIds.join(","),
            limit: bookIds.length,
            languages: listLanguages,
          })
        : { books: [] };
    const bookById = new Map(books.books.map((book) => [book.unitId, book]));

    const streamRows: StreamRow[] = [];
    for (const item of input.items) {
      const book = bookById.get(item.unitId);
      if (book && mapBookToDTO) {
        streamRows.push(
          mapBookToStreamRow(
            mapBookToDTO(book, { languages: input.preferredLanguages ?? [] }),
            "zone-stream-book",
          ),
        );
        continue;
      }
      streamRows.push(
        mapUnitToStreamRow(sectionItemToStreamUnit(item), "zone-stream-unit"),
      );
    }
    return streamRows;
  }

  async getSectionData(
    unitId: string,
    pageId: string,
    sectionId: string,
    options: {
      cursor?: string | null;
      preferredLanguages?: string[];
      languageMode?: ListLanguageMode | null;
      dynamicTagUnitIds?: string[];
    } = {},
  ): Promise<ZoneSectionData | null> {
    const zone = await this.getByUnitId(unitId);
    if (!zone) return null;
    const page = await this.repository.getPage(unitId, pageId);
    if (!page) return null;
    const located = findSectionById(page.config, sectionId);
    if (!located) return null;
    if (located.kind === "container") {
      // Tabs/columns have no data of their own; panes resolve through the
      // section ids they contain.
      // tabs/columns 自身没有数据；面板通过其包含的分区 id 解析。
      throw new AppError(400, "Container sections have no section data", {
        code: "ZONE_SECTION_NO_DATA",
        details: { sectionId },
      });
    }
    const section = located.section;

    switch (section.kind) {
      case "query":
        return this.executeQuerySection({
          zone,
          pageId,
          sectionId,
          query: section.query,
          output: section.display === "stream" ? "stream" : "items",
          limit: sectionLimit(section),
          cursor: options.cursor,
          preferredLanguages: options.preferredLanguages,
          languageMode: options.languageMode,
          dynamicTagUnitIds: options.dynamicTagUnitIds,
        });
      case "feed":
        return this.executeQuerySection({
          zone,
          pageId,
          sectionId,
          query: this.feedSectionQuery(section.feedKind),
          output: "stream",
          limit: sectionLimit(section),
          cursor: options.cursor,
          preferredLanguages: options.preferredLanguages,
          languageMode: options.languageMode,
        });
      case "collection": {
        const unitIds = section.items.flatMap((item) =>
          item.displayUnitId
            ? [item.displayUnitId]
            : item.target.kind === "unit"
              ? [item.target.unitId]
              : [],
        );
        const rows = await this.repository.hydrateUnits(unitIds, {
          includeEntity: true,
        });
        const items = unitIds.flatMap((id) => {
          const row = rows.get(id);
          return row
            ? [mapUnitToSectionItem(row, options.preferredLanguages)]
            : [];
        });
        return { pageId, sectionId, items, nextCursor: null };
      }
      case "richText": {
        const translations = await this.repository.findFragmentTranslations(
          section.contentUnitId,
        );
        const positions = rebalance(translations.length);
        const resolvedLanguage = resolveReadLanguage({
          languages: options.preferredLanguages ?? [],
          supportLanguages: translations.map((row, index) => ({
            language: row.language,
            isPrimary: index === 0,
            position: positions[index]!,
          })),
        });
        const translation =
          translations.find((row) => row.language === resolvedLanguage) ??
          translations[0] ??
          null;
        return {
          pageId,
          sectionId,
          items: [],
          doc: (translation?.content as ContentDoc | null) ?? null,
          docLanguage: (translation?.language ?? null) as Language | null,
          nextCursor: null,
        };
      }
      case "stats": {
        const contextRealmUnitId =
          zone.boundary.context.kind === "realm"
            ? zone.boundary.context.realmUnitId
            : null;
        const stats: { articles?: number; members?: number } = {};
        if (contextRealmUnitId) {
          if (section.metrics.includes("articles")) {
            stats.articles =
              await this.repository.countWikiArticles(contextRealmUnitId);
          }
          if (section.metrics.includes("members")) {
            stats.members =
              (await this.repository.getRealmMemberCount(contextRealmUnitId)) ??
              undefined;
          }
        }
        return { pageId, sectionId, items: [], stats, nextCursor: null };
      }
      case "image":
      case "actions":
      case "sources":
        throw new AppError(400, "Display sections have no section data", {
          code: "ZONE_SECTION_NO_DATA",
          details: { sectionId, kind: section.kind },
        });
      default:
        throw new AppError(400, "Unsupported section data kind", {
          code: "ZONE_SECTION_NO_DATA",
          details: { sectionId, kind: section.kind },
        });
    }
  }

  async delete(unitId: string): Promise<void> {
    await this.repository.deleteUnit(unitId);
    await enqueueZoneSearch(SEARCH_COMMAND_KINDS.zoneDelete, unitId);
  }
}

export const zoneService = new ZoneService();
