import {
  type Language,
  mainMarkdownSource,
  markdownContentDoc,
  resolveReadLanguage,
  type WikiZoneConfig,
  type WikiZoneHomepageData,
  type WikiZoneHomepageItem,
  type WikiZoneHomepageSection,
  type WikiZoneNavigationItem,
  type WikiZoneTranslatedLabel,
  type ZoneConfigVersion,
  type ZoneFilters,
  type ZonePages,
  type ZoneSection,
  type ZoneTheme,
} from "@rezics/contract";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { unitService } from "@/unit";
import { AppError } from "@/utils/errors";
import {
  ContentTranslation,
  Entity,
  Post,
  SubjectAttribution,
  Unit,
  UnitRealm,
  UnitSupportLanguage,
  UnitTranslation,
  Zone,
} from "../db/schema";

export type ZoneWithRelations = typeof Zone.$inferSelect & {
  unit?:
    | (typeof Unit.$inferSelect & {
        translations: (typeof UnitTranslation.$inferSelect)[];
        supportLanguages: (typeof UnitSupportLanguage.$inferSelect)[];
      })
    | null;
};

type UnitRef = { id: string; type: string };

const WIKI_HOMEPAGE_DEFAULT_TEMPLATE = "wiki-classic-home";
const WIKI_SECTION_DEFAULT_LIMIT = 12;
type TranslatedUnitRow = {
  id: string;
  type?: string;
  slug?: string | null;
  defaultLanguage?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  translations?: Array<{
    language?: string | null;
    title?: string | null;
    summary?: string | null;
    description?: unknown;
  }>;
  supportLanguages?: Array<{
    language: string;
    isPrimary?: boolean;
    sortOrder?: number;
  }>;
  contentTranslations?: Array<{ content?: unknown }>;
  post?: { kind?: string | null } | null;
  entity?: { kind?: string | null } | null;
};

