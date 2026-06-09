import {
  type ContentDoc,
  type Language,
  mainMarkdownSource,
  markdownContentDoc,
  parseZoneConfig,
  resolveReadLanguage,
  type UnitType,
  ZONE_MENU_MAX_DEPTH,
  type ZoneCollectionItem,
  type ZoneConfig,
  type ZoneContentSection,
  type ZoneMenuNode,
  type ZonePageSection,
  type ZoneSectionData,
  type ZoneSectionItem,
  type ZoneSectionQuery,
  type ZoneTranslation,
} from "@rezics/contract";
import { and, count, eq, inArray, ne, notInArray } from "drizzle-orm";
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
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
  Zone,
} from "../db/schema";

const SECTION_DEFAULT_LIMIT = 12;

export type ZoneWithRelations = Omit<typeof Zone.$inferSelect, "config"> & {
  config: ZoneConfig;
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
    sortOrder?: number;
  }>;
  post?: { kind?: string | null } | null;
  entity?: { kind?: string | null } | null;
};

type ZoneCreateData = {
  unitId: string;
  ownerRealmUnitId: string;
  config: ZoneConfig;
  startsAt: Date | null;
  endsAt: Date | null;
};

type ZoneUpdateData = Partial<{
  ownerRealmUnitId: string;
  config: ZoneConfig;
  startsAt: Date | null;
  endsAt: Date | null;
}>;

