import type {
  CommentSearchDocument,
  ContentSearchDocument,
  EntitySearchDocument,
  FeedbackSearchDocument,
  PollSearchDocument,
  PostSearchDocument,
  RealmSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import {
  mainMarkdownSource,
  normalizeLanguage,
  RATING_TAGS,
  readCoverUrlFromExtra,
  type Language,
} from "@rezics/contract";
import type { ServerDb } from "@rezics/server/db";
import {
  CreditAttribution,
  Entity,
  Feedback,
  Poll,
  PollOption,
  Realm,
  RealmTagApplication,
  ShelfUnit,
  Unit,
  UnitAlias,
  UnitRealm,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  SubjectAttribution,
  User,
  UserUnitCollection,
  UserUnitProgress,
} from "@rezics/server/db/schema";
import { and, asc, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import type { SearchClient } from "./client";
import {
  buildUserUnitCollectionDocument,
  collectionDocumentId,
  type UserUnitCollectionRow,
} from "./collection";
import {
  buildProgressDocument,
  progressDocumentId,
  type UserUnitProgressRow,
} from "./progress";

type SearchDatabaseClient = any;
type SearchServerDb = Pick<ServerDb, "select">;

let searchPrismaClient: SearchDatabaseClient | null = null;
let searchServerDb: SearchServerDb | null = null;

export function setSearchPrismaClient(prisma: SearchDatabaseClient): void {
  searchPrismaClient = prisma;
}

export function setSearchDb(db: SearchServerDb): void {
  searchServerDb = db;
}

function getSearchPrismaClient(): SearchDatabaseClient {
  if (!searchPrismaClient) {
    throw new Error(
      "Search database client is not configured. Call setSearchPrismaClient() before running search sync.",
    );
  }
  return searchPrismaClient;
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

const INDEXABLE_TYPES = ["BOOK", "GAME", "MEDIA", "SERIES", "SHELF", "LINK"];

const PUBLIC_ELIGIBLE_UNIT_WHERE = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
  moderationStatus: "APPROVED",
} as const;

const RATING_TAG_SLUGS = new Set<string>(RATING_TAGS);

function publicSearchableUnitWhere(): Record<string, unknown> {
  return { ...PUBLIC_ELIGIBLE_UNIT_WHERE };
}

function publicCatalogContentWhere(): Record<string, unknown> {
  return {
    ...publicSearchableUnitWhere(),
    OR: [{ catalogEntryKind: null }, { catalogEntryKind: "MAIN" }],
  };
}

const visibleUnitTagsInclude = {
  where: {
    OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
  },
  include: {
    tag: { include: { translations: true } },
  },
  orderBy: { score: "desc" as const },
} as const;

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
        status: string;
        visibility: string;
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
    .filter((realm: any) => realm.realm?.realm?.isPublic !== false)
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

const contentInclude: any = {
  translations: true,
  contentTranslations: true,
  supportLanguages: true,
  aliases: {
    where: {
      status: "ACTIVE" as const,
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    orderBy: [{ pinned: "desc" as const }, { score: "desc" as const }],
  } as any,
  unitTags: visibleUnitTagsInclude,
  ...realmSearchProjectionSelect,
  realmTagApplicationsAsTargetUnit: true,
  creditAttributions: {
    include: {
      entity: {
        include: { entity: true, translations: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  subjectAttributions: {
    include: {
      entity: {
        include: { entity: true, translations: true },
      },
    },
    orderBy: { sortOrder: "asc" as const },
  },
  book: true,
  game: {
    include: {
      systemRequirements: {
        orderBy: [
          { platformEntityId: "asc" as const },
          { tier: "asc" as const },
        ],
      },
    },
  },
  media: true,
  ownedContentStructure: {
    select: { ownerUnitId: true },
  },
  shelf: { include: { units: { select: { unitId: true } } } },
  seriesContentIndexesAsRelease: {
    include: {
      series: {
        include: {
          unit: {
            include: {
              translations: true,
            },
          },
        },
      },
    },
  },
  link: true,
  post: true,
};

/**
 * Build a ContentSearchDocument from a Prisma unit with all relations included.
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
  const realmIds = realmIdsForSearch(unit);

  // Realm-tag compound keys
  const realmTagKeys = realmTagApplicationsAsTargetUnit.map(
    (rt: any) => `${rt.realmUnitId}:${rt.tagUnitId}`,
  );

  // Credit attribution
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
  const ext = unit.book ?? unit.game ?? unit.media ?? null;
  const isLicensed = ext?.isLicensed ?? false;
  const coverUrl = pickCoverUrlFromTranslations(
    unit.defaultLanguage,
    translations,
  );

  // Link-specific fields
  const linkUrl = unit.link?.url ?? null;
  const linkSiteName = unit.link?.siteName ?? null;

  // Post kind + book textLength for search filters
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
    hotScore: 0,
    topScore: 0,
    trendingScore: 0,
    qualityScore: 0,
    rankUpdatedAt: null,
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

// ANCHOR: Full content reindex

export async function syncAllContent(client: SearchClient) {
  const deleteResult = await client.deleteAllContent();
  console.log("syncAllContent: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllContent: cursor", cursor, "total", total);

    const units: any[] = await getSearchPrismaClient().unit.findMany({
      where: {
        type: { in: INDEXABLE_TYPES },
        ...publicCatalogContentWhere(),
      },
      include: contentInclude,
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
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
  const units: any[] = await getSearchPrismaClient().unit.findMany({
    where: {
      type: { in: INDEXABLE_TYPES },
      ...publicCatalogContentWhere(),
    },
    include: contentInclude,
    orderBy: { id: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
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
  const units: any[] = await getSearchPrismaClient().unit.findMany({
    where: {
      type: { in: INDEXABLE_TYPES },
      ...publicSearchableUnitWhere(),
      catalogEntryKind: "VARIANT",
    },
    include: contentInclude,
    orderBy: { id: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
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
  const units: any[] = await getSearchPrismaClient().unit.findMany({
    where: {
      type: { in: ["GAME", "MEDIA"] },
      ...publicCatalogContentWhere(),
    },
    include: contentInclude,
    orderBy: { id: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
  });
  const { current, nextCursor } = segmentRows(units, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateContent(current.map(buildContentDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Progress sync functions

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
  const cursor = input.cursor ? parseCompositeCursor(input.cursor) : null;
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

// ANCHOR: User unit collection sync functions

export async function syncUserUnitCollection(
  client: SearchClient,
  row: UserUnitCollectionRow,
): Promise<void> {
  await client.addOrUpdateCollections([buildUserUnitCollectionDocument(row)]);
}

type UserUnitCollectionSyncRow = typeof UserUnitCollection.$inferSelect;

function parseCompositeCursor(cursor: string): {
  userId: string;
  unitId: string;
} {
  return {
    userId: cursor.split(":")[0] ?? "",
    unitId: cursor.split(":").slice(1).join(":"),
  };
}

async function findUserUnitCollectionSyncRow(
  userId: string,
  unitId: string,
): Promise<UserUnitCollectionSyncRow | null> {
  const [row] = await getSearchDb()
    .select()
    .from(UserUnitCollection)
    .where(
      and(
        eq(UserUnitCollection.userId, userId),
        eq(UserUnitCollection.unitId, unitId),
      ),
    )
    .limit(1);
  return (row as UserUnitCollectionSyncRow | undefined) ?? null;
}

async function listUserUnitCollectionSyncRows(input: {
  limit: number;
  cursor?: string;
}): Promise<UserUnitCollectionSyncRow[]> {
  const db = getSearchDb();
  const query = db.select().from(UserUnitCollection);
  const cursor = input.cursor ? parseCompositeCursor(input.cursor) : null;
  const rows = cursor
    ? await query
        .where(
          sql`(${UserUnitCollection.userId}, ${UserUnitCollection.unitId}) > (${cursor.userId}, ${cursor.unitId})`,
        )
        .orderBy(asc(UserUnitCollection.userId), asc(UserUnitCollection.unitId))
        .limit(input.limit)
    : await query
        .orderBy(asc(UserUnitCollection.userId), asc(UserUnitCollection.unitId))
        .limit(input.limit);
  return rows as UserUnitCollectionSyncRow[];
}

export async function syncSingleUserUnitCollection(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  const row = await findUserUnitCollectionSyncRow(userId, unitId);
  if (!row) {
    await removeUserUnitCollection(client, userId, unitId);
    return;
  }
  await syncUserUnitCollection(client, row);
}

export async function removeUserUnitCollection(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  await client.deleteCollections([collectionDocumentId(userId, unitId)]);
}

export async function syncUserUnitCollectionSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const rows = await listUserUnitCollectionSyncRows({
    limit: limit + 1,
    cursor: options.cursor,
  });
  const current = rows.slice(0, limit);
  const hasMore = rows.length > limit && current.length > 0;
  if (current.length > 0) {
    await client.addOrUpdateCollections(
      current.map(buildUserUnitCollectionDocument),
    );
  }
  const last = current.at(-1);
  return {
    processed: current.length,
    ...(hasMore && last ? { nextCursor: `${last.userId}:${last.unitId}` } : {}),
  };
}

export async function syncAllUserUnitCollections(client: SearchClient) {
  const deleteResult = await client.deleteAllCollections();
  console.log(
    "syncAllUserUnitCollections: deleted all documents",
    deleteResult,
  );

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const result = await syncUserUnitCollectionSegment(client, { cursor });
    total += result.processed;
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return { message: "syncAllUserUnitCollections success", totalSynced: total };
}

// ANCHOR: Incremental single-unit sync

export async function syncSingleContent(client: SearchClient, unitId: string) {
  const unit = await getSearchPrismaClient().unit.findUnique({
    where: { id: unitId },
    include: contentInclude,
  });

  // If unit doesn't exist or doesn't qualify, remove from index
  if (
    !unit ||
    !INDEXABLE_TYPES.includes(unit.type as any) ||
    unit.status !== PUBLIC_ELIGIBLE_UNIT_WHERE.status ||
    unit.visibility !== PUBLIC_ELIGIBLE_UNIT_WHERE.visibility ||
    unit.moderationStatus !== PUBLIC_ELIGIBLE_UNIT_WHERE.moderationStatus ||
    !(
      unit.catalogEntryKind === null ||
      unit.catalogEntryKind === undefined ||
      unit.catalogEntryKind === "MAIN"
    )
  ) {
    await client.deleteContent([unitId]);
    return;
  }

  const doc = buildContentDocument(unit);
  await client.addOrUpdateContent([doc]);
}

// ANCHOR: Content partial sync functions

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
 * after every ShelfUnit insert/delete on the shelf.
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
    .select({ unitId: ShelfUnit.unitId })
    .from(ShelfUnit)
    .where(eq(ShelfUnit.shelfId, shelfId))
    .orderBy(asc(ShelfUnit.position));
  const containedUnitIds = units.map((u: any) => u.unitId);
  await patchContentIfEligible(client, shelfId, { containedUnitIds });
}

export type ContentRankingPatch = {
  hotScore: number;
  topScore: number;
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

export async function patchPostsAuthor(
  client: SearchClient,
  userId: string,
  fields: Record<string, any>,
) {
  let cursor: string | undefined;

  while (true) {
    const posts = await getSearchPrismaClient().post.findMany({
      where: {
        authorUserId: userId,
        unit: publicSearchableUnitWhere(),
      },
      select: { unitId: true },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
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
  const rows: any[] = await getSearchPrismaClient().post.findMany({
    where: {
      authorUserId: userId,
      unit: publicSearchableUnitWhere(),
    },
    include: {
      ...postIncludeForSync,
      unit: {
        include: {
          user: true,
          targetUnit: { include: targetUnitSearchInclude },
          translations: true,
          contentTranslations: true,
          supportLanguages: true,
          ...realmSearchProjectionSelect,
        },
      },
    },
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
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
  // Fetch target unit data once
  const targetUnit = await getSearchPrismaClient().unit.findUnique({
    where: { id: targetUnitId },
    include: {
      translations: true,
      book: true,
      game: true,
      media: true,
    },
  });

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

  let cursor: string | undefined;

  while (true) {
    const posts = await getSearchPrismaClient().post.findMany({
      where: {
        unit: {
          ...publicSearchableUnitWhere(),
          targetUnitId,
        },
      },
      select: { unitId: true },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p: any) => ({
      id: p.unitId,
      targetTitles,
      targetType,
      targetCoverUrl,
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
  const targetUnit = await getSearchPrismaClient().unit.findUnique({
    where: { id: targetUnitId },
    include: {
      translations: true,
      book: true,
      game: true,
      media: true,
    },
  });

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

  const limit = segmentLimit(options);
  const rows: any[] = await getSearchPrismaClient().post.findMany({
    where: {
      unit: {
        ...publicSearchableUnitWhere(),
        targetUnitId,
      },
    },
    select: { unitId: true },
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
  });
  const { current, nextCursor } = segmentRows(rows, limit, "unitId");
  if (current.length > 0) {
    await client.patchPosts(
      current.map((post) => ({
        id: post.unitId,
        targetTitles,
        targetType,
        targetCoverUrl,
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
  const post = await getSearchPrismaClient().post.findUnique({
    where: { unitId },
    select: {
      unit: {
        select: {
          status: true,
          visibility: true,
          moderationStatus: true,
        },
      },
    },
  });
  if (!post || !isPublicIndexablePostUnit(post.unit)) {
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
    name: row.name,
    email: row.email,
    slug: row.slug ?? null,
    avatar: row.avatar,
    bio: row.bio,
    description: row.description,
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

const targetUnitSearchInclude = {
  translations: true,
  book: true,
  game: true,
  media: true,
} as const;

const postIncludeForSync = {
  unit: {
    include: {
      user: true,
      targetUnit: { include: targetUnitSearchInclude },
      translations: true,
      contentTranslations: true,
      supportLanguages: true,
      ...realmSearchProjectionSelect,
    },
  },
  scoreEntry: true,
} as const;

const postUnitIncludeForSync = {
  user: true,
  targetUnit: { include: targetUnitSearchInclude },
  translations: true,
  contentTranslations: true,
  supportLanguages: true,
  ...realmSearchProjectionSelect,
} as const;

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

const commentIncludeForSync = {
  author: true,
} as const;

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
    path: comment.path ?? null,
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
    hotScore: 0,
    topScore: 0,
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
    hotScore: 0,
    topScore: 0,
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

// ANCHOR: Post sync functions

export async function syncSinglePost(client: SearchClient, unitId: string) {
  const post = await getSearchPrismaClient().post.findUnique({
    where: { unitId },
    include: {
      ...postIncludeForSync,
      unit: {
        include: postUnitIncludeForSync,
      },
    },
  });

  if (!post || !isPublicIndexablePostUnit(post.unit)) {
    await client.deletePosts([unitId]);
    return;
  }

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

    const posts: any[] = await getSearchPrismaClient().post.findMany({
      where: {
        unit: publicSearchableUnitWhere(),
      },
      include: {
        ...postIncludeForSync,
        unit: {
          include: postUnitIncludeForSync,
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
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
  const posts: any[] = await getSearchPrismaClient().post.findMany({
    where: {
      unit: publicSearchableUnitWhere(),
    },
    include: {
      ...postIncludeForSync,
      unit: {
        include: postUnitIncludeForSync,
      },
    },
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
  });
  const { current, nextCursor } = segmentRows(posts, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdatePosts(current.map(buildPostDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Comment sync functions

export async function syncSingleComment(
  client: SearchClient,
  commentId: string,
) {
  const comment = await getSearchPrismaClient().comment.findUnique({
    where: { id: commentId },
    include: commentIncludeForSync,
  });

  if (!comment || !isPublicIndexableComment(comment)) {
    await client.deleteComments([commentId]);
    return;
  }

  const [pathRow] = await getSearchPrismaClient().$queryRaw<
    { id: string; path: string | null }[]
  >`
    SELECT "id", "path"::text AS path
    FROM "Comment"
    WHERE "id" = ${comment.id}::uuid
  `;

  await client.addOrUpdateComments([
    buildCommentDocument({ ...comment, path: pathRow?.path ?? null }),
  ]);
}

export async function syncCommentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const comments: any[] = await getSearchPrismaClient().comment.findMany({
    where: { moderationStatus: "APPROVED", deletedAt: null },
    include: commentIncludeForSync,
    orderBy: { id: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
  });
  const { current, nextCursor } = segmentRows(comments, limit, "id");
  if (current.length > 0) {
    const paths = (
      await Promise.all(
        current.map(
          (comment) =>
            getSearchPrismaClient().$queryRaw<
              { id: string; path: string | null }[]
            >`
            SELECT "id", "path"::text AS path
            FROM "Comment"
            WHERE "id" = ${comment.id}::uuid
          `,
        ),
      )
    ).flat();
    const pathById = new Map(paths.map((row) => [row.id, row.path]));
    await client.addOrUpdateComments(
      current.map((comment) =>
        buildCommentDocument({
          ...comment,
          path: pathById.get(comment.id) ?? null,
        }),
      ),
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

export async function syncAllPostRealmIds(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await getSearchPrismaClient().post.findMany({
      where: {
        unit: publicSearchableUnitWhere(),
      },
      select: {
        unitId: true,
        unit: {
          select: {
            ...realmSearchProjectionSelect,
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
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
  const rows: any[] = await getSearchPrismaClient().post.findMany({
    where: {
      unit: publicSearchableUnitWhere(),
    },
    select: {
      unitId: true,
      unit: {
        select: {
          ...realmSearchProjectionSelect,
        },
      },
    },
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
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
    const shelves: any[] = await getSearchPrismaClient().unit.findMany({
      where: {
        type: "SHELF",
        ...publicSearchableUnitWhere(),
      },
      select: {
        id: true,
        shelf: {
          select: {
            units: {
              select: { unitId: true },
            },
          },
        },
      },
      orderBy: { id: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
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
    const posts: any[] = await getSearchPrismaClient().post.findMany({
      where: {
        authorUserId: userId,
        unit: publicSearchableUnitWhere(),
      },
      include: {
        ...postIncludeForSync,
        unit: {
          include: {
            user: true,
            targetUnit: { include: targetUnitSearchInclude },
            ...realmSearchProjectionSelect,
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
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
    const posts: any[] = await getSearchPrismaClient().post.findMany({
      where: {
        unit: {
          ...publicSearchableUnitWhere(),
          targetUnitId,
        },
      },
      include: {
        ...postIncludeForSync,
        unit: {
          include: {
            user: true,
            targetUnit: { include: targetUnitSearchInclude },
            ...realmSearchProjectionSelect,
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
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

// ANCHOR: Poll document builder

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

export async function syncSingleRealm(client: SearchClient, unitId: string) {
  const realm = await getSearchPrismaClient().realm.findUnique({
    where: { unitId },
    include: {
      unit: {
        include: {
          translations: true,
          supportLanguages: true,
          aliases: {
            where: {
              status: "ACTIVE",
              OR: [
                { score: { gt: VISIBILITY_THRESHOLD } },
                { pinned: true },
              ] as any,
            },
            orderBy: [{ pinned: "desc" }, { score: "desc" }],
          } as any,
        },
      },
    },
  });

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

    const realms: any[] = await getSearchPrismaClient().realm.findMany({
      where: {
        unit: { status: "PUBLISHED" },
      },
      include: {
        unit: {
          include: {
            translations: true,
            supportLanguages: true,
            aliases: {
              where: {
                status: "ACTIVE",
                OR: [
                  { score: { gt: VISIBILITY_THRESHOLD } },
                  { pinned: true },
                ] as any,
              },
              orderBy: [{ pinned: "desc" }, { score: "desc" }],
            } as any,
          },
        },
      },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

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
  const realms: any[] = await getSearchPrismaClient().realm.findMany({
    where: {
      unit: { status: "PUBLISHED" },
    },
    include: {
      unit: {
        include: {
          translations: true,
          aliases: {
            where: {
              status: "ACTIVE",
              OR: [
                { score: { gt: VISIBILITY_THRESHOLD } },
                { pinned: true },
              ] as any,
            },
            orderBy: [{ pinned: "desc" }, { score: "desc" }],
          } as any,
        },
      },
    },
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
  });
  const { current, nextCursor } = segmentRows(realms, limit, "unitId");
  if (current.length > 0) {
    await client.addOrUpdateRealms(current.map(buildRealmDocument));
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Entity document builder + sync

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
