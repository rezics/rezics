import type {
  CommentSearchDocument,
  ContentSearchDocument,
  EntitySearchDocument,
  FeedbackSearchDocument,
  PollSearchDocument,
  PostSearchDocument,
  RealmSearchDocument,
  UserSearchDocument,
  ZoneSearchDocument,
} from "@rezics/contract";
import {
  type Language,
  mainMarkdownSource,
  normalizeLanguage,
  RATING_TAGS,
  readCoverUrlFromExtra,
} from "@rezics/contract";
import type { ServerDb } from "@rezics/server/db";
import {
  Book,
  Comment,
  ContentStructure,
  ContentTranslation,
  CreditAttribution,
  Entity,
  Feedback,
  Game,
  GameSystemRequirement,
  Link,
  Media,
  Poll,
  PollOption,
  Post,
  Realm,
  RealmTagApplication,
  ScoreEntry,
  Series,
  SeriesContentIndex,
  ShelfItem,
  SubjectAttribution,
  Unit,
  UnitAlias,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
  UserUnitProgress,
  Zone,
} from "@rezics/server/db/schema";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import type { SearchClient } from "./client";
import {
  buildProgressDocument,
  progressDocumentId,
  type UserUnitProgressRow,
} from "./progress";
import {
  buildShelfItemDocument,
  type ShelfItemDocumentRow,
  shelfItemDocumentId,
} from "./shelf-item";

type SearchServerDb = Pick<ServerDb, "select">;

let searchServerDb: SearchServerDb | null = null;

export function setSearchDb(db: SearchServerDb): void {
  searchServerDb = db;
}

function getSearchDb(): SearchServerDb {
  if (!searchServerDb) {
    throw new Error(
      "Search Drizzle db is not configured. Call setSearchDb() before running Drizzle-backed search sync.",
    );
  }
  return searchServerDb;
}

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value);
}

function lower<T extends string>(value: string | null | undefined): T | null {
  return value ? (value.toLowerCase() as T) : null;
}

function searchDescriptionText(value: unknown): string | null {
  if (typeof value === "string") return value;
  return mainMarkdownSource(value);
}