type ZoneCreateData = {
  unitId: string;
  ownerRealmUnitId: string;
  filters: ZoneFilters;
  configVersion: ZoneConfigVersion;
  pages: ZonePages | null;
  sections: ZoneSection[] | null;
  theme: ZoneTheme | null;
  primaryRealmUnitId: string | null;
  template: string;
  styling: Record<string, unknown> | null;
  wiki: WikiZoneConfig | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

type ZoneUpdateData = Partial<{
  ownerRealmUnitId: string;
  filters: ZoneFilters;
  configVersion: ZoneConfigVersion;
  pages: ZonePages | null;
  sections: ZoneSection[] | null;
  theme: ZoneTheme | null;
  primaryRealmUnitId: string | null;
  template: string;
  styling: Record<string, unknown> | null;
  wiki: WikiZoneConfig | null;
  startsAt: Date | null;
  endsAt: Date | null;
}>;

export type ZoneRepository = {
  findUnitRefs(ids: string[]): Promise<UnitRef[]>;
  getByUnitId(unitId: string): Promise<ZoneWithRelations | null>;
  findUnitBySlug(
    slugScope: string,
    slug: string,
  ): Promise<{ id: string; type: string; visibility: string } | null>;
  createZone(data: ZoneCreateData): Promise<ZoneWithRelations>;
  updateZone(unitId: string, data: ZoneUpdateData): Promise<ZoneWithRelations>;
  findWikiPosts(input: {
    realmUnitId: string;
    unitIds?: string[];
    order: "created" | "updated";
    take: number;
    includeContent?: boolean;
  }): Promise<TranslatedUnitRow[]>;
  findTags(tagUnitIds: string[]): Promise<TranslatedUnitRow[]>;
  findEntitySection(input: {
    realmUnitId: string;
    subjectRoles?: string[];
    entityKinds?: string[];
    take: number;
  }): Promise<Array<{ entityId: string; entity: TranslatedUnitRow }>>;
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
  return Math.min(
    Math.max(section.limit ?? WIKI_SECTION_DEFAULT_LIMIT, 1),
    100,
  );
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
    : null;
}

function toIsoString(value: Date | string | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function mapUnitToWikiPostItem(
  row: TranslatedUnitRow,
  preferredLanguages: readonly string[] = [],
): WikiZoneHomepageItem {
  const translation = preferredTranslation(row, preferredLanguages);
  return {
    kind: "wikiPost",
    unitId: row.id,
    language: (translation?.language ?? null) as Language | null,
    title: translation?.title ?? null,
    summary: translation?.summary ?? null,
    createdAt: toIsoString(row.createdAt),
    updatedAt: toIsoString(row.updatedAt),
  };
}

function mapUnitToTagItem(
  row: TranslatedUnitRow,
  preferredLanguages: readonly string[] = [],
): WikiZoneHomepageItem {
  const translation = preferredTranslation(row, preferredLanguages);
  return {
    kind: "tag",
    tagUnitId: row.id,
    title: translation?.title ?? null,
    summary: translation?.summary ?? null,
  };
}

function mapUnitToEntityItem(
  row: TranslatedUnitRow,
  preferredLanguages: readonly string[] = [],
): WikiZoneHomepageItem {
  const translation = preferredTranslation(row, preferredLanguages);
  return {
    kind: "entity",
    entityUnitId: row.id,
    entityKind: row.entity?.kind ?? null,
    title: translation?.title ?? null,
    summary: translation?.summary ?? null,
  };
}

function assertTranslatedLabel(label: WikiZoneTranslatedLabel | undefined) {
  if (!label) return;
  if (Object.keys(label.translations).length === 0) {
    throw new AppError(400, "Wiki Zone manual labels require translations", {
      code: "WIKI_ZONE_MANUAL_LABEL_INVALID",
    });
  }
}

function collectNavigationRefs(input: {
  item: WikiZoneNavigationItem;
  entityIds: Set<string>;
  tagUnitIds: Set<string>;
  unitIds: Set<string>;
  labelUnitIds: Set<string>;
}) {
  switch (input.item.kind) {
    case "entity":
      input.entityIds.add(input.item.entityId);
      pushIfPresent(input.labelUnitIds, input.item.labelUnitId);
      break;
    case "tag":
      input.tagUnitIds.add(input.item.tagUnitId);
      pushIfPresent(input.labelUnitIds, input.item.labelUnitId);
      break;
    case "wikiUnit":
    case "unit":
      input.unitIds.add(input.item.unitId);
      pushIfPresent(input.labelUnitIds, input.item.labelUnitId);
      break;
    case "labelHeading":
      input.labelUnitIds.add(input.item.labelUnitId);
      break;
    case "external":
    case "manualLink":
      assertTranslatedLabel(input.item.label);
      break;
  }
}

async function hydrateTranslatedUnits(
  unitIds: string[],
  options: { includeContent?: boolean; includeEntity?: boolean } = {},
): Promise<Map<string, TranslatedUnitRow>> {
  const uniqueIds = [...new Set(unitIds)];
  if (uniqueIds.length === 0) return new Map();
  const db = await getServerDb();
  const [
    units,
    translations,
    supportLanguages,
    contentTranslations,
    posts,
    entities,
  ] = await Promise.all([
    db.select().from(Unit).where(inArray(Unit.id, uniqueIds)),
    db
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, uniqueIds)),
    db
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, uniqueIds)),
    options.includeContent
      ? db
          .select()
          .from(ContentTranslation)
          .where(inArray(ContentTranslation.unitId, uniqueIds))
      : Promise.resolve([]),
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

  const contentByUnit = new Map<string, Array<{ content?: unknown }>>();
  for (const translation of contentTranslations) {
    const list = contentByUnit.get(translation.unitId) ?? [];
    list.push({ content: translation.content });
    contentByUnit.set(translation.unitId, list);
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
        defaultLanguage: unit.defaultLanguage,
        createdAt: unit.createdAt,
        updatedAt: unit.updatedAt,
        translations: translationsByUnit.get(unit.id) ?? [],
        supportLanguages: supportByUnit.get(unit.id) ?? [],
        contentTranslations: contentByUnit.get(unit.id) ?? [],
        post: postByUnit.get(unit.id) ?? null,
        entity: entityByUnit.get(unit.id) ?? null,
      } as TranslatedUnitRow,
    ]),
  );
}

async function hydrateZone(
  zone: typeof Zone.$inferSelect,
): Promise<ZoneWithRelations> {
  const map = await hydrateTranslatedUnits([zone.unitId]);
  const unit = map.get(zone.unitId);
  return {
    ...zone,
    unit: unit
      ? ({
          ...unit,
        } as unknown as ZoneWithRelations["unit"])
      : null,
  };
}