export type ZoneRepository = {
  findUnitRefs(ids: string[]): Promise<UnitRef[]>;
  // Post kinds for richText fragment refs (POST units only).
  // richText 片段引用的 Post kind（仅 POST Unit）。
  findPostKinds(
    unitIds: string[],
  ): Promise<Array<{ unitId: string; kind: string }>>;
  getByUnitId(unitId: string): Promise<ZoneWithRelations | null>;
  findUnitBySlug(
    slugScope: string,
    slug: string,
  ): Promise<{ id: string; type: string; visibility: string } | null>;
  createZone(data: ZoneCreateData): Promise<ZoneWithRelations>;
  updateZone(unitId: string, data: ZoneUpdateData): Promise<ZoneWithRelations>;
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
    index: "content" | "posts";
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

function sectionLimit(section: { limit?: number }): number {
  return Math.min(Math.max(section.limit ?? SECTION_DEFAULT_LIMIT, 1), 100);
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

// ANCHOR: config reference collection
// ANCHOR: 配置引用收集

export type ZoneConfigRefs = {
  labelUnitIds: Set<string>;
  imageUnitIds: Set<string>;
  realmUnitIds: Set<string>;
  fragmentUnitIds: Set<string>;
  targetUnitIds: Set<string>;
};

function collectMenuNodeRefs(node: ZoneMenuNode, refs: ZoneConfigRefs) {
  pushIfPresent(refs.labelUnitIds, node.labelUnitId);
  if (node.target?.kind === "unit") refs.targetUnitIds.add(node.target.unitId);
  for (const child of node.children ?? []) collectMenuNodeRefs(child, refs);
}

function collectCollectionItemRefs(
  items: readonly ZoneCollectionItem[] | undefined,
  refs: ZoneConfigRefs,
) {
  for (const item of items ?? []) {
    pushIfPresent(refs.labelUnitIds, item.labelUnitId);
    if (item.target.kind === "unit") refs.targetUnitIds.add(item.target.unitId);
  }
}

function collectQueryRefs(query: ZoneSectionQuery, refs: ZoneConfigRefs) {
  if (query.realm && query.realm !== "context") {
    for (const id of query.realm.unitIds) refs.realmUnitIds.add(id);
  }
}

function collectContentSectionRefs(
  section: ZoneContentSection,
  refs: ZoneConfigRefs,
) {
  pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
  switch (section.kind) {
    case "hero":
      pushIfPresent(refs.imageUnitIds, section.bannerImageUnitId);
      pushIfPresent(refs.imageUnitIds, section.logoImageUnitId);
      collectCollectionItemRefs(section.ctas, refs);
      break;
    case "richText":
      refs.fragmentUnitIds.add(section.contentUnitId);
      break;
    case "collection":
      collectCollectionItemRefs(section.items, refs);
      break;
    case "query":
      collectQueryRefs(section.query, refs);
      break;
    case "feed":
    case "stats":
      break;
  }
}

function collectPageSectionRefs(
  section: ZonePageSection,
  refs: ZoneConfigRefs,
) {
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
    for (const inner of [...section.side, ...section.main]) {
      if (inner.kind === "tabs") {
        collectPageSectionRefs(inner, refs);
      } else {
        collectContentSectionRefs(inner, refs);
      }
    }
    return;
  }
  collectContentSectionRefs(section, refs);
}

export function collectZoneConfigRefs(config: ZoneConfig): ZoneConfigRefs {
  const refs: ZoneConfigRefs = {
    labelUnitIds: new Set(),
    imageUnitIds: new Set(),
    realmUnitIds: new Set(),
    fragmentUnitIds: new Set(),
    targetUnitIds: new Set(),
  };

  if (config.context.kind === "realm") {
    refs.realmUnitIds.add(config.context.realmUnitId);
  }
  if (config.filters.realm && config.filters.realm !== "context") {
    for (const id of config.filters.realm.unitIds) refs.realmUnitIds.add(id);
  }
  pushIfPresent(refs.targetUnitIds, config.filters.targetUnitId);
  for (const menu of config.menus) {
    for (const node of menu.nodes) collectMenuNodeRefs(node, refs);
  }
  pushIfPresent(refs.imageUnitIds, config.header.logoImageUnitId);
  for (const page of [
    config.pages.home,
    config.pages.search,
    config.pages.feed,
  ]) {
    for (const section of page?.sections ?? []) {
      collectPageSectionRefs(section, refs);
    }
  }
  pushIfPresent(refs.imageUnitIds, config.theme.images?.logoUnitId);
  pushIfPresent(refs.imageUnitIds, config.theme.images?.bannerUnitId);
  pushIfPresent(refs.imageUnitIds, config.theme.images?.backgroundUnitId);

  return refs;
}

// ANCHOR: section traversal
// ANCHOR: 分区遍历

type LocatedSection =
  | { kind: "content"; section: ZoneContentSection }
  | { kind: "container"; section: ZonePageSection };

function* iterateConfigSections(config: ZoneConfig): Generator<{
  section: ZonePageSection | ZoneContentSection;
  container: boolean;
}> {
  for (const page of [
    config.pages.home,
    config.pages.search,
    config.pages.feed,
  ]) {
    for (const section of page?.sections ?? []) {
      yield {
        section,
        container: section.kind === "tabs" || section.kind === "columns",
      };
      if (section.kind === "tabs") {
        for (const tab of section.tabs) {
          for (const inner of tab.sections) {
            yield { section: inner, container: false };
          }
        }
      }
      if (section.kind === "columns") {
        for (const inner of [...section.side, ...section.main]) {
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
    }
  }
}

function findSectionById(
  config: ZoneConfig,
  sectionId: string,
): LocatedSection | null {
  for (const { section, container } of iterateConfigSections(config)) {
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

export function parseZoneRowConfig(
  zone: Pick<typeof Zone.$inferSelect, "unitId" | "config">,
): ZoneConfig {
  const config = parseZoneConfig(zone.config);
  if (!config) {
    // No old-shape compatibility (development-stage cutover); a row that
    // fails the envelope union needs a factory reseed, not a silent skip.
    // 不兼容旧形态（开发阶段切换）；未通过信封联合校验的行需要工厂重播种，
    // 而不是静默跳过。
    throw new AppError(500, "Zone config failed envelope validation", {
      code: "ZONE_CONFIG_INVALID",
      details: { unitId: zone.unitId },
    });
  }
  return config;
}

async function hydrateZone(
  zone: typeof Zone.$inferSelect,
): Promise<ZoneWithRelations> {
  const map = await hydrateTranslatedUnits([zone.unitId]);
  const unit = map.get(zone.unitId);
  return {
    ...zone,
    config: parseZoneRowConfig(zone),
    unit: unit ? ({ ...unit } as unknown as ZoneWithRelations["unit"]) : null,
  };
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
      const [zone] = await db
        .insert(Zone)
        .values({ ...data, updatedAt: now })
        .returning();
      if (!zone) throw new AppError(500, "Failed to create zone");
      return hydrateZone(zone);
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
              sortOrder: index,
            })
            .onConflictDoUpdate({
              target: [
                UnitSupportLanguage.unitId,
                UnitSupportLanguage.language,
              ],
              set: { isPrimary: index === 0, sortOrder: index },
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

  private assertConfigStructure(config: ZoneConfig) {
    const fail = (
      code: string,
      message: string,
      details?: Record<string, unknown>,
    ) => {
      throw new AppError(400, message, { code, details });
    };

    // Section ids unique across the whole config (containers included).
    // 分区 id 在整个配置内唯一（包含容器）。
    const sectionIds = new Set<string>();
    for (const { section } of iterateConfigSections(config)) {
      if (sectionIds.has(section.id)) {
        fail("ZONE_SECTION_ID_DUPLICATE", "Zone section ids must be unique", {
          id: section.id,
        });
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
      }
    }

    const menuIds = new Set<string>();
    for (const menu of config.menus) {
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
    if (!menuIds.has(config.header.menuId)) {
      fail("ZONE_HEADER_MENU_INVALID", "header.menuId must reference a menu", {
        menuId: config.header.menuId,
      });
    }
  }

  async validateZoneConfig(config: ZoneConfig): Promise<void> {
    this.assertConfigStructure(config);
    const refs = collectZoneConfigRefs(config);
    await Promise.all([
      this.assertUnitRefs(
        refs.labelUnitIds,
        "LABEL",
        "ZONE_LABEL_REF_INVALID",
        "Zone config references invalid LABEL units",
      ),
      this.assertUnitRefs(
        refs.imageUnitIds,
        "IMAGE",
        "ZONE_IMAGE_REF_INVALID",
        "Zone config references invalid IMAGE units",
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

  async getByUnitId(unitId: string): Promise<ZoneWithRelations | null> {
    return this.repository.getByUnitId(unitId);
  }

  async getBySlug(slug: string): Promise<ZoneWithRelations | null> {
    const { getSlugScopeId } = await import("@/infra/slug-scopes");
    const zoneScope = getSlugScopeId("zone");
    if (!zoneScope) return null;
    const unit = await this.repository.findUnitBySlug(zoneScope, slug);
    if (!unit || unit.type !== "ZONE") return null;
    return this.repository.getByUnitId(unit.id);
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
    config: ZoneConfig;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<ZoneWithRelations> {
    await this.assertUnitRefs(
      new Set([input.ownerRealmUnitId]),
      "REALM",
      "ZONE_REALM_REF_INVALID",
      "Zone owner must be a REALM unit",
    );
    await this.validateZoneConfig(input.config);

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

    return this.repository.createZone({
      unitId: unit.id,
      ownerRealmUnitId: input.ownerRealmUnitId,
      config: input.config,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });
  }

  async update(
    unitId: string,
    input: {
      ownerRealmUnitId?: string;
      translations?: ZoneTranslation[];
      config?: ZoneConfig;
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
    if (input.config) {
      await this.validateZoneConfig(input.config);
    }
    if (input.translations) {
      if (input.translations.length === 0) {
        throw new AppError(400, "Zones require at least one translation", {
          code: "ZONE_TRANSLATIONS_EMPTY",
        });
      }
      await this.repository.replaceTranslations(unitId, input.translations);
    }
    return this.repository.updateZone(unitId, {
      ownerRealmUnitId: input.ownerRealmUnitId,
      config: input.config,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });
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
    options: { preferredLanguages?: string[] } = {},
  ): Promise<Record<string, ZoneSectionItem>> {
    const refs = collectZoneConfigRefs(zone.config);
    const ids = [
      ...refs.labelUnitIds,
      ...refs.imageUnitIds,
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
          sort: { field: "createdAt", direction: "desc" },
        };
      case "updates":
        return {
          target: "post",
          realm: "context",
          sort: { field: "updatedAt", direction: "desc" },
        };
      default:
        return {
          target: "post",
          realm: "context",
          sort: { field: "hotScore", direction: "desc" },
        };
    }
  }

  private async executeQuerySection(input: {
    zone: ZoneWithRelations;
    sectionId: string;
    query: ZoneSectionQuery;
    limit: number;
    cursor?: string | null;
    preferredLanguages?: string[];
  }): Promise<ZoneSectionData> {
    const offset = input.cursor ? Number.parseInt(input.cursor, 10) || 0 : 0;
    const config = input.zone.config;
    const compiled = compileZoneSectionQuery(input.query, config.filters, {
      contextRealmUnitId:
        config.context.kind === "realm" ? config.context.realmUnitId : null,
      viewerLanguageCandidates: input.preferredLanguages ?? [],
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
    return {
      sectionId: input.sectionId,
      items,
      nextCursor: nextOffset < result.total ? String(nextOffset) : null,
    };
  }

  async getSectionData(
    unitId: string,
    sectionId: string,
    options: { cursor?: string | null; preferredLanguages?: string[] } = {},
  ): Promise<ZoneSectionData | null> {
    const zone = await this.getByUnitId(unitId);
    if (!zone) return null;
    const located = findSectionById(zone.config, sectionId);
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
          sectionId,
          query: section.query,
          limit: sectionLimit(section),
          cursor: options.cursor,
          preferredLanguages: options.preferredLanguages,
        });
      case "feed":
        return this.executeQuerySection({
          zone,
          sectionId,
          query: this.feedSectionQuery(section.feedKind),
          limit: sectionLimit(section),
          cursor: options.cursor,
          preferredLanguages: options.preferredLanguages,
        });
      case "collection": {
        const unitIds = section.items.flatMap((item) =>
          item.target.kind === "unit" ? [item.target.unitId] : [],
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
        return { sectionId, items, nextCursor: null };
      }
      case "richText": {
        const translations = await this.repository.findFragmentTranslations(
          section.contentUnitId,
        );
        const resolvedLanguage = resolveReadLanguage({
          languages: options.preferredLanguages ?? [],
          supportLanguages: translations.map((row, sortOrder) => ({
            language: row.language,
            isPrimary: sortOrder === 0,
            sortOrder,
          })),
        });
        const translation =
          translations.find((row) => row.language === resolvedLanguage) ??
          translations[0] ??
          null;
        return {
          sectionId,
          items: [],
          doc: (translation?.content as ContentDoc | null) ?? null,
          docLanguage: (translation?.language ?? null) as Language | null,
          nextCursor: null,
        };
      }
      case "stats": {
        const contextRealmUnitId =
          zone.config.context.kind === "realm"
            ? zone.config.context.realmUnitId
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
        return { sectionId, items: [], stats, nextCursor: null };
      }
      case "hero":
        throw new AppError(400, "Hero sections have no section data", {
          code: "ZONE_SECTION_NO_DATA",
          details: { sectionId },
        });
    }
  }

  async delete(unitId: string): Promise<void> {
    await this.repository.deleteUnit(unitId);
  }
}

export const zoneService = new ZoneService();