function pickCoverUrlFromTranslations(
  defaultLanguage: string | null | undefined,
  translations: readonly { language: string; extra: unknown }[] | undefined,
): string | null {
  const list = translations ?? [];
  if (list.length === 0) return null;
  const ordered = [
    defaultLanguage
      ? list.find((t) => t.language === defaultLanguage)
      : undefined,
    list.find((t) => t.language === "en"),
    ...list,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return null;
}

function toIsoString(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function mapGameSystemRequirementSummary(row: any) {
  return {
    platformEntityId: row.platformEntityId ?? null,
    tier: row.tier,
    language: row.language ?? null,
    hardware: row.hardware,
  };
}

const BATCH_SIZE = 5000;

export type SearchSegmentOptions = {
  cursor?: string;
  limit?: number;
};

export type SearchSegmentResult = {
  processed: number;
  nextCursor?: string;
};

function segmentLimit(options: SearchSegmentOptions = {}) {
  return Math.min(Math.max(options.limit ?? BATCH_SIZE, 1), BATCH_SIZE);
}

function segmentRows<T extends Record<string, any>>(
  rows: T[],
  limit: number,
  cursorKey: keyof T,
): { current: T[]; nextCursor?: string } {
  const current = rows.slice(0, limit);
  if (rows.length <= limit || current.length === 0) return { current };
  return {
    current,
    nextCursor: String(current[current.length - 1]![cursorKey]),
  };
}

const PROGRESS_SYNC_ATTEMPTS = 3;
const PROGRESS_SYNC_RETRY_BASE_MS = 100;
const VISIBILITY_THRESHOLD = -100;

const INDEXABLE_TYPES = [
  "BOOK",
  "GAME",
  "MEDIA",
  "SERIES",
  "SHELF",
  "LINK",
] as const satisfies ReadonlyArray<(typeof Unit.$inferSelect)["type"]>;

const PUBLIC_ELIGIBLE_UNIT_WHERE = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
} as const;

const RATING_TAG_SLUGS = new Set<string>(RATING_TAGS);

function publicSearchableUnitWhere(): Record<string, unknown> {
  return { ...PUBLIC_ELIGIBLE_UNIT_WHERE };
}

async function isContentPatchEligible(unitId: string): Promise<boolean> {
  const [unit] = await getSearchDb()
    .select({
      type: Unit.type,
      status: Unit.status,
      visibility: Unit.visibility,
      moderationStatus: Unit.moderationStatus,
      catalogEntryKind: Unit.catalogEntryKind,
    })
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
  return isPublicIndexableContentUnit(unit);
}

export function isPublicIndexableContentUnit(
  unit:
    | {
        type: string;
        status: string;
        visibility: string;
        moderationStatus?: string | null;
        catalogEntryKind?: string | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(
    unit &&
      INDEXABLE_TYPES.includes(unit.type as any) &&
      unit.status === PUBLIC_ELIGIBLE_UNIT_WHERE.status &&
      unit.visibility === PUBLIC_ELIGIBLE_UNIT_WHERE.visibility &&
      unit.moderationStatus === PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus &&
      (unit.catalogEntryKind === null ||
        unit.catalogEntryKind === undefined ||
        unit.catalogEntryKind === "MAIN"),
  );
}

export function isPublicIndexablePostUnit(
  unit:
    | {
        status: string | null;
        visibility: string | null;
        moderationStatus?: string | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(
    unit &&
      unit.status === PUBLIC_ELIGIBLE_UNIT_WHERE.status &&
      unit.visibility === PUBLIC_ELIGIBLE_UNIT_WHERE.visibility &&
      unit.moderationStatus === PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus,
  );
}

function isSearchVisibleScoredRow(row: {
  score: number;
  pinned?: boolean | null;
  status?: string | null;
}): boolean {
  if (row.status && row.status !== "ACTIVE") return false;
  return row.score > VISIBILITY_THRESHOLD || row.pinned === true;
}

function realmIdsForSearch(unit: any): string[] {
  return (unit?.inRealms ?? [])
    .filter(
      (realm: any) =>
        !realm.moderationStatus || realm.moderationStatus === "APPROVED",
    )
    .filter(
      (realm: any) =>
        realm.realmIsPublic !== false && realm.realm?.realm?.isPublic !== false,
    )
    .map((realm: any) => realm.realmUnitId);
}

const realmSearchProjectionSelect = {
  inRealms: {
    where: { moderationStatus: "APPROVED" },
    select: {
      realmUnitId: true,
      moderationStatus: true,
      isLocked: true,
      realm: {
        select: {
          realm: {
            select: { isPublic: true },
          },
        },
      },
    },
    orderBy: { realmUnitId: "asc" as const },
  },
} as const;

async function patchContentIfEligible(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
): Promise<void> {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  await client.patchContent([{ id: unitId, ...fields }]);
}

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function indexedLanguages(unit: {
  supportLanguages?: readonly { language?: string | null }[] | null;
}): Language[] {
  return [
    ...new Set(
      (unit.supportLanguages ?? [])
        .map((item) => item.language)
        .map((language) => (language ? normalizeLanguage(language) : null))
        .filter((language): language is Language => !!language),
    ),
  ];
}

function indexedSupportLanguages(unit: {
  supportLanguages?:
    | readonly {
        language?: string | null;
        isPrimary?: boolean | null;
        sortOrder?: number | null;
      }[]
    | null;
}): { language: Language; isPrimary: boolean; sortOrder: number }[] {
  return (unit.supportLanguages ?? [])
    .map((item) => ({
      item,
      language: item.language ? normalizeLanguage(item.language) : null,
    }))
    .filter(
      (
        entry,
      ): entry is {
        item: {
          language?: string | null;
          isPrimary?: boolean | null;
          sortOrder?: number | null;
        };
        language: Language;
      } => Boolean(entry.language),
    )
    .map(({ item, language }) => ({
      language,
      isPrimary: Boolean(item.isPrimary),
      sortOrder: item.sortOrder ?? 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function runProgressSyncWithRetry(
  operation: () => Promise<unknown>,
  context: { action: "sync" | "remove"; userId: string; unitId: string },
): Promise<void> {
  for (let attempt = 1; attempt <= PROGRESS_SYNC_ATTEMPTS; attempt += 1) {
    try {
      await operation();
      return;
    } catch (error) {
      if (attempt === PROGRESS_SYNC_ATTEMPTS) {
        console.error("progress search sync exhausted", {
          ...context,
          attempts: PROGRESS_SYNC_ATTEMPTS,
          error: describeError(error),
        });
        return;
      }

      await delay(PROGRESS_SYNC_RETRY_BASE_MS * attempt);
    }
  }
}

/**
 * Build a ContentSearchDocument from a Unit row with all search relations attached.
 * 从已附加全部搜索关联的 Unit 行构建 ContentSearchDocument。
 */
export function buildContentDocument(unit: any): ContentSearchDocument {
  const translations: any[] = unit.translations ?? [];
  const aliases: any[] = (unit.aliases ?? []).filter(isSearchVisibleScoredRow);
  const unitTags: any[] = (unit.unitTags ?? []).filter(
    isSearchVisibleScoredRow,
  );
  const realmTagApplicationsAsTargetUnit: any[] =
    unit.realmTagApplicationsAsTargetUnit ?? [];
  const creditAttributions: any[] = unit.creditAttributions ?? [];
  const subjectAttributions: any[] = unit.subjectAttributions ?? [];

  // Flatten translations
  // 展平 translations
  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const subtitles = translations.map((t: any) => t.subtitle).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const descriptions = translations
    .map((t: any) => mainMarkdownSource(t.description))
    .filter(isNonEmptyString);
  const descriptionText = descriptions.join("\n") || null;
  const contentText =
    unit.type === "POST"
      ? mainMarkdownSource(resolvePostContent({ unit }))
      : null;
  const languages = indexedLanguages(unit);
  const supportLanguages = indexedSupportLanguages(unit);
  const aliasValues = aliases.map((alias: any) => alias.value).filter(Boolean);

  // Tags
  // 标签
  const tagIds = unitTags.map((ut: any) => ut.tagUnitId);
  const tagScores: Record<string, number> = {};
  const tagLabels: string[] = [];
  for (const ut of unitTags) {
    tagScores[ut.tagUnitId] = ut.score;
    const labels: string[] = (ut.tag?.translations ?? [])
      .map((t: any) => t.title)
      .filter(Boolean);
    tagLabels.push(...labels);
  }
  const directSeriesRows: any[] = unit.seriesContentIndexesAsRelease ?? [];
  const seriesUnitIds = [
    ...new Set(directSeriesRows.map((row) => row.seriesUnitId)),
  ];
  const seriesKindKeys = [
    ...new Set(
      directSeriesRows
        .map((row) => row.series?.kindKey)
        .filter(isNonEmptyString),
    ),
  ];
  const seriesTitles = [
    ...new Set(
      directSeriesRows
        .flatMap((row) =>
          (row.series?.unit?.translations ?? []).map((tr: any) => tr.title),
        )
        .filter(isNonEmptyString),
    ),
  ];

  // Realms
  // 领域
  const realmIds = realmIdsForSearch(unit);

  // Realm-tag compound keys
  // 领域-标签复合键
  const realmTagKeys = realmTagApplicationsAsTargetUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );

  // Credit attribution
  // 署名归属
  const creditNames = creditAttributions
    .map((a: any) => {
      const translations = a.entity?.translations ?? [];
      return translations[0]?.title;
    })
    .filter(isNonEmptyString);

  const subjectEntityIds = subjectAttributions.map((a: any) => a.entityId);
  const subjectNames = subjectAttributions
    .flatMap((a: any) =>
      (a.entity?.translations ?? []).map(
        (translation: any) => translation.title,
      ),
    )
    .filter(isNonEmptyString);
  const subjectKinds = [
    ...new Set(
      subjectAttributions
        .map((a: any) => a.entity?.entity?.kind)
        .filter(Boolean),
    ),
  ];
  const subjectRoles = [
    ...new Set(subjectAttributions.map((a: any) => a.role).filter(Boolean)),
  ];
  const platformEntityIds =
    unit.type === "GAME"
      ? subjectAttributions
          .filter((a: any) => a.role === "available_on")
          .map((a: any) => a.entityId)
      : undefined;
  const ratingTagUnitIds =
    unit.type === "GAME" || unit.type === "MEDIA"
      ? unitTags
          .filter((ut: any) => RATING_TAG_SLUGS.has(ut.tag?.slug))
          .map((ut: any) => ut.tagUnitId)
      : undefined;
  const gameSystemRequirementSummaries =
    unit.type === "GAME"
      ? (unit.game?.systemRequirements ?? []).map(
          mapGameSystemRequirementSummary,
        )
      : undefined;

  // Type extension fields
  // 类型扩展字段
  const ext = unit.book ?? unit.game ?? unit.media ?? null;
  const isLicensed = ext?.isLicensed ?? false;
  const coverUrl = pickCoverUrlFromTranslations(
    unit.defaultLanguage,
    translations,
  );

  // Link-specific fields
  // Link 专属字段
  const linkUrl = unit.link?.url ?? null;
  const linkSiteName = unit.link?.siteName ?? null;

  // Post kind + book textLength for search filters
  // 用于搜索筛选的 Post kind 与 book textLength
  const postKind = unit.post?.kind ?? null;
  const textLength = unit.book?.textLength ?? null;
  const gameReleaseDate =
    unit.type === "GAME" ? toIsoString(unit.game?.releaseDate) : undefined;
  const gameVersionLabel =
    unit.type === "GAME" ? (unit.game?.versionLabel ?? null) : undefined;
  const mediaReleaseDate =
    unit.type === "MEDIA" ? toIsoString(unit.media?.releaseDate) : undefined;
  const mediaKindKey =
    unit.type === "MEDIA" ? (unit.media?.kindKey ?? null) : undefined;
  const mediaRuntimeMinutes =
    unit.type === "MEDIA" ? (unit.media?.runtimeMinutes ?? null) : undefined;
  const mediaEpisodeCount =
    unit.type === "MEDIA" ? (unit.media?.episodeCount ?? null) : undefined;
  const mediaSeasonCount =
    unit.type === "MEDIA" ? (unit.media?.seasonCount ?? null) : undefined;
  const mediaContentStructureAvailable =
    unit.type === "MEDIA" ? Boolean(unit.ownedContentStructure) : undefined;

  // Shelf membership: list of unit ids contained in this shelf (SHELF type only)
  // 书架成员关系：该书架包含的 unit id 列表（仅 SHELF 类型）
  const containedUnitIds: string[] | undefined =
    unit.type === "SHELF"
      ? ((unit.shelf?.units ?? []) as { unitId: string }[]).map((i) => i.unitId)
      : undefined;

  return {
    id: unit.id,
    type: unit.type,
    titles,
    subtitles,
    contentText,
    descriptionText,
    summaries,
    descriptions,
    creditNames,
    subjectNames,
    subjectEntityIds,
    subjectKinds,
    subjectRoles,
    ...(platformEntityIds !== undefined ? { platformEntityIds } : {}),
    ...(ratingTagUnitIds !== undefined ? { ratingTagUnitIds } : {}),
    ...(gameSystemRequirementSummaries !== undefined
      ? { gameSystemRequirementSummaries }
      : {}),
    ...(gameReleaseDate !== undefined ? { gameReleaseDate } : {}),
    ...(gameVersionLabel !== undefined ? { gameVersionLabel } : {}),
    ...(mediaKindKey !== undefined ? { mediaKindKey } : {}),
    ...(mediaReleaseDate !== undefined ? { mediaReleaseDate } : {}),
    ...(mediaRuntimeMinutes !== undefined ? { mediaRuntimeMinutes } : {}),
    ...(mediaEpisodeCount !== undefined ? { mediaEpisodeCount } : {}),
    ...(mediaSeasonCount !== undefined ? { mediaSeasonCount } : {}),
    ...(mediaContentStructureAvailable !== undefined
      ? { mediaContentStructureAvailable }
      : {}),
    tagLabels,
    aliasValues,
    tagIds,
    tagScores,
    catalogEntryKind: unit.catalogEntryKind ?? null,
    targetUnitId: unit.targetUnitId ?? null,
    seriesUnitIds,
    seriesKindKeys,
    seriesTitles,
    realmIds,
    realmTagKeys,
    languages,
    isLanguageNeutral: Boolean(unit.isLanguageNeutral),
    supportLanguages,
    rating: unit.rating ?? "GENERAL",
    aiDisclosureMode: unit.aiDisclosureMode ?? "UNKNOWN",
    visibility: unit.visibility ?? "PUBLIC",
    isLicensed,
    postKind,
    textLength,
    createdAt:
      unit.createdAt instanceof Date
        ? unit.createdAt.toISOString()
        : unit.createdAt,
    updatedAt:
      unit.updatedAt instanceof Date
        ? unit.updatedAt.toISOString()
        : unit.updatedAt,
    publishedAt: unit.publishedAt
      ? unit.publishedAt instanceof Date
        ? unit.publishedAt.toISOString()
        : unit.publishedAt
      : null,
    bestScore: 0,
    hotScore: 0,
    topScore: 0,
    risingScore: 0,
    controversyScore: 0,
    trendingScore: 0,
    qualityScore: 0,
    rankUpdatedAt: null,
    referenceCount: unit.referenceCount ?? 0,
    shareCount: unit.shareCount ?? 0,
    defaultLanguage: unit.defaultLanguage ?? null,
    coverUrl,
    userId: unit.userId ?? null,
    ...(containedUnitIds !== undefined ? { containedUnitIds } : {}),
    linkUrl,
    linkSiteName,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
      description: tr.description ?? null,
    })),
  };
}

type ContentSyncMode = "main" | "release" | "game-media" | "single";

function publicContentUnitConditions(mode: ContentSyncMode) {
  const base = [
    eq(Unit.status, PUBLIC_ELIGIBLE_UNIT_WHERE.status),
    eq(Unit.visibility, PUBLIC_ELIGIBLE_UNIT_WHERE.visibility),
    eq(Unit.moderationStatus, PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus),
  ];

  if (mode === "single") return and(...base);
  if (mode === "release") {
    return and(
      ...base,
      inArray(Unit.type, INDEXABLE_TYPES),
      eq(Unit.catalogEntryKind, "VARIANT"),
    );
  }
  if (mode === "game-media") {
    return and(
      ...base,
      inArray(Unit.type, ["GAME", "MEDIA"]),
      or(isNull(Unit.catalogEntryKind), eq(Unit.catalogEntryKind, "MAIN")),
    );
  }
  return and(
    ...base,
    inArray(Unit.type, INDEXABLE_TYPES),
    or(isNull(Unit.catalogEntryKind), eq(Unit.catalogEntryKind, "MAIN")),
  );
}

async function listContentBaseRows(input: {
  limit: number;
  mode: ContentSyncMode;
  cursor?: string;
}) {
  const query = getSearchDb().select().from(Unit);
  const conditions = input.cursor
    ? and(publicContentUnitConditions(input.mode), gt(Unit.id, input.cursor))
    : publicContentUnitConditions(input.mode);
  return query.where(conditions).orderBy(asc(Unit.id)).limit(input.limit);
}

async function findContentBaseRow(unitId: string) {
  const [unit] = await getSearchDb()
    .select()
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
  return unit ?? null;
}

function unitTagRowsFromJoinRows(rows: any[]) {
  const grouped = new Map<string, any>();
  for (const row of rows) {
    const unitTag = grouped.get(row.tagUnitId) ?? {
      unitId: row.unitId,
      tagUnitId: row.tagUnitId,
      score: row.score,
      pinned: row.pinned,
      status: "ACTIVE",
      tag: {
        slug: row.tagSlug,
        translations: [],
      },
    };
    if (row.title) {
      unitTag.tag.translations.push({ title: row.title });
    }
    grouped.set(row.tagUnitId, unitTag);
  }
  return [...grouped.values()];
}

function attributionRowsFromJoinRows(rows: any[]) {
  const grouped = new Map<string, any>();
  for (const row of rows) {
    const key = `${row.unitId}:${row.entityId}:${row.role}`;
    const attribution = grouped.get(key) ?? {
      unitId: row.unitId,
      entityId: row.entityId,
      role: row.role,
      sortOrder: row.sortOrder,
      entity: {
        entity: row.kind ? { kind: row.kind } : null,
        translations: [],
      },
    };
    if (row.title) {
      attribution.entity.translations.push({ title: row.title });
    }
    grouped.set(key, attribution);
  }
  return [...grouped.values()];
}

function seriesRowsFromJoinRows(rows: any[]) {
  const grouped = new Map<string, any>();
  for (const row of rows) {
    const key = `${row.releaseUnitId}:${row.seriesUnitId}:${row.contentNodeId}`;
    const seriesRow = grouped.get(key) ?? {
      releaseUnitId: row.releaseUnitId,
      seriesUnitId: row.seriesUnitId,
      contentNodeId: row.contentNodeId,
      series: {
        kindKey: row.kindKey,
        unit: { translations: [] },
      },
    };
    if (row.title) {
      seriesRow.series.unit.translations.push({ title: row.title });
    }
    grouped.set(key, seriesRow);
  }
  return [...grouped.values()];
}

async function hydrateContentRows(rows: any[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.id);
  const [
    translations,
    contentTranslations,
    supportLanguages,
    aliases,
    unitTagRows,
    unitRealms,
    realmTagApplications,
    creditRows,
    subjectRows,
    books,
    games,
    mediaRows,
    links,
    posts,
    shelfItems,
    contentStructures,
    gameSystemRequirements,
    seriesRows,
  ] = await Promise.all([
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(ContentTranslation)
      .where(inArray(ContentTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitAlias)
      .where(
        and(
          inArray(UnitAlias.unitId, unitIds),
          eq(UnitAlias.status, "ACTIVE"),
          or(
            gt(UnitAlias.score, VISIBILITY_THRESHOLD),
            eq(UnitAlias.pinned, true),
          ),
        ),
      )
      .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score)),
    getSearchDb()
      .select({
        unitId: UnitTag.unitId,
        tagUnitId: UnitTag.tagUnitId,
        score: UnitTag.score,
        pinned: UnitTag.pinned,
        tagSlug: Unit.slug,
        title: UnitTranslation.title,
      })
      .from(UnitTag)
      .leftJoin(Unit, eq(Unit.id, UnitTag.tagUnitId))
      .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, UnitTag.tagUnitId))
      .where(
        and(
          inArray(UnitTag.unitId, unitIds),
          or(gt(UnitTag.score, VISIBILITY_THRESHOLD), eq(UnitTag.pinned, true)),
        ),
      )
      .orderBy(desc(UnitTag.score)),
    getSearchDb()
      .select({
        unitId: UnitRealm.unitId,
        realmUnitId: UnitRealm.realmUnitId,
        moderationStatus: UnitRealm.moderationStatus,
        isLocked: UnitRealm.isLocked,
        realmIsPublic: Realm.isPublic,
      })
      .from(UnitRealm)
      .leftJoin(Realm, eq(Realm.unitId, UnitRealm.realmUnitId))
      .where(inArray(UnitRealm.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(RealmTagApplication)
      .where(inArray(RealmTagApplication.unitId, unitIds)),
    getSearchDb()
      .select({
        unitId: CreditAttribution.unitId,
        entityId: CreditAttribution.entityId,
        role: CreditAttribution.role,
        sortOrder: CreditAttribution.sortOrder,
        kind: Entity.kind,
        title: UnitTranslation.title,
      })
      .from(CreditAttribution)
      .leftJoin(Entity, eq(Entity.unitId, CreditAttribution.entityId))
      .leftJoin(
        UnitTranslation,
        eq(UnitTranslation.unitId, CreditAttribution.entityId),
      )
      .where(inArray(CreditAttribution.unitId, unitIds))
      .orderBy(asc(CreditAttribution.sortOrder)),
    getSearchDb()
      .select({
        unitId: SubjectAttribution.unitId,
        entityId: SubjectAttribution.entityId,
        role: SubjectAttribution.role,
        sortOrder: SubjectAttribution.sortOrder,
        kind: Entity.kind,
        title: UnitTranslation.title,
      })
      .from(SubjectAttribution)
      .leftJoin(Entity, eq(Entity.unitId, SubjectAttribution.entityId))
      .leftJoin(
        UnitTranslation,
        eq(UnitTranslation.unitId, SubjectAttribution.entityId),
      )
      .where(inArray(SubjectAttribution.unitId, unitIds))
      .orderBy(asc(SubjectAttribution.sortOrder)),
    getSearchDb().select().from(Book).where(inArray(Book.unitId, unitIds)),
    getSearchDb().select().from(Game).where(inArray(Game.unitId, unitIds)),
    getSearchDb().select().from(Media).where(inArray(Media.unitId, unitIds)),
    getSearchDb().select().from(Link).where(inArray(Link.unitId, unitIds)),
    getSearchDb().select().from(Post).where(inArray(Post.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(ShelfItem)
      .where(
        and(
          inArray(ShelfItem.shelfId, unitIds),
          eq(ShelfItem.itemType, "unit"),
        ),
      )
      .orderBy(asc(ShelfItem.position)),
    getSearchDb()
      .select()
      .from(ContentStructure)
      .where(inArray(ContentStructure.ownerUnitId, unitIds)),
    getSearchDb()
      .select()
      .from(GameSystemRequirement)
      .where(inArray(GameSystemRequirement.gameUnitId, unitIds))
      .orderBy(
        asc(GameSystemRequirement.platformEntityId),
        asc(GameSystemRequirement.tier),
      ),
    getSearchDb()
      .select({
        releaseUnitId: SeriesContentIndex.releaseUnitId,
        seriesUnitId: SeriesContentIndex.seriesUnitId,
        contentNodeId: SeriesContentIndex.contentNodeId,
        kindKey: Series.kindKey,
        title: UnitTranslation.title,
      })
      .from(SeriesContentIndex)
      .leftJoin(Series, eq(Series.unitId, SeriesContentIndex.seriesUnitId))
      .leftJoin(
        UnitTranslation,
        eq(UnitTranslation.unitId, SeriesContentIndex.seriesUnitId),
      )
      .where(inArray(SeriesContentIndex.releaseUnitId, unitIds)),
  ]);

  const translationsByUnitId = groupRowsByKey(translations as any[], "unitId");
  const contentTranslationsByUnitId = groupRowsByKey(
    contentTranslations as any[],
    "unitId",
  );
  const supportLanguagesByUnitId = groupRowsByKey(
    supportLanguages as any[],
    "unitId",
  );
  const aliasesByUnitId = groupRowsByKey(aliases as any[], "unitId");
  const unitTagsByUnitId = groupRowsByKey(
    unitTagRowsFromJoinRows(unitTagRows as any[]),
    "unitId",
  );
  const unitRealmsByUnitId = groupRowsByKey(unitRealms as any[], "unitId");
  const realmTagsByUnitId = groupRowsByKey(
    realmTagApplications as any[],
    "unitId",
  );
  const creditsByUnitId = groupRowsByKey(
    attributionRowsFromJoinRows(creditRows as any[]),
    "unitId",
  );
  const subjectsByUnitId = groupRowsByKey(
    attributionRowsFromJoinRows(subjectRows as any[]),
    "unitId",
  );
  const booksByUnitId = new Map(
    (books as any[]).map((row) => [row.unitId, row]),
  );
  const gamesByUnitId = new Map(
    (games as any[]).map((row) => [row.unitId, row]),
  );
  const mediaByUnitId = new Map(
    (mediaRows as any[]).map((row) => [row.unitId, row]),
  );
  const linksByUnitId = new Map(
    (links as any[]).map((row) => [row.unitId, row]),
  );
  const postsByUnitId = new Map(
    (posts as any[]).map((row) => [row.unitId, row]),
  );
  const shelfItemsByUnitId = groupRowsByKey(shelfItems as any[], "shelfId");
  const contentStructuresByUnitId = new Map(
    (contentStructures as any[]).map((row) => [row.ownerUnitId, row]),
  );
  const systemRequirementsByUnitId = groupRowsByKey(
    gameSystemRequirements as any[],
    "gameUnitId",
  );
  const seriesByReleaseUnitId = groupRowsByKey(
    seriesRowsFromJoinRows(seriesRows as any[]),
    "releaseUnitId",
  );

  return rows.map((unit) => {
    const game = gamesByUnitId.get(unit.id);
    if (game) {
      game.systemRequirements = systemRequirementsByUnitId.get(unit.id) ?? [];
    }
    return {
      ...unit,
      translations: translationsByUnitId.get(unit.id) ?? [],
      contentTranslations: contentTranslationsByUnitId.get(unit.id) ?? [],
      supportLanguages: supportLanguagesByUnitId.get(unit.id) ?? [],
      aliases: aliasesByUnitId.get(unit.id) ?? [],
      unitTags: unitTagsByUnitId.get(unit.id) ?? [],
      inRealms: unitRealmsByUnitId.get(unit.id) ?? [],
      realmTagApplicationsAsTargetUnit: realmTagsByUnitId.get(unit.id) ?? [],
      creditAttributions: creditsByUnitId.get(unit.id) ?? [],
      subjectAttributions: subjectsByUnitId.get(unit.id) ?? [],
      book: booksByUnitId.get(unit.id) ?? null,
      game: game ?? null,
      media: mediaByUnitId.get(unit.id) ?? null,
      link: linksByUnitId.get(unit.id) ?? null,
      post: postsByUnitId.get(unit.id) ?? null,
      shelf: { units: shelfItemsByUnitId.get(unit.id) ?? [] },
      ownedContentStructure: contentStructuresByUnitId.get(unit.id) ?? null,
      seriesContentIndexesAsRelease: seriesByReleaseUnitId.get(unit.id) ?? [],
    };
  });
}

async function listContentSyncRows(input: {
  limit: number;
  mode: ContentSyncMode;
  cursor?: string;
}) {
  return hydrateContentRows(await listContentBaseRows(input));
}

// ANCHOR: Full content reindex
// ANCHOR: 全量内容重建索引

export async function syncAllContent(client: SearchClient) {
  const deleteResult = await client.deleteAllContent();
  console.log("syncAllContent: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllContent: cursor", cursor, "total", total);

    const units = await listContentSyncRows({
      mode: "main",
      limit: BATCH_SIZE,
      cursor,
    });

    if (units.length === 0) break;

    const docs = units.map(buildContentDocument);
    const addResult = await client.addOrUpdateContent(docs);
    console.log("syncAllContent: added batch", addResult);

    total += docs.length;
    cursor = units[units.length - 1]!.id;
  }

  return { message: "syncAllContent success", totalSynced: total };
}

export async function syncContentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const units = await listContentSyncRows({
    mode: "main",
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(units, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateContent(current.map(buildContentDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function syncReleaseContentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const units = await listContentSyncRows({
    mode: "release",
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(units, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateContent(current.map(buildContentDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function syncGameMediaContentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const units = await listContentSyncRows({
    mode: "game-media",
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(units, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateContent(current.map(buildContentDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Progress sync functions
// ANCHOR: 进度同步函数

export async function syncProgress(
  client: SearchClient,
  row: UserUnitProgressRow,
): Promise<void> {
  const doc = buildProgressDocument(row);
  await runProgressSyncWithRetry(() => client.addOrUpdateProgress([doc]), {
    action: "sync",
    userId: row.userId,
    unitId: row.unitId,
  });
}

type UserUnitProgressSyncRow = typeof UserUnitProgress.$inferSelect;

function parseProgressCursor(cursor: string): {
  userId: string;
  unitId: string;
} {
  return {
    userId: cursor.split(":")[0] ?? "",
    unitId: cursor.split(":").slice(1).join(":"),
  };
}

async function findUserUnitProgressSyncRow(
  userId: string,
  unitId: string,
): Promise<UserUnitProgressSyncRow | null> {
  const [row] = await getSearchDb()
    .select()
    .from(UserUnitProgress)
    .where(
      and(
        eq(UserUnitProgress.userId, userId),
        eq(UserUnitProgress.unitId, unitId),
      ),
    )
    .limit(1);
  return (row as UserUnitProgressSyncRow | undefined) ?? null;
}

async function listUserUnitProgressSyncRows(input: {
  limit: number;
  cursor?: string;
}): Promise<UserUnitProgressSyncRow[]> {
  const db = getSearchDb();
  const query = db.select().from(UserUnitProgress);
  const cursor = input.cursor ? parseProgressCursor(input.cursor) : null;
  const rows = cursor
    ? await query
        .where(
          and(
            eq(UserUnitProgress.isDeleted, false),
            sql`(${UserUnitProgress.userId}, ${UserUnitProgress.unitId}) > (${cursor.userId}, ${cursor.unitId})`,
          ),
        )
        .orderBy(asc(UserUnitProgress.userId), asc(UserUnitProgress.unitId))
        .limit(input.limit)
    : await query
        .where(eq(UserUnitProgress.isDeleted, false))
        .orderBy(asc(UserUnitProgress.userId), asc(UserUnitProgress.unitId))
        .limit(input.limit);
  return rows as UserUnitProgressSyncRow[];
}

export async function syncSingleProgress(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  const row = await findUserUnitProgressSyncRow(userId, unitId);
  if (!row || row.isDeleted) {
    await removeProgress(client, userId, unitId);
    return;
  }
  await syncProgress(client, row);
}

export async function removeProgress(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  await runProgressSyncWithRetry(
    () => client.deleteProgress(progressDocumentId(userId, unitId)),
    { action: "remove", userId, unitId },
  );
}

export async function syncProgressSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listUserUnitProgressSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const current = rows.slice(0, limit);
  const hasMore = rows.length > limit && current.length > 0;
  if (current.length > 0) {
    await client.addOrUpdateProgress(current.map(buildProgressDocument));
  }
  const last = current.at(-1);
  return {
    processed: current.length,
    ...(hasMore && last ? { nextCursor: `${last.userId}:${last.unitId}` } : {}),
  };
}

export async function syncAllProgress(client: SearchClient) {
  const deleteResult = await client.deleteAllProgress();
  console.log("syncAllProgress: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const result = await syncProgressSegment(client, { cursor });
    total += result.processed;
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return { message: "syncAllProgress success", totalSynced: total };
}

// ANCHOR: Shelf item sync functions
// ANCHOR: 书架条目同步函数

type ShelfItemSyncRow = typeof ShelfItem.$inferSelect & {
  shelfOwnerUserId: string | null;
  shelfVisibility: string | null;
  shelfStatus: string | null;
  shelfTitle: string | null;
  itemTitle: string | null;
  itemSummary: string | null;
  itemText: string | null;
  rootUnitId: string | null;
  realmUnitId: string | null;
  parentCommentId: string | null;
  authorUserId: string | null;
  authorName: string | null;
  moderationStatus: string | null;
  isLocked: boolean | null;
  deletedAt: string | null;
};

function shelfItemSyncSelect() {
  return {
    shelfId: ShelfItem.shelfId,
    itemType: ShelfItem.itemType,
    itemId: ShelfItem.itemId,
    kind: ShelfItem.kind,
    parentItemType: ShelfItem.parentItemType,
    parentItemId: ShelfItem.parentItemId,
    parentRole: ShelfItem.parentRole,
    position: ShelfItem.position,
    searchText: ShelfItem.searchText,
    createdByUserId: ShelfItem.createdByUserId,
    createdAt: ShelfItem.createdAt,
    updatedAt: ShelfItem.updatedAt,
    shelfOwnerUserId: sql<string | null>`(
      select "userId" from "Unit" where "id" = ${ShelfItem.shelfId} limit 1
    )`.as("shelfOwnerUserId"),
    shelfVisibility: sql<string | null>`(
      select "visibility"::text from "Unit" where "id" = ${ShelfItem.shelfId} limit 1
    )`.as("shelfVisibility"),
    shelfStatus: sql<string | null>`(
      select "status"::text from "Unit" where "id" = ${ShelfItem.shelfId} limit 1
    )`.as("shelfStatus"),
    shelfTitle: sql<string | null>`(
      select "title" from "UnitTranslation"
      where "unitId" = ${ShelfItem.shelfId}
      order by case when "language" = 'en' then 0 else 1 end, "language"
      limit 1
    )`.as("shelfTitle"),
    itemTitle: sql<string | null>`(
      select "title" from "UnitTranslation"
      where "unitId" = ${ShelfItem.itemId}
      order by case when "language" = 'en' then 0 else 1 end, "language"
      limit 1
    )`.as("itemTitle"),
    itemSummary: sql<string | null>`(
      select "summary" from "UnitTranslation"
      where "unitId" = ${ShelfItem.itemId}
      order by case when "language" = 'en' then 0 else 1 end, "language"
      limit 1
    )`.as("itemSummary"),
    itemText: sql<string | null>`null`.as("itemText"),
    rootUnitId: sql<
      string | null
    >`case when ${ShelfItem.itemType} = 'unit' then ${ShelfItem.itemId} else null end`.as(
      "rootUnitId",
    ),
    realmUnitId: sql<string | null>`null`.as("realmUnitId"),
    parentCommentId: sql<string | null>`null`.as("parentCommentId"),
    authorUserId: ShelfItem.createdByUserId,
    authorName: sql<string | null>`(
      select "name" from "User" where "unitId" = ${ShelfItem.createdByUserId} limit 1
    )`.as("authorName"),
    moderationStatus: sql<string | null>`(
      select "moderationStatus"::text from "Unit" where "id" = ${ShelfItem.itemId} limit 1
    )`.as("moderationStatus"),
    isLocked: sql<boolean | null>`null`.as("isLocked"),
    deletedAt: sql<string | null>`null`.as("deletedAt"),
  };
}

function parseShelfItemCursor(cursor: string): {
  shelfId: string;
  itemType: string;
  itemId: string;
} {
  const [shelfId = "", itemType = "", ...itemIdParts] = cursor.split(":");
  return { shelfId, itemType, itemId: itemIdParts.join(":") };
}

function toShelfItemDocumentRow(row: ShelfItemSyncRow): ShelfItemDocumentRow {
  return {
    shelfId: row.shelfId,
    shelfOwnerUserId: row.shelfOwnerUserId ?? "",
    shelfVisibility: row.shelfVisibility ?? "PRIVATE",
    shelfStatus: row.shelfStatus ?? "DRAFT",
    shelfTitle: row.shelfTitle,
    itemType: row.itemType,
    itemId: row.itemId,
    kind: row.kind,
    rootItemType: row.parentItemId
      ? (row.parentItemType ?? row.itemType)
      : row.itemType,
    rootItemId: row.parentItemId ?? row.itemId,
    parentItemType: row.parentItemType,
    parentItemId: row.parentItemId,
    parentRole: row.parentRole,
    position: row.position,
    itemTitle: row.itemTitle,
    itemSummary: row.itemSummary,
    itemText: row.itemText,
    searchText: row.searchText,
    rootUnitId:
      row.parentItemType === "unit" && row.parentItemId
        ? row.parentItemId
        : row.rootUnitId,
    realmUnitId: row.realmUnitId,
    parentCommentId: row.parentCommentId,
    authorUserId: row.authorUserId,
    authorName: row.authorName,
    moderationStatus: row.moderationStatus,
    isLocked: row.isLocked,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findShelfItemSyncRow(
  shelfId: string,
  itemType: string,
  itemId: string,
): Promise<ShelfItemSyncRow | null> {
  const [row] = await getSearchDb()
    .select(shelfItemSyncSelect())
    .from(ShelfItem)
    .where(
      and(
        eq(ShelfItem.shelfId, shelfId),
        eq(ShelfItem.itemType, itemType),
        eq(ShelfItem.itemId, itemId),
      ),
    )
    .limit(1);
  return (row as ShelfItemSyncRow | undefined) ?? null;
}

async function listShelfItemSyncRows(input: {
  limit: number;
  cursor?: string;
  shelfId?: string;
  itemType?: string;
  itemId?: string;
}): Promise<ShelfItemSyncRow[]> {
  const cursor = input.cursor ? parseShelfItemCursor(input.cursor) : null;
  const filters = [
    input.shelfId ? eq(ShelfItem.shelfId, input.shelfId) : undefined,
    input.itemType ? eq(ShelfItem.itemType, input.itemType) : undefined,
    input.itemId ? eq(ShelfItem.itemId, input.itemId) : undefined,
    cursor
      ? sql`(${ShelfItem.shelfId}, ${ShelfItem.itemType}, ${ShelfItem.itemId}) > (${cursor.shelfId}, ${cursor.itemType}, ${cursor.itemId})`
      : undefined,
  ].filter(Boolean);
  const query = getSearchDb().select(shelfItemSyncSelect()).from(ShelfItem);
  const ordered = filters.length
    ? query.where(and(...(filters as Parameters<typeof and>)))
    : query;
  return (await ordered
    .orderBy(
      asc(ShelfItem.shelfId),
      asc(ShelfItem.itemType),
      asc(ShelfItem.itemId),
    )
    .limit(input.limit)) as ShelfItemSyncRow[];
}

function shelfItemNextCursor(row: ShelfItemSyncRow): string {
  return `${row.shelfId}:${row.itemType}:${row.itemId}`;
}

export async function syncShelfItem(
  client: SearchClient,
  row: ShelfItemSyncRow,
): Promise<void> {
  await client.addOrUpdateShelfItems([
    buildShelfItemDocument(toShelfItemDocumentRow(row)),
  ]);
}

export async function syncSingleShelfItem(
  client: SearchClient,
  shelfId: string,
  itemType: string,
  itemId: string,
): Promise<void> {
  const row = await findShelfItemSyncRow(shelfId, itemType, itemId);
  if (!row) {
    await removeShelfItem(client, shelfId, itemType, itemId);
    return;
  }
  await syncShelfItem(client, row);
}

export async function removeShelfItem(
  client: SearchClient,
  shelfId: string,
  itemType: string,
  itemId: string,
): Promise<void> {
  await client.deleteShelfItems([
    shelfItemDocumentId({ shelfId, itemType, itemId }),
  ]);
}

export async function syncShelfItemSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listShelfItemSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const current = rows.slice(0, limit);
  const hasMore = rows.length > limit && current.length > 0;
  if (current.length > 0) {
    await client.addOrUpdateShelfItems(
      current.map((row) => buildShelfItemDocument(toShelfItemDocumentRow(row))),
    );
  }
  const last = current.at(-1);
  return {
    processed: current.length,
    ...(hasMore && last ? { nextCursor: shelfItemNextCursor(last) } : {}),
  };
}

export async function syncShelfItemsByShelfSegment(
  client: SearchClient,
  shelfId: string,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listShelfItemSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
    shelfId,
  });
  const current = rows.slice(0, limit);
  const hasMore = rows.length > limit && current.length > 0;
  if (current.length > 0) {
    await client.addOrUpdateShelfItems(
      current.map((row) => buildShelfItemDocument(toShelfItemDocumentRow(row))),
    );
  }
  const last = current.at(-1);
  return {
    processed: current.length,
    ...(hasMore && last ? { nextCursor: shelfItemNextCursor(last) } : {}),
  };
}

export async function syncShelfItemsBySourceItemSegment(
  client: SearchClient,
  itemType: string,
  itemId: string,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listShelfItemSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
    itemType,
    itemId,
  });
  const current = rows.slice(0, limit);
  const hasMore = rows.length > limit && current.length > 0;
  if (current.length > 0) {
    await client.addOrUpdateShelfItems(
      current.map((row) => buildShelfItemDocument(toShelfItemDocumentRow(row))),
    );
  }
  const last = current.at(-1);
  return {
    processed: current.length,
    ...(hasMore && last ? { nextCursor: shelfItemNextCursor(last) } : {}),
  };
}

export async function syncAllShelfItems(client: SearchClient) {
  const deleteResult = await client.deleteAllShelfItems();
  console.log("syncAllShelfItems: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const result = await syncShelfItemSegment(client, { cursor });
    total += result.processed;
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return { message: "syncAllShelfItems success", totalSynced: total };
}

// ANCHOR: Incremental single-unit sync
// ANCHOR: 单个 unit 的增量同步

export async function syncSingleContent(client: SearchClient, unitId: string) {
  const unitBase = await findContentBaseRow(unitId);

  // If unit doesn't exist or doesn't qualify, remove from index
  // 若 unit 不存在或不符合条件，则从索引中移除
  if (
    !unitBase ||
    !INDEXABLE_TYPES.includes(unitBase.type as any) ||
    unitBase.status !== PUBLIC_ELIGIBLE_UNIT_WHERE.status ||
    unitBase.visibility !== PUBLIC_ELIGIBLE_UNIT_WHERE.visibility ||
    unitBase.moderationStatus !== PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus ||
    !(
      unitBase.catalogEntryKind === null ||
      unitBase.catalogEntryKind === undefined ||
      unitBase.catalogEntryKind === "MAIN"
    )
  ) {
    await client.deleteContent([unitId]);
    return;
  }

  const [unit] = await hydrateContentRows([unitBase]);
  const doc = buildContentDocument(unit);
  await client.addOrUpdateContent([doc]);
}

// ANCHOR: Content partial sync functions
// ANCHOR: 内容部分同步函数

export async function patchContentTags(client: SearchClient, unitId: string) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const unitTags = await getSearchDb()
    .select({
      tagUnitId: UnitTag.tagUnitId,
      score: UnitTag.score,
      title: UnitTranslation.title,
    })
    .from(UnitTag)
    .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, UnitTag.tagUnitId))
    .where(
      and(
        eq(UnitTag.unitId, unitId),
        or(gt(UnitTag.score, VISIBILITY_THRESHOLD), eq(UnitTag.pinned, true)),
      ),
    )
    .orderBy(desc(UnitTag.score));

  const tagIds = [...new Set(unitTags.map((ut: any) => ut.tagUnitId))];
  const tagScores: Record<string, number> = {};
  const tagLabels: string[] = [];
  for (const ut of unitTags) {
    tagScores[ut.tagUnitId] = ut.score;
    if (ut.title) tagLabels.push(ut.title);
  }

  await patchContentIfEligible(client, unitId, {
    tagIds,
    tagScores,
    tagLabels,
  });
}

export async function patchContentAliases(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const aliases = await getSearchDb()
    .select()
    .from(UnitAlias)
    .where(
      and(
        eq(UnitAlias.unitId, unitId),
        eq(UnitAlias.status, "ACTIVE"),
        or(
          gt(UnitAlias.score, VISIBILITY_THRESHOLD),
          eq(UnitAlias.pinned, true),
        ),
      ),
    )
    .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score));

  await patchContentIfEligible(client, unitId, {
    aliasValues: aliases.map((alias: any) => alias.value).filter(Boolean),
  });
}

export async function patchContentCredits(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const creditAttributions = await getSearchDb()
    .select({
      entityId: CreditAttribution.entityId,
      role: CreditAttribution.role,
      title: UnitTranslation.title,
    })
    .from(CreditAttribution)
    .leftJoin(
      UnitTranslation,
      eq(UnitTranslation.unitId, CreditAttribution.entityId),
    )
    .where(eq(CreditAttribution.unitId, unitId))
    .orderBy(asc(CreditAttribution.sortOrder));

  const seenCredits = new Set<string>();
  const creditNames: string[] = [];
  for (const attribution of creditAttributions as any[]) {
    const key = `${attribution.entityId}:${attribution.role}`;
    if (seenCredits.has(key)) continue;
    seenCredits.add(key);
    if (isNonEmptyString(attribution.title)) {
      creditNames.push(attribution.title);
    }
  }

  await patchContentIfEligible(client, unitId, { creditNames });
}

export async function patchContentSubjects(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const subjectAttributions = await getSearchDb()
    .select({
      entityId: SubjectAttribution.entityId,
      role: SubjectAttribution.role,
      kind: Entity.kind,
      title: UnitTranslation.title,
    })
    .from(SubjectAttribution)
    .leftJoin(Entity, eq(Entity.unitId, SubjectAttribution.entityId))
    .leftJoin(
      UnitTranslation,
      eq(UnitTranslation.unitId, SubjectAttribution.entityId),
    )
    .where(eq(SubjectAttribution.unitId, unitId))
    .orderBy(asc(SubjectAttribution.sortOrder));

  const subjectEntityIds: string[] = [];
  const seenSubjects = new Set<string>();
  for (const attribution of subjectAttributions as any[]) {
    const key = `${attribution.entityId}:${attribution.role}`;
    if (seenSubjects.has(key)) continue;
    seenSubjects.add(key);
    subjectEntityIds.push(attribution.entityId);
  }
  const subjectNames = (subjectAttributions as any[])
    .map((a: any) => a.title)
    .filter(Boolean);
  const subjectKinds = [
    ...new Set(
      (subjectAttributions as any[]).map((a: any) => a.kind).filter(Boolean),
    ),
  ];
  const subjectRoles = [
    ...new Set(
      (subjectAttributions as any[]).map((a: any) => a.role).filter(Boolean),
    ),
  ];

  await patchContentIfEligible(client, unitId, {
    subjectEntityIds,
    subjectNames,
    subjectKinds,
    subjectRoles,
  });
}

export async function patchContentTranslations(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const [translations, supportLanguages] = await Promise.all([
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, unitId)),
    getSearchDb()
      .select()
      .from(UnitSupportLanguage)
      .where(eq(UnitSupportLanguage.unitId, unitId)),
  ]);

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const subtitles = translations.map((t: any) => t.subtitle).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const descriptions = translations
    .map((t: any) => mainMarkdownSource(t.description))
    .filter(isNonEmptyString);
  const descriptionText = descriptions.join("\n") || null;
  const languages = indexedLanguages({ supportLanguages });

  await patchContentIfEligible(client, unitId, {
    titles,
    subtitles,
    descriptionText,
    summaries,
    descriptions,
    languages,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
      description: tr.description ?? null,
    })),
  });
}

export async function patchContentRealmIds(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const inRealms = await getSearchDb()
    .select({
      realmUnitId: UnitRealm.realmUnitId,
      moderationStatus: UnitRealm.moderationStatus,
      isLocked: UnitRealm.isLocked,
      realmIsPublic: Realm.isPublic,
    })
    .from(UnitRealm)
    .leftJoin(Realm, eq(Realm.unitId, UnitRealm.realmUnitId))
    .where(
      and(
        eq(UnitRealm.unitId, unitId),
        eq(UnitRealm.moderationStatus, "APPROVED"),
      ),
    );

  const realmIds = (inRealms as any[])
    .filter((realm) => realm.realmIsPublic !== false)
    .map((realm) => realm.realmUnitId);
  await patchContentIfEligible(client, unitId, { realmIds });
}

export async function patchContentRealmTagKeys(
  client: SearchClient,
  unitId: string,
) {
  if (!(await isContentPatchEligible(unitId))) {
    await client.deleteContent([unitId]);
    return;
  }
  const realmTagApplicationsAsTargetUnit = await getSearchDb()
    .select({
      realmUnitId: RealmTagApplication.realmUnitId,
      tagUnitId: RealmTagApplication.tagUnitId,
    })
    .from(RealmTagApplication)
    .where(eq(RealmTagApplication.unitId, unitId));

  const realmTagKeys = realmTagApplicationsAsTargetUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );
  await patchContentIfEligible(client, unitId, { realmTagKeys });
}

export async function patchContentMetadata(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  if ("status" in fields || "visibility" in fields) {
    await syncSingleContent(client, unitId);
    return;
  }
  await patchContentIfEligible(client, unitId, fields);
}

/**
 * Recompute the post-state `containedUnitIds` for a SHELF unit and push a
 * partial update to Meilisearch. The caller is responsible for invoking this
 * after every ShelfItem insert/delete on the shelf.
 * 为 SHELF unit 重新计算变更后的 `containedUnitIds`，并向 Meilisearch 推送一次
 * 部分更新。调用方负责在该书架上每次 ShelfItem 插入/删除后调用此函数。
 */
export async function patchContentContainedUnitIds(
  client: SearchClient,
  shelfId: string,
) {
  if (!(await isContentPatchEligible(shelfId))) {
    await client.deleteContent([shelfId]);
    return;
  }
  const units = await getSearchDb()
    .select({ unitId: ShelfItem.itemId })
    .from(ShelfItem)
    .where(and(eq(ShelfItem.shelfId, shelfId), eq(ShelfItem.itemType, "unit")))
    .orderBy(asc(ShelfItem.position));
  const containedUnitIds = units.map((u: any) => u.unitId);
  await patchContentIfEligible(client, shelfId, { containedUnitIds });
}

export type ContentRankingPatch = {
  bestScore: number;
  hotScore: number;
  topScore: number;
  risingScore: number;
  controversyScore: number;
  trendingScore: number;
  qualityScore: number;
  rankUpdatedAt: string | null;
};

export type PostRankingPatch = ContentRankingPatch;

export type CommentRankingPatch = Omit<ContentRankingPatch, "trendingScore">;

export async function patchContentRankingFields(
  client: SearchClient,
  unitId: string,
  fields: ContentRankingPatch,
) {
  await patchContentIfEligible(client, unitId, fields);
}

export async function patchPostRankingFields(
  client: SearchClient,
  unitId: string,
  fields: PostRankingPatch,
) {
  await patchPostFields(client, unitId, fields);
}

export async function patchCommentRankingFields(
  client: SearchClient,
  unitId: string,
  fields: CommentRankingPatch,
) {
  await client.patchComments([{ id: unitId, ...fields }]);
}

// ANCHOR: Post partial sync functions
// ANCHOR: Post 部分同步函数

function publicPostUnitConditions() {
  return and(
    eq(Unit.status, PUBLIC_ELIGIBLE_UNIT_WHERE.status),
    eq(Unit.visibility, PUBLIC_ELIGIBLE_UNIT_WHERE.visibility),
    eq(Unit.moderationStatus, PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus),
  );
}

async function listPublicPostIdsByAuthor(input: {
  userId: string;
  limit: number;
  cursor?: string;
}) {
  const query = getSearchDb()
    .select({ unitId: Post.unitId })
    .from(Post)
    .leftJoin(Unit, eq(Unit.id, Post.unitId));
  return input.cursor
    ? query
        .where(
          and(
            eq(Post.authorUserId, input.userId),
            publicPostUnitConditions(),
            gt(Post.unitId, input.cursor),
          ),
        )
        .orderBy(asc(Post.unitId))
        .limit(input.limit)
    : query
        .where(
          and(eq(Post.authorUserId, input.userId), publicPostUnitConditions()),
        )
        .orderBy(asc(Post.unitId))
        .limit(input.limit);
}

async function listPublicPostIdsByTarget(input: {
  targetUnitId: string;
  limit: number;
  cursor?: string;
}) {
  const query = getSearchDb()
    .select({ unitId: Post.unitId })
    .from(Post)
    .leftJoin(Unit, eq(Unit.id, Post.unitId));
  return input.cursor
    ? query
        .where(
          and(
            eq(Unit.targetUnitId, input.targetUnitId),
            publicPostUnitConditions(),
            gt(Post.unitId, input.cursor),
          ),
        )
        .orderBy(asc(Post.unitId))
        .limit(input.limit)
    : query
        .where(
          and(
            eq(Unit.targetUnitId, input.targetUnitId),
            publicPostUnitConditions(),
          ),
        )
        .orderBy(asc(Post.unitId))
        .limit(input.limit);
}

async function targetPostPatchFields(targetUnitId: string) {
  const [targetUnit] = await getSearchDb()
    .select({
      id: Unit.id,
      type: Unit.type,
      defaultLanguage: Unit.defaultLanguage,
    })
    .from(Unit)
    .where(eq(Unit.id, targetUnitId))
    .limit(1);

  if (!targetUnit) {
    return {
      targetTitles: null,
      targetType: null,
      targetCoverUrl: null,
    };
  }

  const translations = await getSearchDb()
    .select()
    .from(UnitTranslation)
    .where(eq(UnitTranslation.unitId, targetUnitId));

  return {
    targetTitles: translations.map((t: any) => t.title).filter(Boolean),
    targetType: targetUnit.type ?? null,
    targetCoverUrl: pickCoverUrlFromTranslations(
      targetUnit.defaultLanguage,
      translations,
    ),
  };
}

export async function patchPostsAuthor(
  client: SearchClient,
  userId: string,
  fields: Record<string, any>,
) {
  let cursor: string | undefined;

  while (true) {
    const posts = await listPublicPostIdsByAuthor({
      userId,
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p: any) => ({ id: p.unitId, ...fields }));
    await client.patchPosts(docs);

    cursor = posts[posts.length - 1]!.unitId;
  }
}

export async function syncPostsByAuthorSegment(
  client: SearchClient,
  userId: string,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listPostSyncRows({
    authorUserId: userId,
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(rows, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdatePosts(current.map(buildPostDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function patchPostsTarget(
  client: SearchClient,
  targetUnitId: string,
) {
  const targetFields = await targetPostPatchFields(targetUnitId);

  let cursor: string | undefined;

  while (true) {
    const posts = await listPublicPostIdsByTarget({
      targetUnitId,
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p: any) => ({
      id: p.unitId,
      ...targetFields,
    }));
    await client.patchPosts(docs);

    cursor = posts[posts.length - 1]!.unitId;
  }
}

export async function patchPostsTargetSegment(
  client: SearchClient,
  targetUnitId: string,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const targetFields = await targetPostPatchFields(targetUnitId);

  const limit = segmentLimit(options);
  const rows = await listPublicPostIdsByTarget({
    targetUnitId,
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(rows, limit, "unitId");
  if (current.length > 0) {
    await client.patchPosts(
      current.map((post) => ({
        id: post.unitId,
        ...targetFields,
      })),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function patchPostFields(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  const [post] = await getSearchDb()
    .select({
      unitId: Post.unitId,
      status: Unit.status,
      visibility: Unit.visibility,
      moderationStatus: Unit.moderationStatus,
    })
    .from(Post)
    .leftJoin(Unit, eq(Unit.id, Post.unitId))
    .where(eq(Post.unitId, unitId))
    .limit(1);
  if (!post || !isPublicIndexablePostUnit(post)) {
    await client.deletePosts([unitId]);
    return;
  }
  const nextFields = { ...fields };
  if ("content" in nextFields) {
    nextFields.contentText = mainMarkdownSource(nextFields.content);
    delete nextFields.content;
  }
  await client.patchPosts([{ id: unitId, ...nextFields }]);
}

// ANCHOR: Realm partial sync functions
// ANCHOR: Realm 部分同步函数

export async function patchRealmMemberCount(
  client: SearchClient,
  unitId: string,
  memberCount: number,
) {
  await client.patchRealms([{ id: unitId, memberCount }]);
}

export async function patchRealmMemberCountFromDb(
  client: SearchClient,
  unitId: string,
) {
  const [realm] = await getSearchDb()
    .select({ memberCount: Realm.memberCount })
    .from(Realm)
    .where(eq(Realm.unitId, unitId))
    .limit(1);
  if (!realm) {
    await client.deleteRealms([unitId]);
    return;
  }
  await patchRealmMemberCount(client, unitId, realm.memberCount);
}

export async function patchRealmMetadata(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  await client.patchRealms([{ id: unitId, ...fields }]);
}

export async function patchRealmTranslations(
  client: SearchClient,
  unitId: string,
) {
  const translations = await getSearchDb()
    .select()
    .from(UnitTranslation)
    .where(eq(UnitTranslation.unitId, unitId));

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => searchDescriptionText(t.description))
    .filter(isNonEmptyString);
  const descriptionText = descriptions.join("\n") || null;

  await client.patchRealms([
    {
      id: unitId,
      titles,
      descriptions,
      descriptionText,
      translations: translations.map((tr: any) => ({
        language: tr.language,
        title: tr.title ?? null,
        description: searchDescriptionText(tr.description),
      })),
    },
  ]);
}

export async function patchRealmAliases(client: SearchClient, unitId: string) {
  const [realm] = await getSearchDb()
    .select({ unitId: Realm.unitId, unitStatus: Unit.status })
    .from(Realm)
    .leftJoin(Unit, eq(Unit.id, Realm.unitId))
    .where(eq(Realm.unitId, unitId))
    .limit(1);
  if (!realm || realm.unitStatus !== "PUBLISHED") {
    await client.deleteRealms([unitId]);
    return;
  }

  const aliases = await getSearchDb()
    .select()
    .from(UnitAlias)
    .where(
      and(
        eq(UnitAlias.unitId, unitId),
        eq(UnitAlias.status, "ACTIVE"),
        or(
          gt(UnitAlias.score, VISIBILITY_THRESHOLD),
          eq(UnitAlias.pinned, true),
        ),
      ),
    )
    .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score));

  await client.patchRealms([
    {
      id: unitId,
      aliasValues: aliases.map((alias: any) => alias.value).filter(Boolean),
    },
  ]);
}

// ANCHOR: User and feedback partial sync functions
// ANCHOR: 用户与反馈部分同步函数

type UserSyncRow = {
  unitId: string;
  email: string | null;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  description: unknown;
  followersCount: number;
  followingsCount: number;
  joinDate: Date | string | null;
  permission: unknown;
  slug: string | null;
};

const userSyncSelect = {
  unitId: User.unitId,
  email: User.email,
  name: User.name,
  avatar: User.avatar,
  bio: User.bio,
  description: User.description,
  followersCount: User.followersCount,
  followingsCount: User.followingsCount,
  joinDate: User.joinDate,
  permission: User.permission,
  slug: Unit.slug,
} as const;

function buildUserSearchDocument(row: UserSyncRow): UserSearchDocument {
  return {
    id: row.unitId,
    unitId: row.unitId,
    name: row.name ?? row.email ?? row.unitId,
    email: row.email ?? undefined,
    slug: row.slug ?? null,
    avatar: row.avatar,
    bio: row.bio,
    description: row.description as UserSearchDocument["description"],
    descriptionText: mainMarkdownSource(row.description),
    followersCount: row.followersCount,
    followingsCount: row.followingsCount,
    joinDate:
      row.joinDate instanceof Date
        ? row.joinDate.toISOString()
        : (row.joinDate ?? null),
    permission: (row.permission ?? null) as any,
  };
}

async function findUserSyncRow(unitId: string): Promise<UserSyncRow | null> {
  const [row] = await getSearchDb()
    .select(userSyncSelect)
    .from(User)
    .leftJoin(Unit, eq(Unit.id, User.unitId))
    .where(eq(User.unitId, unitId))
    .limit(1);
  return (row as UserSyncRow | undefined) ?? null;
}

async function listUserSyncRows(input: {
  limit: number;
  cursor?: string;
}): Promise<UserSyncRow[]> {
  const db = getSearchDb();
  const query = db
    .select(userSyncSelect)
    .from(User)
    .leftJoin(Unit, eq(Unit.id, User.unitId));

  const rows = input.cursor
    ? await query
        .where(gt(User.unitId, input.cursor))
        .orderBy(asc(User.unitId))
        .limit(input.limit)
    : await query.orderBy(asc(User.unitId)).limit(input.limit);

  return rows as UserSyncRow[];
}

export async function syncSingleUser(client: SearchClient, unitId: string) {
  const user = await findUserSyncRow(unitId);
  if (!user) {
    await client.deleteUsers([unitId]);
    return;
  }

  await client.addOrUpdateUsers([buildUserSearchDocument(user)]);
}

export async function patchUserFields(
  client: SearchClient,
  unitId: string,
  fields: Record<string, any>,
) {
  const nextFields = { ...fields };
  if ("description" in nextFields) {
    nextFields.descriptionText = mainMarkdownSource(nextFields.description);
  }
  await client.patchUsers([{ id: unitId, ...nextFields }]);
}

export async function patchFeedbackResolution(
  client: SearchClient,
  id: string,
  fields: Record<string, any>,
) {
  await client.patchFeedbacks([{ id, ...fields }]);
}

export async function patchFeedbackResolutionFromDb(
  client: SearchClient,
  id: string,
) {
  const feedback = await findFeedbackSyncRow(id);
  if (!feedback) {
    await client.deleteFeedbacks([id]);
    return;
  }

  await patchFeedbackResolution(client, id, {
    resolved: feedback.resolved,
    resolvedAt: feedback.resolvedAt?.toISOString() ?? null,
  });
}

// ANCHOR: Feedbacks sync
// ANCHOR: 反馈同步

export function buildFeedbackSearchDocument(
  feedback: any,
): FeedbackSearchDocument {
  return {
    id: feedback.id,
    userId: feedback.userId,
    targetKind: lower<NonNullable<FeedbackSearchDocument["targetKind"]>>(
      feedback.targetKind,
    ),
    targetId: feedback.targetId,
    addressedUnitId: feedback.addressedUnitId,
    type: feedback.type,
    content: feedback.content,
    url: feedback.url,
    resolved: feedback.resolved,
    resolvedAt: feedback.resolvedAt,
    createdAt:
      feedback.createdAt instanceof Date
        ? feedback.createdAt.toISOString()
        : feedback.createdAt,
    updatedAt:
      feedback.updatedAt instanceof Date
        ? feedback.updatedAt.toISOString()
        : feedback.updatedAt,
  };
}

type FeedbackSyncRow = typeof Feedback.$inferSelect;

async function findFeedbackSyncRow(
  id: string,
): Promise<FeedbackSyncRow | null> {
  const [row] = await getSearchDb()
    .select()
    .from(Feedback)
    .where(eq(Feedback.id, id))
    .limit(1);
  return (row as FeedbackSyncRow | undefined) ?? null;
}

async function listFeedbackSyncRows(input: {
  limit: number;
  cursor?: string;
}): Promise<FeedbackSyncRow[]> {
  const db = getSearchDb();
  const query = db.select().from(Feedback);
  const rows = input.cursor
    ? await query
        .where(gt(Feedback.id, input.cursor))
        .orderBy(asc(Feedback.id))
        .limit(input.limit)
    : await query.orderBy(asc(Feedback.id)).limit(input.limit);
  return rows as FeedbackSyncRow[];
}

export async function syncSingleFeedback(client: SearchClient, id: string) {
  const feedback = await findFeedbackSyncRow(id);
  if (!feedback) {
    await client.deleteFeedbacks([id]);
    return;
  }

  await client.addOrUpdateFeedbacks([buildFeedbackSearchDocument(feedback)]);
}

export async function syncAllFeedbacks(client: SearchClient) {
  const deleteResult = await client.deleteAllFeedbacks();
  console.log("syncAllFeedbacks: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllFeedbacks: cursor", cursor, "total", total);

    const feedbacks = await listFeedbackSyncRows({ limit: BATCH_SIZE, cursor });

    if (feedbacks.length === 0) break;

    const formatted: FeedbackSearchDocument[] = feedbacks.map(
      buildFeedbackSearchDocument,
    );

    const addResult = await client.addOrUpdateFeedbacks(formatted);
    console.log("syncAllFeedbacks: added batch", addResult);

    total += formatted.length;
    cursor = feedbacks[feedbacks.length - 1]!.id;
  }

  return { message: "syncAllFeedbacks success", totalSynced: total };
}

export async function syncFeedbackSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const feedbacks = await listFeedbackSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(feedbacks, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateFeedbacks(current.map(buildFeedbackSearchDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Post document builder
// ANCHOR: Post 文档构建器

function languageOrder(unit: any, rows: any[]): string[] {
  const supportLanguages = unit?.supportLanguages ?? [];
  return [
    unit?.defaultLanguage,
    supportLanguages.find((language: any) => language.isPrimary)?.language,
    ...[...supportLanguages]
      .sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((language: any) => language.language),
    ...rows.map((row: any) => row.language),
  ].filter(
    (language, index, self): language is string =>
      Boolean(language) && self.indexOf(language) === index,
  );
}

function resolvePostTitleText(post: any): string | null {
  const translations = post.unit?.translations ?? [];
  const byLanguage = new Map(
    translations.map((translation: any) => [
      translation.language,
      translation.title,
    ]),
  );
  for (const language of languageOrder(post.unit, translations)) {
    const title = byLanguage.get(language);
    if (typeof title === "string" && title.trim()) return title;
  }
  return null;
}

function resolvePostContent(post: any): unknown {
  const translations = post.unit?.contentTranslations ?? [];
  const byLanguage = new Map(
    translations.map((translation: any) => [
      translation.language,
      translation.content,
    ]),
  );
  for (const language of languageOrder(post.unit, translations)) {
    if (byLanguage.has(language)) return byLanguage.get(language);
  }
  return null;
}

function isPublicIndexableComment(comment: any): boolean {
  return (
    comment?.moderationStatus === "APPROVED" &&
    (comment?.deletedAt === null || comment?.deletedAt === undefined)
  );
}

export function buildCommentDocument(comment: any): CommentSearchDocument {
  const user = comment.author;
  return {
    id: comment.id,
    contentText: mainMarkdownSource(comment.content),
    rootUnitId: comment.rootUnitId,
    realmUnitId: comment.realmUnitId ?? null,
    parentCommentId: comment.parentCommentId ?? null,
    authorUserId: comment.authorUserId,
    depth: comment.depth,
    isLocked: comment.isLocked,
    replyCount: comment.replyCount,
    directReplyCount: comment.directReplyCount,
    lastReplyAt: comment.lastReplyAt
      ? comment.lastReplyAt instanceof Date
        ? comment.lastReplyAt.toISOString()
        : comment.lastReplyAt
      : null,
    state: comment.state ?? null,
    moderationStatus: comment.moderationStatus ?? "APPROVED",
    createdAt:
      comment.createdAt instanceof Date
        ? comment.createdAt.toISOString()
        : comment.createdAt,
    updatedAt:
      comment.updatedAt instanceof Date
        ? comment.updatedAt.toISOString()
        : comment.updatedAt,
    bestScore: 0,
    hotScore: 0,
    topScore: 0,
    risingScore: 0,
    controversyScore: 0,
    qualityScore: 0,
    rankUpdatedAt: null,
    authorName: user?.name ?? null,
    authorSlug: user?.slug ?? null,
    authorAvatar: user?.avatar ?? null,
  };
}

export function buildPostDocument(post: any): PostSearchDocument {
  const user = post.unit?.user;
  const targetUnit = post.unit?.targetUnit ?? post.targetUnit;
  const scoreEntry = post.scoreEntry;
  const unitTranslations: any[] = post.unit?.translations ?? [];
  const contentTranslations: any[] = post.unit?.contentTranslations ?? [];

  // Denormalized target unit info
  // 反规范化的目标 unit 信息
  let targetTitles: string[] | null = null;
  let targetType: string | null = null;
  let targetCoverUrl: string | null = null;

  if (targetUnit) {
    const translations: any[] = targetUnit.translations ?? [];
    targetTitles = translations.map((t: any) => t.title).filter(Boolean);
    targetType = targetUnit.type ?? null;
    targetCoverUrl = pickCoverUrlFromTranslations(
      (targetUnit as any).defaultLanguage,
      translations,
    );
  }

  return {
    id: post.unitId,
    titleText: resolvePostTitleText(post),
    contentText: mainMarkdownSource(resolvePostContent(post)),
    kind: post.kind ?? null,
    isLocked: post.isLocked,
    replyCount: post.replyCount,
    directReplyCount: post.directReplyCount,
    lastReplyAt: post.lastReplyAt
      ? post.lastReplyAt instanceof Date
        ? post.lastReplyAt.toISOString()
        : post.lastReplyAt
      : null,
    createdAt:
      post.createdAt instanceof Date
        ? post.createdAt.toISOString()
        : post.createdAt,
    updatedAt:
      post.updatedAt instanceof Date
        ? post.updatedAt.toISOString()
        : post.updatedAt,
    bestScore: 0,
    hotScore: 0,
    topScore: 0,
    risingScore: 0,
    controversyScore: 0,
    trendingScore: 0,
    qualityScore: 0,
    rankUpdatedAt: null,
    targetUnitId: post.unit?.targetUnitId ?? null,
    variantUnitId: post.variantUnitId ?? null,
    realmIds: realmIdsForSearch(post.unit),
    authorUserId: post.authorUserId,
    scoreEntryId: post.scoreEntryId ?? null,
    authorName: user?.name ?? null,
    authorSlug: user?.slug ?? null,
    authorAvatar: user?.avatar ?? null,
    targetTitles,
    targetType,
    targetCoverUrl,
    scoreValue: scoreEntry?.value ?? null,
    scoreFields: scoreEntry?.fields ?? null,
    extra: post.extra ?? undefined,
    languages: indexedLanguages(post.unit ?? {}),
    isLanguageNeutral: Boolean(post.unit?.isLanguageNeutral),
    supportLanguages: indexedSupportLanguages(post.unit ?? {}),
    translations: unitTranslations.map((translation: any) => ({
      language: translation.language,
      title: translation.title ?? null,
      content:
        contentTranslations.find(
          (contentTranslation: any) =>
            contentTranslation.language === translation.language,
        )?.content ?? null,
    })),
  };
}

type PostSyncRow = {
  unitId: string;
  authorUserId: string;
  scoreEntryId: string | null;
  kind: string | null;
  replyCount: number;
  directReplyCount: number;
  lastReplyAt: Date | string | null;
  isLocked: boolean;
  extra: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
  variantUnitId: string | null;
  targetUnitId: string | null;
  unitStatus: string | null;
  unitVisibility: string | null;
  unitModerationStatus: string | null;
  unitDefaultLanguage: string | null;
  unitIsLanguageNeutral: boolean | null;
  unitUserId: string | null;
};

const postSyncSelect = {
  unitId: Post.unitId,
  authorUserId: Post.authorUserId,
  scoreEntryId: Post.scoreEntryId,
  kind: Post.kind,
  replyCount: Post.replyCount,
  directReplyCount: Post.directReplyCount,
  lastReplyAt: Post.lastReplyAt,
  isLocked: Post.isLocked,
  extra: Post.extra,
  createdAt: Post.createdAt,
  updatedAt: Post.updatedAt,
  variantUnitId: Post.variantUnitId,
  targetUnitId: Unit.targetUnitId,
  unitStatus: Unit.status,
  unitVisibility: Unit.visibility,
  unitModerationStatus: Unit.moderationStatus,
  unitDefaultLanguage: Unit.defaultLanguage,
  unitIsLanguageNeutral: Unit.isLanguageNeutral,
  unitUserId: Unit.userId,
} as const;

async function listPostBaseRows(input: {
  limit: number;
  cursor?: string;
  authorUserId?: string;
  targetUnitId?: string;
}) {
  const conditions = [publicPostUnitConditions()];
  if (input.cursor) conditions.push(gt(Post.unitId, input.cursor));
  if (input.authorUserId)
    conditions.push(eq(Post.authorUserId, input.authorUserId));
  if (input.targetUnitId)
    conditions.push(eq(Unit.targetUnitId, input.targetUnitId));
  return getSearchDb()
    .select(postSyncSelect)
    .from(Post)
    .leftJoin(Unit, eq(Unit.id, Post.unitId))
    .where(and(...conditions))
    .orderBy(asc(Post.unitId))
    .limit(input.limit);
}

async function findPostBaseRow(unitId: string) {
  const [row] = await getSearchDb()
    .select(postSyncSelect)
    .from(Post)
    .leftJoin(Unit, eq(Unit.id, Post.unitId))
    .where(eq(Post.unitId, unitId))
    .limit(1);
  return (row as PostSyncRow | undefined) ?? null;
}

async function hydratePostRows(rows: PostSyncRow[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.unitId);
  const authorUserIds = [...new Set(rows.map((row) => row.authorUserId))];
  const targetUnitIds = [
    ...new Set(rows.map((row) => row.targetUnitId).filter(isNonEmptyString)),
  ];
  const scoreEntryIds = [
    ...new Set(rows.map((row) => row.scoreEntryId).filter(isNonEmptyString)),
  ];

  const [
    authors,
    translations,
    contentTranslations,
    supportLanguages,
    unitRealms,
    targetUnits,
    targetTranslations,
    scoreEntries,
  ] = await Promise.all([
    getSearchDb()
      .select()
      .from(User)
      .where(inArray(User.unitId, authorUserIds)),
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(ContentTranslation)
      .where(inArray(ContentTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, unitIds)),
    getSearchDb()
      .select({
        unitId: UnitRealm.unitId,
        realmUnitId: UnitRealm.realmUnitId,
        moderationStatus: UnitRealm.moderationStatus,
        isLocked: UnitRealm.isLocked,
        realmIsPublic: Realm.isPublic,
      })
      .from(UnitRealm)
      .leftJoin(Realm, eq(Realm.unitId, UnitRealm.realmUnitId))
      .where(inArray(UnitRealm.unitId, unitIds)),
    targetUnitIds.length > 0
      ? getSearchDb().select().from(Unit).where(inArray(Unit.id, targetUnitIds))
      : Promise.resolve([]),
    targetUnitIds.length > 0
      ? getSearchDb()
          .select()
          .from(UnitTranslation)
          .where(inArray(UnitTranslation.unitId, targetUnitIds))
      : Promise.resolve([]),
    scoreEntryIds.length > 0
      ? getSearchDb()
          .select()
          .from(ScoreEntry)
          .where(inArray(ScoreEntry.id, scoreEntryIds))
      : Promise.resolve([]),
  ]);

  const authorsByUnitId = new Map(
    (authors as any[]).map((author) => [author.unitId, author]),
  );
  const translationsByUnitId = groupRowsByKey(translations as any[], "unitId");
  const contentTranslationsByUnitId = groupRowsByKey(
    contentTranslations as any[],
    "unitId",
  );
  const supportLanguagesByUnitId = groupRowsByKey(
    supportLanguages as any[],
    "unitId",
  );
  const unitRealmsByUnitId = groupRowsByKey(unitRealms as any[], "unitId");
  const targetUnitsById = new Map(
    (targetUnits as any[]).map((unit) => [unit.id, unit]),
  );
  const targetTranslationsByUnitId = groupRowsByKey(
    targetTranslations as any[],
    "unitId",
  );
  const scoreEntriesById = new Map(
    (scoreEntries as any[]).map((entry) => [entry.id, entry]),
  );

  return rows.map((row) => {
    const targetUnit = row.targetUnitId
      ? targetUnitsById.get(row.targetUnitId)
      : null;
    if (targetUnit) {
      targetUnit.translations =
        targetTranslationsByUnitId.get(row.targetUnitId ?? "") ?? [];
    }
    return {
      unitId: row.unitId,
      authorUserId: row.authorUserId,
      scoreEntryId: row.scoreEntryId,
      kind: row.kind,
      replyCount: row.replyCount,
      directReplyCount: row.directReplyCount,
      lastReplyAt: row.lastReplyAt,
      isLocked: row.isLocked,
      extra: row.extra,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      variantUnitId: row.variantUnitId,
      scoreEntry: row.scoreEntryId
        ? (scoreEntriesById.get(row.scoreEntryId) ?? null)
        : null,
      unit: {
        id: row.unitId,
        status: row.unitStatus,
        visibility: row.unitVisibility,
        moderationStatus: row.unitModerationStatus,
        targetUnitId: row.targetUnitId,
        defaultLanguage: row.unitDefaultLanguage,
        isLanguageNeutral: row.unitIsLanguageNeutral,
        userId: row.unitUserId,
        user: authorsByUnitId.get(row.authorUserId) ?? null,
        targetUnit: targetUnit ?? null,
        translations: translationsByUnitId.get(row.unitId) ?? [],
        contentTranslations: contentTranslationsByUnitId.get(row.unitId) ?? [],
        supportLanguages: supportLanguagesByUnitId.get(row.unitId) ?? [],
        inRealms: unitRealmsByUnitId.get(row.unitId) ?? [],
      },
    };
  });
}

async function listPostSyncRows(input: {
  limit: number;
  cursor?: string;
  authorUserId?: string;
  targetUnitId?: string;
}) {
  return hydratePostRows((await listPostBaseRows(input)) as PostSyncRow[]);
}

// ANCHOR: Post sync functions
// ANCHOR: Post 同步函数

export async function syncSinglePost(client: SearchClient, unitId: string) {
  const postBase = await findPostBaseRow(unitId);

  if (
    !postBase ||
    !isPublicIndexablePostUnit({
      status: postBase.unitStatus ?? "",
      visibility: postBase.unitVisibility ?? "",
      moderationStatus: postBase.unitModerationStatus,
    })
  ) {
    await client.deletePosts([unitId]);
    return;
  }

  const [post] = await hydratePostRows([postBase]);
  const doc = buildPostDocument(post);
  await client.addOrUpdatePosts([doc]);
}

export async function syncAllPosts(client: SearchClient) {
  const deleteResult = await client.deleteAllPosts();
  console.log("syncAllPosts: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllPosts: cursor", cursor, "total", total);

    const posts = await listPostSyncRows({
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    const addResult = await client.addOrUpdatePosts(docs);
    console.log("syncAllPosts: added batch", addResult);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPosts success", totalSynced: total };
}

export async function syncPostSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const posts = await listPostSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(posts, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdatePosts(current.map(buildPostDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Comment sync functions
// ANCHOR: 评论同步函数

const commentSyncSelect = {
  id: Comment.id,
  content: Comment.content,
  rootUnitId: Comment.rootUnitId,
  realmUnitId: Comment.realmUnitId,
  parentCommentId: Comment.parentCommentId,
  authorUserId: Comment.authorUserId,
  depth: Comment.depth,
  replyCount: Comment.replyCount,
  directReplyCount: Comment.directReplyCount,
  lastReplyAt: Comment.lastReplyAt,
  isLocked: Comment.isLocked,
  state: Comment.state,
  createdAt: Comment.createdAt,
  updatedAt: Comment.updatedAt,
  deletedAt: Comment.deletedAt,
  moderationStatus: Comment.moderationStatus,
  authorName: User.name,
  authorSlug: Unit.slug,
  authorAvatar: User.avatar,
} as const;

function commentFromRow(row: any) {
  return {
    id: row.id,
    content: row.content,
    rootUnitId: row.rootUnitId,
    realmUnitId: row.realmUnitId,
    parentCommentId: row.parentCommentId,
    authorUserId: row.authorUserId,
    depth: row.depth,
    replyCount: row.replyCount,
    directReplyCount: row.directReplyCount,
    lastReplyAt: row.lastReplyAt,
    isLocked: row.isLocked,
    state: row.state,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
    moderationStatus: row.moderationStatus,
    author: {
      name: row.authorName,
      slug: row.authorSlug,
      avatar: row.authorAvatar,
    },
  };
}

async function findCommentSyncRow(commentId: string) {
  const [row] = await getSearchDb()
    .select(commentSyncSelect)
    .from(Comment)
    .leftJoin(User, eq(User.unitId, Comment.authorUserId))
    .leftJoin(Unit, eq(Unit.id, Comment.authorUserId))
    .where(eq(Comment.id, commentId))
    .limit(1);
  return row ? commentFromRow(row) : null;
}

async function listCommentSyncRows(input: { limit: number; cursor?: string }) {
  const conditions = [
    eq(Comment.moderationStatus, "APPROVED"),
    isNull(Comment.deletedAt),
  ];
  if (input.cursor) conditions.push(gt(Comment.id, input.cursor));
  const rows = await getSearchDb()
    .select(commentSyncSelect)
    .from(Comment)
    .leftJoin(User, eq(User.unitId, Comment.authorUserId))
    .leftJoin(Unit, eq(Unit.id, Comment.authorUserId))
    .where(and(...conditions))
    .orderBy(asc(Comment.id))
    .limit(input.limit);
  return (rows as any[]).map(commentFromRow);
}

export async function syncSingleComment(
  client: SearchClient,
  commentId: string,
) {
  const comment = await findCommentSyncRow(commentId);

  if (!comment || !isPublicIndexableComment(comment)) {
    await client.deleteComments([commentId]);
    return;
  }

  await client.addOrUpdateComments([buildCommentDocument(comment)]);
}

export async function syncCommentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const comments = await listCommentSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(comments, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateComments(
      current.map((comment) => buildCommentDocument(comment)),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function syncAllComments(client: SearchClient) {
  const deleteResult = await client.deleteAllComments();
  console.log("syncAllComments: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const result = await syncCommentSegment(client, { cursor });
    total += result.processed;
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return { message: "syncAllComments success", totalSynced: total };
}

async function listPublicPostRealmRows(input: {
  limit: number;
  cursor?: string;
}) {
  const posts = await (input.cursor
    ? getSearchDb()
        .select({ unitId: Post.unitId })
        .from(Post)
        .leftJoin(Unit, eq(Unit.id, Post.unitId))
        .where(and(publicPostUnitConditions(), gt(Post.unitId, input.cursor)))
        .orderBy(asc(Post.unitId))
        .limit(input.limit)
    : getSearchDb()
        .select({ unitId: Post.unitId })
        .from(Post)
        .leftJoin(Unit, eq(Unit.id, Post.unitId))
        .where(publicPostUnitConditions())
        .orderBy(asc(Post.unitId))
        .limit(input.limit));
  const postIds = posts.map((post) => post.unitId);
  if (postIds.length === 0) return [];

  const inRealms = await getSearchDb()
    .select({
      unitId: UnitRealm.unitId,
      realmUnitId: UnitRealm.realmUnitId,
      moderationStatus: UnitRealm.moderationStatus,
      isLocked: UnitRealm.isLocked,
      realmIsPublic: Realm.isPublic,
    })
    .from(UnitRealm)
    .leftJoin(Realm, eq(Realm.unitId, UnitRealm.realmUnitId))
    .where(inArray(UnitRealm.unitId, postIds));
  const inRealmsByUnitId = groupRowsByKey(inRealms as any[], "unitId");
  return posts.map((post) => ({
    unitId: post.unitId,
    unit: { inRealms: inRealmsByUnitId.get(post.unitId) ?? [] },
  }));
}

async function listPublicShelfContainedUnitRows(input: {
  limit: number;
  cursor?: string;
}) {
  const shelves = await (input.cursor
    ? getSearchDb()
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            eq(Unit.type, "SHELF"),
            publicContentUnitConditions("single"),
            gt(Unit.id, input.cursor),
          ),
        )
        .orderBy(asc(Unit.id))
        .limit(input.limit)
    : getSearchDb()
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(eq(Unit.type, "SHELF"), publicContentUnitConditions("single")),
        )
        .orderBy(asc(Unit.id))
        .limit(input.limit));
  const shelfIds = shelves.map((shelf) => shelf.id);
  if (shelfIds.length === 0) return [];

  const shelfItems = await getSearchDb()
    .select({ shelfId: ShelfItem.shelfId, unitId: ShelfItem.itemId })
    .from(ShelfItem)
    .where(
      and(inArray(ShelfItem.shelfId, shelfIds), eq(ShelfItem.itemType, "unit")),
    )
    .orderBy(asc(ShelfItem.position));
  const unitsByShelfId = groupRowsByKey(shelfItems as any[], "shelfId");
  return shelves.map((shelf) => ({
    id: shelf.id,
    shelf: { units: unitsByShelfId.get(shelf.id) ?? [] },
  }));
}

export async function syncAllPostRealmIds(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts = await listPublicPostRealmRows({
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    await client.patchPosts(
      posts.map((post) => ({
        id: post.unitId,
        realmIds: realmIdsForSearch(post.unit),
      })),
    );

    total += posts.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPostRealmIds success", totalSynced: total };
}

export async function syncPostRealmIdsSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listPublicPostRealmRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(rows, limit, "unitId");
  if (current.length > 0) {
    await client.patchPosts(
      current.map((post) => ({
        id: post.unitId,
        realmIds: realmIdsForSearch(post.unit),
      })),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

export async function syncAllContainedUnitIds(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const shelves = await listPublicShelfContainedUnitRows({
      limit: BATCH_SIZE,
      cursor,
    });

    if (shelves.length === 0) break;

    await client.patchContent(
      shelves.map((unit) => ({
        id: unit.id,
        containedUnitIds: (unit.shelf?.units ?? []).map(
          (i: { unitId: string }) => i.unitId,
        ),
      })),
    );

    total += shelves.length;
    cursor = shelves[shelves.length - 1]!.id;
  }

  return { message: "syncAllContainedUnitIds success", totalSynced: total };
}

export async function syncPostsByAuthor(client: SearchClient, userId: string) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts = await listPostSyncRows({
      authorUserId: userId,
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    await client.addOrUpdatePosts(docs);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncPostsByAuthor success", totalSynced: total };
}

export async function syncPostsByTarget(
  client: SearchClient,
  targetUnitId: string,
) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts = await listPostSyncRows({
      targetUnitId,
      limit: BATCH_SIZE,
      cursor,
    });

    if (posts.length === 0) break;

    const docs = posts.map(buildPostDocument);
    await client.addOrUpdatePosts(docs);

    total += docs.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncPostsByTarget success", totalSynced: total };
}

// ANCHOR: Realm document builder
// ANCHOR: Realm 文档构建器

export function buildRealmDocument(realm: any): RealmSearchDocument {
  const unit = realm.unit;
  const translations: any[] = unit?.translations ?? [];
  const aliases: any[] = (unit?.aliases ?? []).filter(isSearchVisibleScoredRow);

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => searchDescriptionText(t.description))
    .filter(isNonEmptyString);
  const aliasValues = aliases.map((alias: any) => alias.value).filter(Boolean);
  const languages = indexedLanguages(unit ?? {});

  return {
    id: realm.unitId,
    isPublic: realm.isPublic,
    isOfficial: realm.isOfficial,
    memberCount: realm.memberCount,
    createdAt:
      realm.createdAt instanceof Date
        ? realm.createdAt.toISOString()
        : realm.createdAt,
    updatedAt:
      realm.updatedAt instanceof Date
        ? realm.updatedAt.toISOString()
        : realm.updatedAt,
    userId: unit?.userId ?? null,
    languages,
    isLanguageNeutral: Boolean(unit?.isLanguageNeutral),
    supportLanguages: indexedSupportLanguages(unit ?? {}),
    titles,
    descriptions,
    aliasValues,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      description: searchDescriptionText(tr.description),
    })),
    extra: realm.extra ?? undefined,
  };
}

// ANCHOR: Zone document builder
// ANCHOR: Zone 文档构建器

export function buildZoneDocument(zone: any): ZoneSearchDocument {
  const unit = zone.unit;
  const translations: any[] = unit?.translations ?? [];
  const aliases: any[] = (unit?.aliases ?? []).filter(isSearchVisibleScoredRow);
  const ownerRealmTranslations: any[] = zone.ownerRealmTranslations ?? [];

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => searchDescriptionText(t.description))
    .filter(isNonEmptyString);
  const aliasValues = aliases.map((alias: any) => alias.value).filter(Boolean);
  const ownerRealmTitles = ownerRealmTranslations
    .map((translation: any) => translation.title)
    .filter(isNonEmptyString);
  const languages = indexedLanguages(unit ?? {});

  return {
    id: zone.unitId,
    slug: unit?.slug ?? null,
    ownerRealmUnitId: zone.ownerRealmUnitId,
    createdAt: toIsoString(zone.createdAt) ?? "",
    updatedAt: toIsoString(zone.updatedAt) ?? "",
    startsAt: toIsoString(zone.startsAt),
    endsAt: toIsoString(zone.endsAt),
    userId: unit?.userId ?? null,
    visibility: unit?.visibility ?? "PRIVATE",
    languages,
    isLanguageNeutral: Boolean(unit?.isLanguageNeutral),
    supportLanguages: indexedSupportLanguages(unit ?? {}),
    titles,
    descriptions,
    aliasValues,
    ownerRealmTitles,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      description: searchDescriptionText(tr.description),
    })),
  };
}

// ANCHOR: Poll document builder
// ANCHOR: Poll 文档构建器

export function buildPollDocument(poll: any): PollSearchDocument {
  const unit = poll.unit;
  const translations: any[] = unit?.translations ?? [];
  const titles = translations
    .map((translation) => translation.title)
    .filter(Boolean);
  const descriptions = translations
    .map((translation) => translation.summary)
    .filter(isNonEmptyString);
  const optionLabels = (poll.options ?? [])
    .map((option: any) => option.label)
    .filter(isNonEmptyString);
  const optionUnitIds = (poll.options ?? [])
    .map((option: any) => option.unitId)
    .filter(isNonEmptyString);
  const closesAt = toIsoString(poll.closesAt);
  const now = Date.now();

  return {
    id: poll.unitId,
    unitId: poll.unitId,
    ownerUserId: unit?.userId ?? null,
    titles,
    descriptions,
    optionLabels,
    optionUnitIds,
    voteMode: poll.voteMode,
    resultVisibility: poll.resultVisibility,
    anonymous: poll.anonymous,
    closesAt,
    closed:
      poll.closesAt instanceof Date
        ? poll.closesAt.getTime() <= now
        : Boolean(closesAt && Date.parse(closesAt) <= now),
    usageCount: poll.usageCount,
    used: poll.usageCount > 0,
    languages: indexedLanguages(poll.unit ?? {}),
    isLanguageNeutral: Boolean(unit?.isLanguageNeutral),
    createdAt: toIsoString(poll.createdAt) ?? "",
    updatedAt: toIsoString(poll.updatedAt) ?? "",
  };
}

// ANCHOR: Poll sync functions
// ANCHOR: Poll 同步函数

type PollBaseRow = {
  unitId: string;
  voteMode: string;
  resultVisibility: string;
  anonymous: boolean;
  closesAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  usageCount: number;
  unitStatus: string | null;
  userId: string | null;
  isLanguageNeutral: boolean | null;
};

const pollBaseSelect = {
  unitId: Poll.unitId,
  voteMode: Poll.voteMode,
  resultVisibility: Poll.resultVisibility,
  anonymous: Poll.anonymous,
  closesAt: Poll.closesAt,
  createdAt: Poll.createdAt,
  updatedAt: Poll.updatedAt,
  usageCount: Poll.usageCount,
  unitStatus: Unit.status,
  userId: Unit.userId,
  isLanguageNeutral: Unit.isLanguageNeutral,
} as const;

function groupRowsByKey<T extends Record<string, any>>(
  rows: T[],
  key: keyof T,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = row[key];
    if (typeof id !== "string") continue;
    const bucket = grouped.get(id) ?? [];
    bucket.push(row);
    grouped.set(id, bucket);
  }
  return grouped;
}

function pollFromRows(
  row: PollBaseRow,
  optionsByPollUnitId: Map<string, any[]>,
  translationsByUnitId: Map<string, any[]>,
  supportLanguagesByUnitId: Map<string, any[]>,
) {
  return {
    unitId: row.unitId,
    voteMode: row.voteMode,
    resultVisibility: row.resultVisibility,
    anonymous: row.anonymous,
    closesAt: row.closesAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    usageCount: row.usageCount,
    options: optionsByPollUnitId.get(row.unitId) ?? [],
    unit: {
      status: row.unitStatus,
      userId: row.userId,
      isLanguageNeutral: row.isLanguageNeutral,
      translations: translationsByUnitId.get(row.unitId) ?? [],
      supportLanguages: supportLanguagesByUnitId.get(row.unitId) ?? [],
    },
  };
}

async function hydratePollRows(rows: PollBaseRow[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.unitId);
  const [options, translations, supportLanguages] = await Promise.all([
    getSearchDb()
      .select()
      .from(PollOption)
      .where(inArray(PollOption.pollUnitId, unitIds))
      .orderBy(asc(PollOption.pollUnitId), asc(PollOption.position)),
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, unitIds)),
  ]);
  return rows.map((row) =>
    pollFromRows(
      row,
      groupRowsByKey(options as any[], "pollUnitId"),
      groupRowsByKey(translations as any[], "unitId"),
      groupRowsByKey(supportLanguages as any[], "unitId"),
    ),
  );
}

async function findPollSyncRow(unitId: string) {
  const [row] = await getSearchDb()
    .select(pollBaseSelect)
    .from(Poll)
    .leftJoin(Unit, eq(Unit.id, Poll.unitId))
    .where(eq(Poll.unitId, unitId))
    .limit(1);
  const [poll] = await hydratePollRows(row ? ([row] as PollBaseRow[]) : []);
  return poll ?? null;
}

async function listPollSyncRows(input: { limit: number; cursor?: string }) {
  const db = getSearchDb();
  const query = db
    .select(pollBaseSelect)
    .from(Poll)
    .leftJoin(Unit, eq(Unit.id, Poll.unitId));
  const rows = input.cursor
    ? await query
        .where(and(eq(Unit.status, "PUBLISHED"), gt(Poll.unitId, input.cursor)))
        .orderBy(asc(Poll.unitId))
        .limit(input.limit)
    : await query
        .where(eq(Unit.status, "PUBLISHED"))
        .orderBy(asc(Poll.unitId))
        .limit(input.limit);
  return hydratePollRows(rows as PollBaseRow[]);
}

export async function syncSinglePoll(client: SearchClient, unitId: string) {
  const poll = await findPollSyncRow(unitId);

  if (!poll || poll.unit.status !== "PUBLISHED") {
    await client.deletePolls([unitId]);
    return;
  }

  await client.addOrUpdatePolls([buildPollDocument(poll)]);
}

export async function syncAllPolls(client: SearchClient) {
  const deleteResult = await client.deleteAllPolls();
  console.log("syncAllPolls: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllPolls: cursor", cursor, "total", total);

    const polls = await listPollSyncRows({ limit: BATCH_SIZE, cursor });

    if (polls.length === 0) break;

    const docs = polls.map(buildPollDocument);
    const addResult = await client.addOrUpdatePolls(docs);
    console.log("syncAllPolls: added batch", addResult);

    total += docs.length;
    cursor = polls[polls.length - 1]!.unitId;
  }

  return { message: "syncAllPolls success", totalSynced: total };
}

// ANCHOR: Realm sync functions
// ANCHOR: Realm 同步函数

type RealmBaseRow = {
  unitId: string;
  isPublic: boolean;
  isOfficial: boolean;
  memberCount: number;
  extra: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
  unitStatus: string | null;
  userId: string | null;
  isLanguageNeutral: boolean | null;
};

const realmBaseSelect = {
  unitId: Realm.unitId,
  isPublic: Realm.isPublic,
  isOfficial: Realm.isOfficial,
  memberCount: Realm.memberCount,
  extra: Realm.extra,
  createdAt: Realm.createdAt,
  updatedAt: Realm.updatedAt,
  unitStatus: Unit.status,
  userId: Unit.userId,
  isLanguageNeutral: Unit.isLanguageNeutral,
} as const;

function realmFromRows(
  row: RealmBaseRow,
  translationsByUnitId: Map<string, any[]>,
  supportLanguagesByUnitId: Map<string, any[]>,
  aliasesByUnitId: Map<string, any[]>,
) {
  return {
    unitId: row.unitId,
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    memberCount: row.memberCount,
    extra: row.extra,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    unit: {
      status: row.unitStatus,
      userId: row.userId,
      isLanguageNeutral: row.isLanguageNeutral,
      translations: translationsByUnitId.get(row.unitId) ?? [],
      supportLanguages: supportLanguagesByUnitId.get(row.unitId) ?? [],
      aliases: aliasesByUnitId.get(row.unitId) ?? [],
    },
  };
}

async function hydrateRealmRows(rows: RealmBaseRow[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.unitId);
  const [translations, supportLanguages, aliases] = await Promise.all([
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitAlias)
      .where(
        and(
          inArray(UnitAlias.unitId, unitIds),
          eq(UnitAlias.status, "ACTIVE"),
          or(
            gt(UnitAlias.score, VISIBILITY_THRESHOLD),
            eq(UnitAlias.pinned, true),
          ),
        ),
      )
      .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score)),
  ]);
  const translationsByUnitId = groupRowsByKey(translations as any[], "unitId");
  const supportLanguagesByUnitId = groupRowsByKey(
    supportLanguages as any[],
    "unitId",
  );
  const aliasesByUnitId = groupRowsByKey(aliases as any[], "unitId");
  return rows.map((row) =>
    realmFromRows(
      row,
      translationsByUnitId,
      supportLanguagesByUnitId,
      aliasesByUnitId,
    ),
  );
}

async function findRealmSyncRow(unitId: string) {
  const [row] = await getSearchDb()
    .select(realmBaseSelect)
    .from(Realm)
    .leftJoin(Unit, eq(Unit.id, Realm.unitId))
    .where(eq(Realm.unitId, unitId))
    .limit(1);
  const [realm] = await hydrateRealmRows(row ? ([row] as RealmBaseRow[]) : []);
  return realm ?? null;
}

async function listRealmSyncRows(input: { limit: number; cursor?: string }) {
  const query = getSearchDb()
    .select(realmBaseSelect)
    .from(Realm)
    .leftJoin(Unit, eq(Unit.id, Realm.unitId));
  const rows = input.cursor
    ? await query
        .where(
          and(eq(Unit.status, "PUBLISHED"), gt(Realm.unitId, input.cursor)),
        )
        .orderBy(asc(Realm.unitId))
        .limit(input.limit)
    : await query
        .where(eq(Unit.status, "PUBLISHED"))
        .orderBy(asc(Realm.unitId))
        .limit(input.limit);
  return hydrateRealmRows(rows as RealmBaseRow[]);
}

export async function syncSingleRealm(client: SearchClient, unitId: string) {
  const realm = await findRealmSyncRow(unitId);

  if (!realm || realm.unit.status !== "PUBLISHED") {
    await client.deleteRealms([unitId]);
    return;
  }

  const doc = buildRealmDocument(realm);
  await client.addOrUpdateRealms([doc]);
}

export async function syncAllRealms(client: SearchClient) {
  const deleteResult = await client.deleteAllRealms();
  console.log("syncAllRealms: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllRealms: cursor", cursor, "total", total);

    const realms = await listRealmSyncRows({ limit: BATCH_SIZE, cursor });

    if (realms.length === 0) break;

    const docs = realms.map(buildRealmDocument);
    const addResult = await client.addOrUpdateRealms(docs);
    console.log("syncAllRealms: added batch", addResult);

    total += docs.length;
    cursor = realms[realms.length - 1]!.unitId;
  }

  return { message: "syncAllRealms success", totalSynced: total };
}

export async function syncRealmSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const realms = await listRealmSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(realms, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdateRealms(current.map(buildRealmDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Zone sync functions
// ANCHOR: Zone 同步函数

type ZoneBaseRow = {
  unitId: string;
  ownerRealmUnitId: string;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  unitStatus: string | null;
  unitVisibility: string | null;
  unitModerationStatus: string | null;
  userId: string | null;
  slug: string | null;
  isLanguageNeutral: boolean | null;
};

const zoneBaseSelect = {
  unitId: Zone.unitId,
  ownerRealmUnitId: Zone.ownerRealmUnitId,
  startsAt: Zone.startsAt,
  endsAt: Zone.endsAt,
  createdAt: Zone.createdAt,
  updatedAt: Zone.updatedAt,
  unitStatus: Unit.status,
  unitVisibility: Unit.visibility,
  unitModerationStatus: Unit.moderationStatus,
  userId: Unit.userId,
  slug: Unit.slug,
  isLanguageNeutral: Unit.isLanguageNeutral,
} as const;

function zoneFromRows(
  row: ZoneBaseRow,
  translationsByUnitId: Map<string, any[]>,
  supportLanguagesByUnitId: Map<string, any[]>,
  aliasesByUnitId: Map<string, any[]>,
  ownerRealmTranslationsByUnitId: Map<string, any[]>,
) {
  return {
    unitId: row.unitId,
    ownerRealmUnitId: row.ownerRealmUnitId,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ownerRealmTranslations:
      ownerRealmTranslationsByUnitId.get(row.ownerRealmUnitId) ?? [],
    unit: {
      status: row.unitStatus,
      visibility: row.unitVisibility,
      moderationStatus: row.unitModerationStatus,
      userId: row.userId,
      slug: row.slug,
      isLanguageNeutral: row.isLanguageNeutral,
      translations: translationsByUnitId.get(row.unitId) ?? [],
      supportLanguages: supportLanguagesByUnitId.get(row.unitId) ?? [],
      aliases: aliasesByUnitId.get(row.unitId) ?? [],
    },
  };
}

async function hydrateZoneRows(rows: ZoneBaseRow[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.unitId);
  const ownerRealmUnitIds = [
    ...new Set(rows.map((row) => row.ownerRealmUnitId)),
  ];
  const [translations, supportLanguages, aliases, ownerRealmTranslations] =
    await Promise.all([
      getSearchDb()
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, unitIds)),
      getSearchDb()
        .select()
        .from(UnitSupportLanguage)
        .where(inArray(UnitSupportLanguage.unitId, unitIds)),
      getSearchDb()
        .select()
        .from(UnitAlias)
        .where(
          and(
            inArray(UnitAlias.unitId, unitIds),
            eq(UnitAlias.status, "ACTIVE"),
            or(
              gt(UnitAlias.score, VISIBILITY_THRESHOLD),
              eq(UnitAlias.pinned, true),
            ),
          ),
        )
        .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score)),
      getSearchDb()
        .select()
        .from(UnitTranslation)
        .where(inArray(UnitTranslation.unitId, ownerRealmUnitIds)),
    ]);
  return rows.map((row) =>
    zoneFromRows(
      row,
      groupRowsByKey(translations as any[], "unitId"),
      groupRowsByKey(supportLanguages as any[], "unitId"),
      groupRowsByKey(aliases as any[], "unitId"),
      groupRowsByKey(ownerRealmTranslations as any[], "unitId"),
    ),
  );
}

async function findZoneSyncRow(unitId: string) {
  const [row] = await getSearchDb()
    .select(zoneBaseSelect)
    .from(Zone)
    .leftJoin(Unit, eq(Unit.id, Zone.unitId))
    .where(eq(Zone.unitId, unitId))
    .limit(1);
  const [zone] = await hydrateZoneRows(row ? ([row] as ZoneBaseRow[]) : []);
  return zone ?? null;
}

async function listZoneSyncRows(input: { limit: number; cursor?: string }) {
  const query = getSearchDb()
    .select(zoneBaseSelect)
    .from(Zone)
    .leftJoin(Unit, eq(Unit.id, Zone.unitId));
  const rows = input.cursor
    ? await query
        .where(and(eq(Unit.status, "PUBLISHED"), gt(Zone.unitId, input.cursor)))
        .orderBy(asc(Zone.unitId))
        .limit(input.limit)
    : await query
        .where(eq(Unit.status, "PUBLISHED"))
        .orderBy(asc(Zone.unitId))
        .limit(input.limit);
  return hydrateZoneRows(rows as ZoneBaseRow[]);
}

function isPublicIndexableZoneUnit(zone: any): boolean {
  return (
    zone?.unit?.status === PUBLIC_ELIGIBLE_UNIT_WHERE.status &&
    zone.unit.visibility === PUBLIC_ELIGIBLE_UNIT_WHERE.visibility &&
    zone.unit.moderationStatus === PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus
  );
}

export async function syncSingleZone(client: SearchClient, unitId: string) {
  const zone = await findZoneSyncRow(unitId);

  if (!zone || !isPublicIndexableZoneUnit(zone)) {
    await client.deleteZones([unitId]);
    return;
  }

  await client.addOrUpdateZones([buildZoneDocument(zone)]);
}

export async function syncAllZones(client: SearchClient) {
  const deleteResult = await client.deleteAllZones();
  console.log("syncAllZones: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllZones: cursor", cursor, "total", total);

    const zones = await listZoneSyncRows({ limit: BATCH_SIZE, cursor });

    if (zones.length === 0) break;

    const docs = zones.filter(isPublicIndexableZoneUnit).map(buildZoneDocument);
    const addResult = docs.length
      ? await client.addOrUpdateZones(docs)
      : undefined;
    console.log("syncAllZones: added batch", addResult);

    total += docs.length;
    cursor = zones[zones.length - 1]!.unitId;
  }

  return { message: "syncAllZones success", totalSynced: total };
}

export async function syncZoneSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const zones = await listZoneSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(zones, limit, "unitId");
  const docs = current.filter(isPublicIndexableZoneUnit).map(buildZoneDocument);
  if (docs.length > 0) {
    await client.addOrUpdateZones(docs);
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Entity document builder + sync
// ANCHOR: Entity 文档构建器 + 同步

type EntityBaseRow = {
  unitId: string;
  kind: string | null;
  verified: boolean;
  avatar: string | null;
  eligibleCreditRoles: string[];
  eligibleSubjectRoles: string[];
  slug: string | null;
  userId: string | null;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

const entityBaseSelect = {
  unitId: Entity.unitId,
  kind: Entity.kind,
  verified: Entity.verified,
  avatar: Entity.avatar,
  eligibleCreditRoles: Entity.eligibleCreditRoles,
  eligibleSubjectRoles: Entity.eligibleSubjectRoles,
  slug: Unit.slug,
  userId: Unit.userId,
  createdAt: Unit.createdAt,
  updatedAt: Unit.updatedAt,
} as const;

function entityFromRows(
  row: EntityBaseRow,
  translationsByUnitId: Map<string, unknown[]>,
  aliasesByUnitId: Map<string, unknown[]>,
) {
  return {
    unitId: row.unitId,
    kind: row.kind,
    verified: row.verified,
    avatar: row.avatar,
    eligibleCreditRoles: row.eligibleCreditRoles ?? [],
    eligibleSubjectRoles: row.eligibleSubjectRoles ?? [],
    unit: {
      slug: row.slug,
      userId: row.userId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      translations: translationsByUnitId.get(row.unitId) ?? [],
      aliases: aliasesByUnitId.get(row.unitId) ?? [],
    },
  };
}

function groupRowsByUnitId(
  rows: Array<{ unitId: string }>,
): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.unitId) ?? [];
    bucket.push(row);
    grouped.set(row.unitId, bucket);
  }
  return grouped;
}

async function hydrateEntityRows(rows: EntityBaseRow[]) {
  if (rows.length === 0) return [];
  const unitIds = rows.map((row) => row.unitId);
  const [translations, aliases] = await Promise.all([
    getSearchDb()
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, unitIds)),
    getSearchDb()
      .select()
      .from(UnitAlias)
      .where(
        and(
          inArray(UnitAlias.unitId, unitIds),
          eq(UnitAlias.status, "ACTIVE"),
          or(
            gt(UnitAlias.score, VISIBILITY_THRESHOLD),
            eq(UnitAlias.pinned, true),
          ),
        ),
      )
      .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score)),
  ]);
  const translationsByUnitId = groupRowsByUnitId(translations as any[]);
  const aliasesByUnitId = groupRowsByUnitId(aliases as any[]);
  return rows.map((row) =>
    entityFromRows(row, translationsByUnitId, aliasesByUnitId),
  );
}