function createDrizzleZoneRepository(): ZoneRepository {
  async function findWikiUnitIds(input: {
    realmUnitId: string;
    unitIds?: string[];
    order: "created" | "updated";
    take: number;
  }): Promise<string[]> {
    const db = await getServerDb();
    const conditions = [
      eq(Unit.type, "POST"),
      eq(Unit.status, "PUBLISHED"),
      eq(Unit.visibility, "PUBLIC"),
      eq(Unit.moderationStatus, "APPROVED"),
      eq(Post.kind, "WIKI"),
      eq(UnitRealm.realmUnitId, input.realmUnitId),
      eq(UnitRealm.moderationStatus, "APPROVED"),
    ];
    if (input.unitIds) conditions.push(inArray(Unit.id, input.unitIds));

    const rows = await db
      .select({ id: Unit.id })
      .from(Unit)
      .innerJoin(Post, eq(Post.unitId, Unit.id))
      .innerJoin(UnitRealm, eq(UnitRealm.unitId, Unit.id))
      .where(and(...conditions))
      .orderBy(
        input.order === "created" ? desc(Unit.createdAt) : desc(Unit.updatedAt),
        asc(Unit.id),
      )
      .limit(input.take);
    return rows.map((row) => row.id);
  }

  return {
    async findUnitRefs(ids) {
      if (ids.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({ id: Unit.id, type: Unit.type })
        .from(Unit)
        .where(and(inArray(Unit.id, ids), ne(Unit.status, "DELETED")));
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
    async findWikiPosts(input) {
      const ids = await findWikiUnitIds(input);
      const map = await hydrateTranslatedUnits(ids, {
        includeContent: input.includeContent,
      });
      return ids.flatMap((id) => {
        const row = map.get(id);
        return row ? [row] : [];
      });
    },
    async findTags(tagUnitIds) {
      if (tagUnitIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, tagUnitIds),
            eq(Unit.type, "TAG"),
            ne(Unit.status, "DELETED"),
          ),
        );
      const validIds = rows.map((row) => row.id);
      const map = await hydrateTranslatedUnits(validIds);
      return tagUnitIds.flatMap((id) => {
        const row = map.get(id);
        return row ? [row] : [];
      });
    },
    async findEntitySection(input) {
      const wikiUnitIds = await findWikiUnitIds({
        realmUnitId: input.realmUnitId,
        order: "updated",
        take: 1000,
      });
      if (wikiUnitIds.length === 0) return [];
      const db = await getServerDb();
      const conditions = [inArray(SubjectAttribution.unitId, wikiUnitIds)];
      if (input.subjectRoles?.length) {
        conditions.push(inArray(SubjectAttribution.role, input.subjectRoles));
      }
      const rows = await db
        .select({
          entityId: SubjectAttribution.entityId,
          sortOrder: SubjectAttribution.sortOrder,
        })
        .from(SubjectAttribution)
        .where(and(...conditions))
        .orderBy(
          asc(SubjectAttribution.sortOrder),
          asc(SubjectAttribution.entityId),
        )
        .limit(input.take * 3);
      const entityIds = [...new Set(rows.map((row) => row.entityId))];
      const entities = await hydrateTranslatedUnits(entityIds, {
        includeEntity: true,
      });
      const out: Array<{ entityId: string; entity: TranslatedUnitRow }> = [];
      for (const row of rows) {
        const entity = entities.get(row.entityId);
        if (!entity || entity.type !== "ENTITY") continue;
        if (
          input.entityKinds?.length &&
          !input.entityKinds.includes(entity.entity?.kind ?? "")
        ) {
          continue;
        }
        out.push({ entityId: row.entityId, entity });
        if (out.length >= input.take) break;
      }
      return out;
    },
    async deleteUnit(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
  };
}

export class ZoneService {
  constructor(
    private readonly repository: ZoneRepository = createDrizzleZoneRepository(),
  ) {}

  private async assertUnitRefs(
    refs: Set<string>,
    expectedType: string,
    code: string,
    message = "Wiki Zone config references invalid Units",
  ): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await this.repository.findUnitRefs(ids);
    const byId = new Map(rows.map((row: UnitRef) => [row.id, row]));
    const invalid = ids.filter((id) => byId.get(id)?.type !== expectedType);
    if (invalid.length > 0) {
      throw new AppError(400, message, {
        code,
        details: { ids: invalid, expectedType },
      });
    }
  }

  private async assertAnyUnitRefs(
    refs: Set<string>,
    message = "Wiki Zone config references missing Units",
    code = "WIKI_ZONE_UNIT_REF_INVALID",
  ): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await this.repository.findUnitRefs(ids);
    const found = new Set(rows.map((row: { id: string }) => row.id));
    const invalid = ids.filter((id) => !found.has(id));
    if (invalid.length > 0) {
      throw new AppError(400, message, {
        code,
        details: { ids: invalid },
      });
    }
  }

  private collectHomepageSectionRefs(
    section: WikiZoneHomepageSection,
    refs: {
      entityIds: Set<string>;
      tagUnitIds: Set<string>;
      unitIds: Set<string>;
      labelUnitIds: Set<string>;
    },
  ) {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    assertTranslatedLabel(section.title);

    if (section.kind === "tagCollection") {
      for (const id of section.tagUnitIds ?? []) refs.tagUnitIds.add(id);
      for (const id of section.realmTagUnitIds ?? []) refs.tagUnitIds.add(id);
      return;
    }

    if (section.kind === "wikiUnitCollection") {
      for (const id of section.unitIds) refs.unitIds.add(id);
      return;
    }

    if (section.kind === "manualLinks") {
      for (const item of section.links) {
        collectNavigationRefs({ item, ...refs });
      }
    }
  }

  private async validateWikiConfig(wiki: WikiZoneConfig | null | undefined) {
    if (!wiki) return;

    const entityIds = new Set<string>();
    const tagUnitIds = new Set<string>();
    const unitIds = new Set<string>();
    const labelUnitIds = new Set<string>();

    unitIds.add(wiki.filters.realmUnitId);
    for (const id of wiki.filters.tagUnitIds ?? []) tagUnitIds.add(id);
    for (const id of wiki.filters.realmTagUnitIds ?? []) tagUnitIds.add(id);
    for (const filter of wiki.filters.subjectFilters ?? []) {
      for (const id of filter.entityIds ?? []) entityIds.add(id);
    }
    for (const id of wiki.filters.wikiUnitIds ?? []) unitIds.add(id);

    for (const section of wiki.navigation?.sections ?? []) {
      pushIfPresent(labelUnitIds, section.labelUnitId);
      assertTranslatedLabel(section.label);
      for (const item of section.items) {
        collectNavigationRefs({
          item,
          entityIds,
          tagUnitIds,
          unitIds,
          labelUnitIds,
        });
      }
    }

    for (const section of wiki.homepage?.sections ?? []) {
      this.collectHomepageSectionRefs(section, {
        entityIds,
        tagUnitIds,
        unitIds,
        labelUnitIds,
      });
    }

    pushIfPresent(unitIds, wiki.theme?.media?.logoUnitId);
    pushIfPresent(unitIds, wiki.theme?.media?.bannerUnitId);
    pushIfPresent(unitIds, wiki.theme?.media?.backgroundUnitId);

    await Promise.all([
      this.assertUnitRefs(
        new Set([wiki.filters.realmUnitId]),
        "REALM",
        "WIKI_ZONE_REALM_REF_INVALID",
      ),
      this.assertUnitRefs(entityIds, "ENTITY", "WIKI_ZONE_ENTITY_REF_INVALID"),
      this.assertUnitRefs(tagUnitIds, "TAG", "WIKI_ZONE_TAG_REF_INVALID"),
      this.assertUnitRefs(labelUnitIds, "LABEL", "WIKI_ZONE_LABEL_REF_INVALID"),
      this.assertAnyUnitRefs(unitIds),
    ]);
  }

  private collectZoneFilterRefs(
    filters: ZoneFilters | undefined,
    refs: {
      entityIds: Set<string>;
      unitIds: Set<string>;
      realmUnitIds: Set<string>;
    },
  ) {
    pushIfPresent(refs.realmUnitIds, filters?.realmUnitId);
    for (const filter of filters?.subjectFilters ?? []) {
      for (const id of filter.entityIds ?? []) refs.entityIds.add(id);
    }
    for (const id of filters?.wikiUnitIds ?? []) refs.unitIds.add(id);
  }

  private collectWikiFilterRefs(
    filters: WikiZoneConfig["filters"] | undefined,
    refs: {
      entityIds: Set<string>;
      tagUnitIds: Set<string>;
      unitIds: Set<string>;
      realmUnitIds: Set<string>;
    },
  ) {
    pushIfPresent(refs.realmUnitIds, filters?.realmUnitId);
    for (const id of filters?.tagUnitIds ?? []) refs.tagUnitIds.add(id);
    for (const id of filters?.realmTagUnitIds ?? []) refs.tagUnitIds.add(id);
    for (const filter of filters?.subjectFilters ?? []) {
      for (const id of filter.entityIds ?? []) refs.entityIds.add(id);
    }
    for (const id of filters?.wikiUnitIds ?? []) refs.unitIds.add(id);
  }

  private collectZoneSectionRefs(
    section: ZoneSection,
    refs: {
      entityIds: Set<string>;
      tagUnitIds: Set<string>;
      unitIds: Set<string>;
      labelUnitIds: Set<string>;
      realmUnitIds: Set<string>;
    },
  ) {
    pushIfPresent(refs.labelUnitIds, section.titleLabelUnitId);
    assertTranslatedLabel(section.title);
    this.collectZoneFilterRefs(section.filters, refs);

    if (section.kind === "shelfCarousel") {
      for (const id of section.shelfUnitIds ?? []) refs.unitIds.add(id);
      return;
    }

    if (section.kind === "realmList") {
      for (const id of section.realmUnitIds ?? []) refs.realmUnitIds.add(id);
      return;
    }

    if (section.kind === "tagNavigation") {
      for (const id of section.tagUnitIds ?? []) refs.tagUnitIds.add(id);
      for (const id of section.realmTagUnitIds ?? []) refs.tagUnitIds.add(id);
      return;
    }

    if (section.kind === "wikiCollection") {
      for (const id of section.wikiUnitIds ?? []) refs.unitIds.add(id);
      this.collectWikiFilterRefs(section.wikiFilters, refs);
    }
  }

  private collectZonePageRefs(
    page: ZonePages[keyof ZonePages] | undefined,
    refs: Parameters<ZoneService["collectZoneSectionRefs"]>[1],
  ) {
    if (!page) return;
    pushIfPresent(refs.labelUnitIds, page.titleLabelUnitId);
    assertTranslatedLabel(page.title);
    for (const section of page.sections) {
      this.collectZoneSectionRefs(section, refs);
    }
  }

  private async validateZoneConfig(input: {
    ownerRealmUnitId?: string;
    primaryRealmUnitId?: string | null;
    pages?: ZonePages | null;
    sections?: ZoneSection[] | null;
    theme?: ZoneTheme | null;
  }) {
    const entityIds = new Set<string>();
    const tagUnitIds = new Set<string>();
    const unitIds = new Set<string>();
    const labelUnitIds = new Set<string>();
    const realmUnitIds = new Set<string>();

    // Ownership controls management authority only. Realm interaction context
    // must come from explicit realm routes, not from visiting a zone.
    pushIfPresent(realmUnitIds, input.ownerRealmUnitId);
    pushIfPresent(realmUnitIds, input.primaryRealmUnitId);
    this.collectZonePageRefs(input.pages?.home, {
      entityIds,
      tagUnitIds,
      unitIds,
      labelUnitIds,
      realmUnitIds,
    });
    this.collectZonePageRefs(input.pages?.search, {
      entityIds,
      tagUnitIds,
      unitIds,
      labelUnitIds,
      realmUnitIds,
    });
    this.collectZonePageRefs(input.pages?.feed, {
      entityIds,
      tagUnitIds,
      unitIds,
      labelUnitIds,
      realmUnitIds,
    });
    for (const section of input.sections ?? []) {
      this.collectZoneSectionRefs(section, {
        entityIds,
        tagUnitIds,
        unitIds,
        labelUnitIds,
        realmUnitIds,
      });
    }
    pushIfPresent(unitIds, input.theme?.images?.logoUnitId);
    pushIfPresent(unitIds, input.theme?.images?.bannerUnitId);
    pushIfPresent(unitIds, input.theme?.images?.backgroundUnitId);

    await Promise.all([
      this.assertUnitRefs(
        realmUnitIds,
        "REALM",
        "ZONE_REALM_REF_INVALID",
        "Zone config references invalid Realms",
      ),
      this.assertUnitRefs(
        entityIds,
        "ENTITY",
        "ZONE_ENTITY_REF_INVALID",
        "Zone config references invalid Entities",
      ),
      this.assertUnitRefs(
        tagUnitIds,
        "TAG",
        "ZONE_TAG_REF_INVALID",
        "Zone config references invalid Tags",
      ),
      this.assertUnitRefs(
        labelUnitIds,
        "LABEL",
        "ZONE_LABEL_REF_INVALID",
        "Zone config references invalid Labels",
      ),
      this.assertAnyUnitRefs(
        unitIds,
        "Zone config references missing Units",
        "ZONE_UNIT_REF_INVALID",
      ),
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

    if (zone.startsAt && now < zone.startsAt) {
      return "not_started";
    }

    if (zone.endsAt && now > zone.endsAt) {
      return "ended";
    }

    return null;
  }

  async create(input: {
    userId: string;
    slug: string;
    translations: Array<{
      language: string;
      title?: string;
      description?: string;
    }>;
    ownerRealmUnitId: string;
    filters: ZoneFilters;
    configVersion?: ZoneConfigVersion;
    pages?: ZonePages | null;
    sections?: ZoneSection[] | null;
    theme?: ZoneTheme | null;
    primaryRealmUnitId?: string | null;
    template: string;
    styling?: Record<string, unknown> | null;
    wiki?: WikiZoneConfig | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<ZoneWithRelations> {
    await this.validateZoneConfig({
      ownerRealmUnitId: input.ownerRealmUnitId,
      primaryRealmUnitId: input.primaryRealmUnitId,
      pages: input.pages,
      sections: input.sections,
      theme: input.theme,
    });
    await this.validateWikiConfig(input.wiki);

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
      filters: input.filters,
      configVersion: input.configVersion ?? 1,
      pages: input.pages ?? null,
      sections: input.sections ?? null,
      theme: input.theme ?? null,
      primaryRealmUnitId: input.primaryRealmUnitId ?? null,
      template: input.template,
      styling: input.styling ?? null,
      wiki: input.wiki ?? null,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    });

    return zone;
  }

  async update(
    unitId: string,
    input: {
      ownerRealmUnitId?: string;
      filters?: ZoneFilters;
      configVersion?: ZoneConfigVersion;
      pages?: ZonePages | null;
      sections?: ZoneSection[] | null;
      theme?: ZoneTheme | null;
      primaryRealmUnitId?: string | null;
      template?: string;
      styling?: Record<string, unknown> | null;
      wiki?: WikiZoneConfig | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<ZoneWithRelations> {
    await this.validateZoneConfig(input);
    await this.validateWikiConfig(input.wiki);

    const zone = await this.repository.updateZone(unitId, input);

    return zone;
  }

  private async hydrateWikiPostSection(input: {
    realmUnitId: string;
    section: WikiZoneHomepageSection;
    preferredLanguages?: string[];
    mode: "recent" | "updated" | "stub";
  }): Promise<WikiZoneHomepageItem[]> {
    const limit = sectionLimit(input.section);
    const rows = await this.repository.findWikiPosts({
      realmUnitId: input.realmUnitId,
      order: input.mode === "recent" ? "created" : "updated",
      take: input.mode === "stub" ? limit * 3 : limit,
      includeContent: input.mode === "stub",
    });

    const filtered =
      input.mode !== "stub"
        ? rows
        : rows.filter((row) => {
            const source = (row.contentTranslations ?? [])
              .map((translation) => mainMarkdownSource(translation.content))
              .find((value) => value !== null);
            if (input.section.kind !== "stubWiki") return false;
            if (input.section.predicate === "missing-body") return !source;
            return !source || source.length < 500;
          });

    return filtered
      .slice(0, limit)
      .map((row) => mapUnitToWikiPostItem(row, input.preferredLanguages));
  }

  private async hydrateWikiUnitSection(input: {
    realmUnitId: string;
    section: Extract<WikiZoneHomepageSection, { kind: "wikiUnitCollection" }>;
    preferredLanguages?: string[];
  }): Promise<WikiZoneHomepageItem[]> {
    const unitIds = input.section.unitIds;
    if (unitIds.length === 0) return [];

    const rows = await this.repository.findWikiPosts({
      realmUnitId: input.realmUnitId,
      unitIds,
      order: "created",
      take: unitIds.length,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return unitIds.flatMap((unitId) => {
      const row = byId.get(unitId);
      return row ? [mapUnitToWikiPostItem(row, input.preferredLanguages)] : [];
    });
  }

  private async hydrateTagSection(input: {
    section: Extract<WikiZoneHomepageSection, { kind: "tagCollection" }>;
    preferredLanguages?: string[];
  }): Promise<WikiZoneHomepageItem[]> {
    const tagUnitIds = [
      ...new Set([
        ...(input.section.tagUnitIds ?? []),
        ...(input.section.realmTagUnitIds ?? []),
      ]),
    ];
    if (tagUnitIds.length === 0) return [];

    const rows = await this.repository.findTags(tagUnitIds);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return tagUnitIds.flatMap((tagUnitId) => {
      const row = byId.get(tagUnitId);
      return row ? [mapUnitToTagItem(row, input.preferredLanguages)] : [];
    });
  }

  private async hydrateEntitySection(input: {
    realmUnitId: string;
    section: Extract<WikiZoneHomepageSection, { kind: "entityCollection" }>;
    preferredLanguages?: string[];
  }): Promise<WikiZoneHomepageItem[]> {
    const realmUnitId = input.section.realmUnitId ?? input.realmUnitId;
    const rows = await this.repository.findEntitySection({
      realmUnitId,
      subjectRoles: input.section.subjectRoles,
      entityKinds: input.section.entityKinds,
      take: sectionLimit(input.section) * 3,
    });

    const items: WikiZoneHomepageItem[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.entityId)) continue;
      seen.add(row.entityId);
      items.push(mapUnitToEntityItem(row.entity, input.preferredLanguages));
      if (items.length >= sectionLimit(input.section)) break;
    }
    return items;
  }

  private async hydrateHomepageSection(input: {
    realmUnitId: string;
    section: WikiZoneHomepageSection;
    preferredLanguages?: string[];
  }): Promise<WikiZoneHomepageItem[]> {
    switch (input.section.kind) {
      case "wikiUnitCollection":
        return this.hydrateWikiUnitSection({
          realmUnitId: input.realmUnitId,
          section: input.section,
          preferredLanguages: input.preferredLanguages,
        });
      case "tagCollection":
        return this.hydrateTagSection({
          section: input.section,
          preferredLanguages: input.preferredLanguages,
        });
      case "entityCollection":
        return this.hydrateEntitySection({
          realmUnitId: input.realmUnitId,
          section: input.section,
          preferredLanguages: input.preferredLanguages,
        });
      case "recentWiki":
        return this.hydrateWikiPostSection({ ...input, mode: "recent" });
      case "updatedWiki":
        return this.hydrateWikiPostSection({ ...input, mode: "updated" });
      case "stubWiki":
        return this.hydrateWikiPostSection({ ...input, mode: "stub" });
      case "manualLinks":
        return input.section.links.map((item) => ({
          kind: "navigationItem",
          item,
        }));
    }
  }

  async getWikiHomepageData(
    unitId: string,
    input: { preferredLanguages?: string[] } = {},
  ): Promise<WikiZoneHomepageData | null> {
    const zone = await this.getByUnitId(unitId);
    const wiki = zone?.wiki as WikiZoneConfig | null;
    if (!zone || !wiki) return null;

    const homepage = wiki.homepage;
    if (!homepage) {
      return {
        template:
          wiki.theme?.homepageTemplate ?? WIKI_HOMEPAGE_DEFAULT_TEMPLATE,
        sections: [],
      };
    }

    const sections = await Promise.all(
      homepage.sections.map(async (section) => ({
        section,
        items: await this.hydrateHomepageSection({
          realmUnitId: wiki.filters.realmUnitId,
          section,
          preferredLanguages: input.preferredLanguages,
        }),
      })),
    );

    return {
      template: homepage.template,
      sections,
    };
  }

  async delete(unitId: string): Promise<void> {
    await this.repository.deleteUnit(unitId);
  }
}

export const zoneService = new ZoneService();
