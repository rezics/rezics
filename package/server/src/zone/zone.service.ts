import {
  type Language,
  mainMarkdownSource,
  markdownContentDoc,
  type WikiZoneHomepageData,
  type WikiZoneHomepageItem,
  type WikiZoneHomepageSection,
  type WikiZoneNavigationItem,
  type WikiZoneTranslatedLabel,
  type WikiZoneConfig,
  type ZoneFilters,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { unitService } from "@/unit";
import { AppError } from "@/utils/errors";
import { translationGroupService } from "../translation-group/translation-group.service";

const zoneInclude = {
  unit: {
    include: {
      translations: true,
    },
  },
} satisfies Prisma.ZoneInclude;

export type ZoneWithRelations = Prisma.ZoneGetPayload<{
  include: typeof zoneInclude;
}>;

type UnitRef = { id: string; type: UnitType };

const WIKI_HOMEPAGE_DEFAULT_TEMPLATE = "wiki-classic-home";
const WIKI_SECTION_DEFAULT_LIMIT = 12;
const WIKI_EXCLUDED_MODERATION_STATES = [
  "HIDDEN",
  "TOMBSTONED",
  "ARCHIVED",
  "REMOVED",
] as const;

type TranslatedUnitRow = {
  id: string;
  defaultLanguage?: string | null;
  translationGroupId?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  translations?: Array<{
    language?: string | null;
    title?: string | null;
    summary?: string | null;
    description?: unknown;
  }>;
  post?: { content?: unknown } | null;
  entity?: { kind?: string | null } | null;
};

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
  return (
    preferredLanguages
      .map((language) => translations.find((tr) => tr.language === language))
      .find(Boolean) ??
    (row.defaultLanguage
      ? translations.find((tr) => tr.language === row.defaultLanguage)
      : undefined) ??
    translations[0] ??
    null
  );
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
    translationGroupId: row.translationGroupId ?? null,
    language: (translation?.language ??
      row.defaultLanguage ??
      null) as Language | null,
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
  translationGroupIds: Set<string>;
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
    case "translationGroup":
      input.translationGroupIds.add(input.item.translationGroupId);
      pushIfPresent(input.labelUnitIds, input.item.labelUnitId);
      break;
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

export class ZoneService {
  private async assertUnitRefs(
    refs: Set<string>,
    expectedType: UnitType,
    code: string,
  ): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await prisma.unit.findMany({
      where: {
        id: { in: ids },
        status: { not: UnitStatus.DELETED },
      },
      select: { id: true, type: true },
    });
    const byId = new Map(rows.map((row: UnitRef) => [row.id, row]));
    const invalid = ids.filter((id) => byId.get(id)?.type !== expectedType);
    if (invalid.length > 0) {
      throw new AppError(400, "Wiki Zone config references invalid Units", {
        code,
        details: { ids: invalid, expectedType },
      });
    }
  }

  private async assertAnyUnitRefs(refs: Set<string>): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await prisma.unit.findMany({
      where: {
        id: { in: ids },
        status: { not: UnitStatus.DELETED },
      },
      select: { id: true },
    });
    const found = new Set(rows.map((row: { id: string }) => row.id));
    const invalid = ids.filter((id) => !found.has(id));
    if (invalid.length > 0) {
      throw new AppError(400, "Wiki Zone config references missing Units", {
        code: "WIKI_ZONE_UNIT_REF_INVALID",
        details: { ids: invalid },
      });
    }
  }

  private async assertTranslationGroupRefs(refs: Set<string>): Promise<void> {
    if (refs.size === 0) return;
    const ids = [...refs];
    const rows = await prisma.translationGroup.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    const found = new Set(rows.map((row: { id: string }) => row.id));
    const invalid = ids.filter((id) => !found.has(id));
    if (invalid.length > 0) {
      throw new AppError(
        400,
        "Wiki Zone config references invalid TranslationGroups",
        {
          code: "WIKI_ZONE_TRANSLATION_GROUP_REF_INVALID",
          details: { ids: invalid },
        },
      );
    }
  }

  private collectHomepageSectionRefs(
    section: WikiZoneHomepageSection,
    refs: {
      entityIds: Set<string>;
      tagUnitIds: Set<string>;
      translationGroupIds: Set<string>;
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

    if (section.kind === "translationGroupCollection") {
      for (const id of section.translationGroupIds) {
        refs.translationGroupIds.add(id);
      }
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
    const translationGroupIds = new Set<string>();
    const unitIds = new Set<string>();
    const labelUnitIds = new Set<string>();

    unitIds.add(wiki.filters.realmUnitId);
    for (const id of wiki.filters.tagUnitIds ?? []) tagUnitIds.add(id);
    for (const id of wiki.filters.realmTagUnitIds ?? []) tagUnitIds.add(id);
    for (const filter of wiki.filters.subjectFilters ?? []) {
      for (const id of filter.entityIds ?? []) entityIds.add(id);
    }
    for (const id of wiki.filters.translationGroupIds ?? []) {
      translationGroupIds.add(id);
    }

    for (const section of wiki.navigation?.sections ?? []) {
      pushIfPresent(labelUnitIds, section.labelUnitId);
      assertTranslatedLabel(section.label);
      for (const item of section.items) {
        collectNavigationRefs({
          item,
          entityIds,
          tagUnitIds,
          translationGroupIds,
          unitIds,
          labelUnitIds,
        });
      }
    }

    for (const section of wiki.homepage?.sections ?? []) {
      this.collectHomepageSectionRefs(section, {
        entityIds,
        tagUnitIds,
        translationGroupIds,
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
        UnitType.REALM,
        "WIKI_ZONE_REALM_REF_INVALID",
      ),
      this.assertUnitRefs(
        entityIds,
        UnitType.ENTITY,
        "WIKI_ZONE_ENTITY_REF_INVALID",
      ),
      this.assertUnitRefs(
        tagUnitIds,
        UnitType.TAG,
        "WIKI_ZONE_TAG_REF_INVALID",
      ),
      this.assertUnitRefs(
        labelUnitIds,
        UnitType.LABEL,
        "WIKI_ZONE_LABEL_REF_INVALID",
      ),
      this.assertAnyUnitRefs(unitIds),
      this.assertTranslationGroupRefs(translationGroupIds),
    ]);
  }

  async getByUnitId(unitId: string): Promise<ZoneWithRelations | null> {
    return prisma.zone.findUnique({
      where: { unitId },
      include: zoneInclude,
    });
  }

  async getBySlug(slug: string): Promise<ZoneWithRelations | null> {
    const { getSlugScopeId } = await import("@/infra/slug-scopes");
    const zoneScope = getSlugScopeId("zone");
    if (!zoneScope) return null;
    const unit = await prisma.unit.findUnique({
      where: { slugScope_slug: { slugScope: zoneScope, slug } },
      select: { id: true, type: true, visibility: true },
    });

    if (!unit || unit.type !== "ZONE") return null;

    const zone = await prisma.zone.findUnique({
      where: { unitId: unit.id },
      include: zoneInclude,
    });

    return zone;
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
    filters: ZoneFilters;
    template: string;
    styling?: Record<string, unknown> | null;
    wiki?: WikiZoneConfig | null;
    startsAt?: Date | null;
    endsAt?: Date | null;
  }): Promise<ZoneWithRelations> {
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

    const zone = await prisma.zone.create({
      data: {
        unitId: unit.id,
        filters: input.filters as Prisma.InputJsonValue,
        template: input.template,
        styling: (input.styling ?? null) as Prisma.InputJsonValue,
        wiki: (input.wiki ?? null) as Prisma.InputJsonValue,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
      },
      include: zoneInclude,
    });

    return zone;
  }

  async update(
    unitId: string,
    input: {
      filters?: ZoneFilters;
      template?: string;
      styling?: Record<string, unknown> | null;
      wiki?: WikiZoneConfig | null;
      startsAt?: Date | null;
      endsAt?: Date | null;
    },
  ): Promise<ZoneWithRelations> {
    await this.validateWikiConfig(input.wiki);

    const zone = await prisma.zone.update({
      where: { unitId },
      data: {
        filters:
          input.filters !== undefined
            ? (input.filters as Prisma.InputJsonValue)
            : undefined,
        template: input.template ?? undefined,
        styling:
          input.styling !== undefined
            ? (input.styling as Prisma.InputJsonValue)
            : undefined,
        wiki:
          input.wiki !== undefined
            ? (input.wiki as Prisma.InputJsonValue)
            : undefined,
        startsAt: input.startsAt !== undefined ? input.startsAt : undefined,
        endsAt: input.endsAt !== undefined ? input.endsAt : undefined,
      },
      include: zoneInclude,
    });

    return zone;
  }

  private wikiVisibleUnitWhere(realmUnitId: string): Prisma.UnitWhereInput {
    return {
      type: UnitType.POST,
      status: UnitStatus.PUBLISHED,
      visibility: "PUBLIC",
      post: { kind: "WIKI" },
      inRealms: { some: { realmUnitId } },
      OR: [
        { contentModerationState: null },
        {
          contentModerationState: {
            state: { notIn: WIKI_EXCLUDED_MODERATION_STATES as any },
          },
        },
      ],
      realmModerationTargets: {
        none: {
          realmUnitId,
          state: { in: WIKI_EXCLUDED_MODERATION_STATES as any },
        },
      },
    };
  }

  private async hydrateWikiPostSection(input: {
    realmUnitId: string;
    section: WikiZoneHomepageSection;
    preferredLanguages?: string[];
    mode: "recent" | "updated" | "stub";
  }): Promise<WikiZoneHomepageItem[]> {
    const limit = sectionLimit(input.section);
    const rows = await prisma.unit.findMany({
      where: this.wikiVisibleUnitWhere(input.realmUnitId),
      include: { translations: true, post: true },
      orderBy:
        input.mode === "recent"
          ? [{ createdAt: "desc" }, { id: "asc" }]
          : [{ updatedAt: "desc" }, { id: "asc" }],
      take: input.mode === "stub" ? limit * 3 : limit,
    });

    const filtered =
      input.mode !== "stub"
        ? rows
        : rows.filter((row) => {
            const source = mainMarkdownSource(row.post?.content);
            if (input.section.kind !== "stubWiki") return false;
            if (input.section.predicate === "missing-body") return !source;
            return !source || source.length < 500;
          });

    return filtered
      .slice(0, limit)
      .map((row) => mapUnitToWikiPostItem(row, input.preferredLanguages));
  }

  private async hydrateTranslationGroupSection(input: {
    realmUnitId: string;
    section: Extract<
      WikiZoneHomepageSection,
      { kind: "translationGroupCollection" }
    >;
    preferredLanguages?: string[];
  }): Promise<WikiZoneHomepageItem[]> {
    const best = await translationGroupService.resolveBestLanguageWikiPosts({
      translationGroupIds: input.section.translationGroupIds,
      preferredLanguages: input.preferredLanguages,
    });
    const unitIds = best.map((row) => row.unitId);
    if (unitIds.length === 0) return [];

    const rows = await prisma.unit.findMany({
      where: {
        ...this.wikiVisibleUnitWhere(input.realmUnitId),
        id: { in: unitIds },
      },
      include: { translations: true, post: true },
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

    const rows = await prisma.unit.findMany({
      where: {
        id: { in: tagUnitIds },
        type: UnitType.TAG,
        status: { not: UnitStatus.DELETED },
      },
      include: { translations: true },
    });
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
    const rows = await prisma.subjectAttribution.findMany({
      where: {
        ...(input.section.subjectRoles?.length
          ? { role: { in: input.section.subjectRoles } }
          : {}),
        unit: {
          ...this.wikiVisibleUnitWhere(realmUnitId),
        },
        entity: {
          type: UnitType.ENTITY,
          status: { not: UnitStatus.DELETED },
          ...(input.section.entityKinds?.length
            ? { entity: { kind: { in: input.section.entityKinds } } }
            : {}),
        },
      },
      include: {
        entity: {
          include: {
            translations: true,
            entity: true,
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { entityId: "asc" }],
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
      case "translationGroupCollection":
        return this.hydrateTranslationGroupSection({
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
    await prisma.unit.delete({ where: { id: unitId } });
  }
}

export const zoneService = new ZoneService();