async function findEntitySyncRow(unitId: string) {
  const [row] = await getSearchDb()
    .select(entityBaseSelect)
    .from(Entity)
    .leftJoin(Unit, eq(Unit.id, Entity.unitId))
    .where(eq(Entity.unitId, unitId))
    .limit(1);
  const [entity] = await hydrateEntityRows(
    row ? ([row] as EntityBaseRow[]) : [],
  );
  return entity ?? null;
}

async function listEntitySyncRows(input: { limit: number; cursor?: string }) {
  const db = getSearchDb();
  const query = db
    .select(entityBaseSelect)
    .from(Entity)
    .leftJoin(Unit, eq(Unit.id, Entity.unitId));
  const rows = input.cursor
    ? await query
        .where(gt(Entity.unitId, input.cursor))
        .orderBy(asc(Entity.unitId))
        .limit(input.limit)
    : await query.orderBy(asc(Entity.unitId)).limit(input.limit);
  return hydrateEntityRows(rows as EntityBaseRow[]);
}

async function listVisibleEntityAliasValues(unitId: string): Promise<string[]> {
  const rows = await getSearchDb()
    .select({ value: UnitAlias.value })
    .from(UnitAlias)
    .where(
      and(
        eq(UnitAlias.unitId, unitId),
        eq(UnitAlias.status, "ACTIVE"),
        or(
          gt(UnitAlias.score, VISIBILITY_THRESHOLD),
          eq(UnitAlias.pinned, true),
        ),
      ),
    )
    .orderBy(desc(UnitAlias.pinned), desc(UnitAlias.score));
  return rows.map((alias) => alias.value).filter(isNonEmptyString);
}

export function buildEntityDocument(entity: any): EntitySearchDocument {
  const unit = entity.unit;
  const translations: any[] = unit?.translations ?? [];
  const aliases: any[] = (unit?.aliases ?? []).filter(isSearchVisibleScoredRow);

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const aliasValues = aliases.map((alias: any) => alias.value).filter(Boolean);

  return {
    id: entity.unitId,
    unitId: entity.unitId,
    kind: entity.kind ?? null,
    verified: entity.verified,
    slug: unit?.slug ?? null,
    ownerUnitId: unit?.userId ?? null,
    avatar: entity.avatar ?? null,
    titles,
    summaries,
    aliasValues,
    eligibleCreditRoles: entity.eligibleCreditRoles ?? [],
    eligibleSubjectRoles: entity.eligibleSubjectRoles ?? [],
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      subtitle: tr.subtitle ?? null,
      summary: tr.summary ?? null,
    })),
    createdAt:
      unit?.createdAt instanceof Date
        ? unit.createdAt.toISOString()
        : (unit?.createdAt ?? new Date().toISOString()),
    updatedAt:
      unit?.updatedAt instanceof Date
        ? unit.updatedAt.toISOString()
        : (unit?.updatedAt ?? new Date().toISOString()),
  };
}

export async function syncSingleEntity(client: SearchClient, unitId: string) {
  const entity = await findEntitySyncRow(unitId);

  if (!entity) {
    await client.deleteEntities([unitId]);
    return;
  }

  const doc = buildEntityDocument(entity);
  await client.addOrUpdateEntities([doc]);
}

export async function patchEntityAliases(client: SearchClient, unitId: string) {
  const entity = await findEntitySyncRow(unitId);
  if (!entity) {
    await client.deleteEntities([unitId]);
    return;
  }

  await client.patchEntities([
    {
      id: unitId,
      aliasValues: await listVisibleEntityAliasValues(unitId),
    },
  ]);
}

export async function syncAllEntities(client: SearchClient) {
  const deleteResult = await client.deleteAllEntities();
  console.log("syncAllEntities: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllEntities: cursor", cursor, "total", total);

    const entities = await listEntitySyncRows({ limit: BATCH_SIZE, cursor });

    if (entities.length === 0) break;

    const docs = entities.map(buildEntityDocument);
    const addResult = await client.addOrUpdateEntities(docs);
    console.log("syncAllEntities: added batch", addResult);

    total += docs.length;
    cursor = entities[entities.length - 1]!.unitId;
  }

  return { message: "syncAllEntities success", totalSynced: total };
}

export async function syncEntitySegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const entities = await listEntitySyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(entities, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdateEntities(current.map(buildEntityDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Users sync
// ANCHOR: 用户同步

export async function syncAllUsers(client: SearchClient) {
  const deleteResult = await client.deleteAllUsers();
  console.log("syncAllUsers: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllUsers: cursor", cursor, "total", total);

    const users = await listUserSyncRows({ limit: BATCH_SIZE, cursor });

    if (users.length === 0) break;

    const formatted: UserSearchDocument[] = users.map(buildUserSearchDocument);

    const addResult = await client.addOrUpdateUsers(formatted);
    console.log("syncAllUsers: added batch", addResult);

    total += formatted.length;
    cursor = users[users.length - 1]!.unitId;
  }

  return { message: "syncAllUsers success", totalSynced: total };
}

export async function syncUserSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const users = await listUserSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const { current, nextCursor } = segmentRows(users, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdateUsers(current.map(buildUserSearchDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}
