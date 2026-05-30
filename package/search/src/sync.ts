import type {
  ContentSearchDocument,
  EntitySearchDocument,
  FeedbackSearchDocument,
  PostSearchDocument,
  RealmSearchDocument,
  UserSearchDocument,
} from "@rezics/contract";
import {
  mainMarkdownSource,
  RATING_TAGS,
  readCoverUrlFromExtra,
} from "@rezics/contract";
import {
  type Prisma,
  type PrismaClient,
  UnitType,
} from "@rezics/server/prisma/generated/client";
import type { SearchClient } from "./client";
import {
  buildProgressDocument,
  progressDocumentId,
  type UserUnitProgressRow,
} from "./progress";

let searchPrismaClient: PrismaClient | null = null;

export function setSearchPrismaClient(prisma: PrismaClient): void {
  searchPrismaClient = prisma;
}

function getSearchPrismaClient(): PrismaClient {
  if (!searchPrismaClient) {
    throw new Error(
      "Search Prisma client is not configured. Call setSearchPrismaClient() before running search sync.",
    );
  }
  return searchPrismaClient;
}

function isNonEmptyString(value: string | null): value is string {
  return Boolean(value);
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
  UnitType.BOOK,
  UnitType.GAME,
  UnitType.MEDIA,
  UnitType.SHELF,
  UnitType.LINK,
];

const PUBLIC_ELIGIBLE_UNIT_WHERE = {
  status: "PUBLISHED",
  visibility: "PUBLIC",
} as const;

const SEARCH_EXCLUDED_GLOBAL_CONTENT_STATES = [
  "HIDDEN",
  "TOMBSTONED",
  "ARCHIVED",
  "REMOVED",
] as string[];
const SEARCH_EXCLUDED_REALM_CONTENT_STATES = new Set([
  "HIDDEN",
  "TOMBSTONED",
  "ARCHIVED",
  "REMOVED",
]);
const RATING_TAG_SLUGS = new Set<string>(RATING_TAGS);

function publicSearchableUnitWhere(): Prisma.UnitWhereInput {
  return {
    ...PUBLIC_ELIGIBLE_UNIT_WHERE,
    OR: [
      { contentModerationState: null },
      {
        contentModerationState: {
          state: { notIn: SEARCH_EXCLUDED_GLOBAL_CONTENT_STATES as any },
        },
      },
    ],
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
  const unit = await getSearchPrismaClient().unit.findUnique({
    where: { id: unitId },
    select: {
      type: true,
      status: true,
      visibility: true,
      contentModerationState: { select: { state: true } },
      workMembers: { where: { role: "RELEASE" }, select: { unitId: true } },
    },
  });
  return isPublicIndexableContentUnit(unit);
}

export function isPublicIndexableContentUnit(
  unit:
    | {
        type: string;
        status: string;
        visibility: string;
        contentModerationState?: { state: string } | null;
        workUnitId?: string | null;
        workMembers?: readonly unknown[];
      }
    | null
    | undefined,
): boolean {
  return Boolean(
    unit &&
      INDEXABLE_TYPES.includes(unit.type as any) &&
      unit.status === PUBLIC_ELIGIBLE_UNIT_WHERE.status &&
      unit.visibility === PUBLIC_ELIGIBLE_UNIT_WHERE.visibility &&
      !SEARCH_EXCLUDED_GLOBAL_CONTENT_STATES.includes(
        unit.contentModerationState?.state as any,
      ) &&
      (unit.workMembers?.length ?? 0) === 0,
  );
}

export function isPublicIndexablePostUnit(
  unit:
    | {
        status: string;
        visibility: string;
        contentModerationState?: { state: string } | null;
      }
    | null
    | undefined,
): boolean {
  return Boolean(
    unit &&
      unit.status === PUBLIC_ELIGIBLE_UNIT_WHERE.status &&
      unit.visibility === PUBLIC_ELIGIBLE_UNIT_WHERE.visibility &&
      !SEARCH_EXCLUDED_GLOBAL_CONTENT_STATES.includes(
        unit.contentModerationState?.state as any,
      ),
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
  const blockedRealmIds = new Set(
    (unit?.realmModerationTargets ?? [])
      .filter((overlay: any) =>
        SEARCH_EXCLUDED_REALM_CONTENT_STATES.has(overlay.state),
      )
      .map((overlay: any) => overlay.realmUnitId),
  );

  return (unit?.inRealms ?? [])
    .filter((realm: any) => !realm.state || realm.state === "VISIBLE")
    .filter((realm: any) => realm.realm?.realm?.isPublic !== false)
    .map((realm: any) => realm.realmUnitId)
    .filter((realmUnitId: string) => !blockedRealmIds.has(realmUnitId));
}

const realmSearchProjectionSelect = {
  inRealms: {
    where: { state: "VISIBLE" },
    select: {
      realmUnitId: true,
      state: true,
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
  realmModerationTargets: {
    select: { realmUnitId: true, state: true },
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
  aliases: {
    where: {
      status: "ACTIVE" as const,
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    orderBy: [{ pinned: "desc" as const }, { score: "desc" as const }],
  } as any,
  unitTags: visibleUnitTagsInclude,
  workMemberships: {
    include: {
      work: {
        include: {
          unitTags: visibleUnitTagsInclude,
        },
      },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  },
  workMembers: {
    where: { role: "RELEASE" },
    select: { unitId: true },
  },
  ...realmSearchProjectionSelect,
  contentModerationState: true,
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
  const workMemberships: any[] = unit.workMemberships ?? [];
  const releaseMembership =
    workMemberships.find((membership) => membership.role === "RELEASE") ?? null;
  const workUnitId = releaseMembership?.workUnitId ?? null;
  const workTagRows: any[] = (releaseMembership?.work?.unitTags ?? []).filter(
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
  const contentText = mainMarkdownSource(unit.post?.content);
  const languages = translations.map((t: any) => t.language);
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
  const workTagIds = workTagRows.map((ut: any) => ut.tagUnitId);
  const workTagLabels = workTagRows.flatMap((ut: any) =>
    (ut.tag?.translations ?? []).map((t: any) => t.title).filter(Boolean),
  );
  const allTagIds = [...new Set([...tagIds, ...workTagIds])];
  const allTagLabels = [...new Set([...tagLabels, ...workTagLabels])];
  const workUnitIds = workMemberships.map(
    (membership) => membership.workUnitId,
  );
  const workRoles = workMemberships.map((membership) => membership.role);
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
  const translationGroupId = unit.translationGroupId ?? null;

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
    workUnitId,
    searchGroupId: workUnitId ?? unit.id,
    ownTagIds: tagIds,
    workTagIds,
    allTagIds,
    ownTagLabels: tagLabels,
    workTagLabels,
    allTagLabels,
    position: releaseMembership?.position ?? null,
    displayPolicy: releaseMembership?.displayPolicy ?? null,
    workUnitIds,
    workRoles,
    seriesUnitIds,
    seriesKindKeys,
    seriesTitles,
    realmIds,
    translationGroupId,
    realmTagKeys,
    languages,
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
        ...publicSearchableUnitWhere(),
        NOT: { workMembers: { some: { role: "RELEASE" } } },
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
      ...publicSearchableUnitWhere(),
      NOT: { workMembers: { some: { role: "RELEASE" } } },
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

export async function syncWorkReleasesSegment(
  client: SearchClient,
  workUnitId: string,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const units: any[] = await getSearchPrismaClient().unit.findMany({
    where: {
      type: { in: INDEXABLE_TYPES },
      ...publicSearchableUnitWhere(),
      workMemberships: {
        some: {
          workUnitId,
          role: "RELEASE",
        },
      },
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

export async function syncWorkDomainContentSegment(
  client: SearchClient,
  options: SearchSegmentOptions = {},
): Promise<SearchSegmentResult> {
  const limit = segmentLimit(options);
  const units: any[] = await getSearchPrismaClient().unit.findMany({
    where: {
      type: { in: INDEXABLE_TYPES },
      ...publicSearchableUnitWhere(),
      workMemberships: {
        some: { role: "RELEASE" },
      },
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
      type: { in: [UnitType.GAME, UnitType.MEDIA] },
      ...publicSearchableUnitWhere(),
      NOT: { workMembers: { some: { role: "RELEASE" } } },
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

export async function syncSingleProgress(
  client: SearchClient,
  userId: string,
  unitId: string,
): Promise<void> {
  const row = await getSearchPrismaClient().userUnitProgress.findUnique({
    where: { userId_unitId: { userId, unitId } },
  });
  if (!row) {
    await removeProgress(client, userId, unitId);
    return;
  }
  await syncProgress(client, row as UserUnitProgressRow);
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
  const rows: any[] = await getSearchPrismaClient().userUnitProgress.findMany({
    where: { isDeleted: false },
    orderBy: [{ userId: "asc" }, { unitId: "asc" }],
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor
      ? {
          userId_unitId: {
            userId: options.cursor.split(":")[0] ?? "",
            unitId: options.cursor.split(":").slice(1).join(":"),
          },
        }
      : undefined,
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
    SEARCH_EXCLUDED_GLOBAL_CONTENT_STATES.includes(
      (unit as any).contentModerationState?.state,
    ) ||
    (unit.workMembers?.length ?? 0) > 0
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
  const unitTags = await getSearchPrismaClient().unitTag.findMany({
    where: {
      unitId,
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    include: { tag: { include: { translations: true } } },
    orderBy: { score: "desc" },
  });

  const tagIds = unitTags.map((ut: any) => ut.tagUnitId);
  const tagScores: Record<string, number> = {};
  const tagLabels: string[] = [];
  for (const ut of unitTags) {
    tagScores[ut.tagUnitId] = ut.score;
    const labels: string[] = ((ut as any).tag?.translations ?? [])
      .map((t: any) => t.title)
      .filter(Boolean);
    tagLabels.push(...labels);
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
  const aliases = await getSearchPrismaClient().unitAlias.findMany({
    where: {
      unitId,
      status: "ACTIVE",
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    orderBy: [{ pinned: "desc" }, { score: "desc" }],
  });

  await patchContentIfEligible(client, unitId, {
    aliasValues: aliases.map((alias) => alias.value).filter(Boolean),
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
  const creditAttributions =
    await getSearchPrismaClient().creditAttribution.findMany({
      where: { unitId },
      include: {
        entity: {
          include: { translations: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

  const creditNames = creditAttributions
    .map((a: any) => {
      const translations = a.entity?.translations ?? [];
      return translations[0]?.title;
    })
    .filter(isNonEmptyString);

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
  const subjectAttributions =
    await getSearchPrismaClient().subjectAttribution.findMany({
      where: { unitId },
      include: {
        entity: {
          include: { entity: true, translations: true },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

  const subjectEntityIds = subjectAttributions.map((a: any) => a.entityId);
  const subjectNames = subjectAttributions
    .flatMap((a: any) =>
      (a.entity?.translations ?? []).map(
        (translation: any) => translation.title,
      ),
    )
    .filter(Boolean);
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
  const translations = await getSearchPrismaClient().unitTranslation.findMany({
    where: { unitId },
  });

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const subtitles = translations.map((t: any) => t.subtitle).filter(Boolean);
  const summaries = translations.map((t: any) => t.summary).filter(Boolean);
  const descriptions = translations
    .map((t: any) => mainMarkdownSource(t.description))
    .filter(isNonEmptyString);
  const descriptionText = descriptions.join("\n") || null;
  const languages = translations.map((t: any) => t.language);

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
  const [inRealms, realmModerationTargets] = await Promise.all([
    getSearchPrismaClient().unitRealm.findMany({
      where: { unitId, state: "VISIBLE" },
      include: {
        realm: {
          select: {
            realm: {
              select: { isPublic: true },
            },
          },
        },
      },
    }),
    getSearchPrismaClient().realmContentModeration.findMany({
      where: { targetUnitId: unitId },
      select: { realmUnitId: true, state: true },
    }),
  ]);

  const realmIds = realmIdsForSearch({ inRealms, realmModerationTargets });
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
  const realmTagApplicationsAsTargetUnit =
    await getSearchPrismaClient().realmTagApplication.findMany({
      where: { unitId },
    });

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
  if ("status" in fields || "visibility" in fields || "workUnitId" in fields) {
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
  const units = await getSearchPrismaClient().shelfUnit.findMany({
    where: { shelfId },
    select: { unitId: true },
  });
  const containedUnitIds = units.map((u) => u.unitId);
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

export type CommentRankingPatch = {
  commentHotScore: number;
  commentTopScore: number;
  commentQualityScore: number;
  commentRankUpdatedAt: string | null;
};

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
  await patchPostFields(client, unitId, fields);
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

    const docs = posts.map((p) => ({ id: p.unitId, ...fields }));
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
          ...realmSearchProjectionSelect,
          workMemberships: true,
          contentModerationState: true,
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
        targetUnitId,
        unit: publicSearchableUnitWhere(),
      },
      select: { unitId: true },
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

    if (posts.length === 0) break;

    const docs = posts.map((p) => ({
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
      targetUnitId,
      unit: publicSearchableUnitWhere(),
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
          contentModerationState: { select: { state: true } },
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
  const realm = await getSearchPrismaClient().realm.findUnique({
    where: { unitId },
    select: { memberCount: true },
  });
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
  const translations = await getSearchPrismaClient().unitTranslation.findMany({
    where: { unitId },
  });

  const titles = translations.map((t: any) => t.title).filter(Boolean);
  const descriptions = translations
    .map((t: any) => mainMarkdownSource(t.description))
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
        description: tr.description ?? null,
      })),
    },
  ]);
}

export async function patchRealmAliases(client: SearchClient, unitId: string) {
  const realm = await getSearchPrismaClient().realm.findUnique({
    where: { unitId },
    select: { unitId: true, unit: { select: { status: true } } },
  });
  if (!realm || realm.unit.status !== "PUBLISHED") {
    await client.deleteRealms([unitId]);
    return;
  }

  const aliases = await getSearchPrismaClient().unitAlias.findMany({
    where: {
      unitId,
      status: "ACTIVE",
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    orderBy: [{ pinned: "desc" }, { score: "desc" }],
  });

  await client.patchRealms([
    {
      id: unitId,
      aliasValues: aliases.map((alias) => alias.value).filter(Boolean),
    },
  ]);
}

// ANCHOR: User and feedback partial sync functions

export async function syncSingleUser(client: SearchClient, unitId: string) {
  const user = await getSearchPrismaClient().user.findUnique({
    where: { unitId },
  });
  if (!user) {
    await client.deleteUsers([unitId]);
    return;
  }

  const unit = await getSearchPrismaClient().unit.findUnique({
    where: { id: unitId },
    select: { slug: true },
  });

  await client.addOrUpdateUsers([
    {
      id: user.unitId,
      unitId: user.unitId,
      name: user.name,
      email: user.email,
      slug: unit?.slug ?? null,
      avatar: user.avatar,
      bio: user.bio,
      description: user.description,
      descriptionText: mainMarkdownSource(user.description),
      followersCount: user.followersCount,
      followingsCount: user.followingsCount,
      joinDate:
        user.joinDate instanceof Date
          ? user.joinDate.toISOString()
          : (user.joinDate ?? null),
      permission: (user.permission ?? null) as any,
    },
  ]);
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
  const feedback = await getSearchPrismaClient().feedback.findUnique({
    where: { id },
    select: { resolved: true, resolvedAt: true },
  });
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

export async function syncSingleFeedback(client: SearchClient, id: string) {
  const feedback = await getSearchPrismaClient().feedback.findUnique({
    where: { id },
  });
  if (!feedback) {
    await client.deleteFeedbacks([id]);
    return;
  }

  await client.addOrUpdateFeedbacks([
    {
      id: feedback.id,
      userId: feedback.userId,
      unitId: feedback.unitId,
      type: feedback.type,
      content: feedback.content,
      url: feedback.url,
      resolved: feedback.resolved,
      createdAt:
        feedback.createdAt instanceof Date
          ? feedback.createdAt.toISOString()
          : feedback.createdAt,
      updatedAt:
        feedback.updatedAt instanceof Date
          ? feedback.updatedAt.toISOString()
          : feedback.updatedAt,
    },
  ]);
}

export async function syncAllFeedbacks(client: SearchClient) {
  const deleteResult = await client.deleteAllFeedbacks();
  console.log("syncAllFeedbacks: deleted all documents", deleteResult);

  let cursor: string | undefined;
  let total = 0;

  while (true) {
    console.log("syncAllFeedbacks: cursor", cursor, "total", total);

    const feedbacks: any[] = await getSearchPrismaClient().feedback.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { id: "asc" },
    });

    if (feedbacks.length === 0) break;

    const formatted: FeedbackSearchDocument[] = feedbacks.map((f) => ({
      id: f.id,
      userId: f.userId,
      unitId: f.unitId,
      url: f.url,
      content: f.content,
      type: f.type,
      resolved: f.resolved,
      resolvedAt: f.resolvedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

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
  const feedbacks: any[] = await getSearchPrismaClient().feedback.findMany({
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { id: options.cursor } : undefined,
    orderBy: { id: "asc" },
  });
  const { current, nextCursor } = segmentRows(feedbacks, limit, "id");
  if (current.length > 0) {
    await client.addOrUpdateFeedbacks(
      current.map((f) => ({
        id: f.id,
        userId: f.userId,
        unitId: f.unitId,
        url: f.url,
        content: f.content,
        type: f.type,
        resolved: f.resolved,
        resolvedAt: f.resolvedAt,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}

// ANCHOR: Post document builder

const postIncludeForSync = {
  unit: {
    include: {
      user: true,
      ...realmSearchProjectionSelect,
      workMemberships: true,
      contentModerationState: true,
    },
  },
  targetUnit: {
    include: {
      translations: true,
      book: true,
      game: true,
      media: true,
    },
  },
  scoreEntry: true,
} as const;

export function buildPostDocument(post: any): PostSearchDocument {
  const user = post.unit?.user;
  const workMemberships: any[] = post.unit?.workMemberships ?? [];
  const targetUnit = post.targetUnit;
  const scoreEntry = post.scoreEntry;

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
    contentText: mainMarkdownSource(post.content),
    kind: post.kind ?? null,
    depth: post.depth,
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
    commentHotScore: 0,
    commentTopScore: 0,
    commentQualityScore: 0,
    commentRankUpdatedAt: null,
    targetUnitId: post.targetUnitId ?? null,
    rootTargetUnitId: post.rootTargetUnitId ?? null,
    rootTargetUnitType: post.rootTargetUnitType ?? null,
    realmIds: realmIdsForSearch(post.unit),
    workUnitIds: workMemberships.map((membership) => membership.workUnitId),
    workRoles: workMemberships.map((membership) => membership.role),
    rootPostUnitId: post.rootPostUnitId ?? null,
    parentPostUnitId: post.parentPostUnitId ?? null,
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
  };
}

// ANCHOR: Post sync functions

export async function syncSinglePost(client: SearchClient, unitId: string) {
  const post = await getSearchPrismaClient().post.findUnique({
    where: { unitId },
    include: {
      ...postIncludeForSync,
      unit: {
        include: {
          user: true,
          ...realmSearchProjectionSelect,
          workMemberships: true,
          contentModerationState: true,
        },
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
          include: {
            user: true,
            ...realmSearchProjectionSelect,
            workMemberships: true,
            contentModerationState: true,
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
        include: {
          user: true,
          ...realmSearchProjectionSelect,
          workMemberships: true,
          contentModerationState: true,
        },
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

export async function syncAllPostRootTargets(client: SearchClient) {
  let cursor: string | undefined;
  let total = 0;

  while (true) {
    const posts: any[] = await getSearchPrismaClient().post.findMany({
      where: {
        unit: publicSearchableUnitWhere(),
      },
      select: {
        unitId: true,
        rootTargetUnitId: true,
        rootTargetUnitType: true,
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
        rootTargetUnitId: post.rootTargetUnitId ?? null,
        rootTargetUnitType: post.rootTargetUnitType ?? null,
      })),
    );

    total += posts.length;
    cursor = posts[posts.length - 1]!.unitId;
  }

  return { message: "syncAllPostRootTargets success", totalSynced: total };
}

export async function syncPostRootTargetsSegment(
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
      rootTargetUnitId: true,
      rootTargetUnitType: true,
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
        rootTargetUnitId: post.rootTargetUnitId ?? null,
        rootTargetUnitType: post.rootTargetUnitType ?? null,
      })),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
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
            ...realmSearchProjectionSelect,
            workMemberships: true,
            contentModerationState: true,
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
        targetUnitId,
        unit: publicSearchableUnitWhere(),
      },
      include: {
        ...postIncludeForSync,
        unit: {
          include: {
            user: true,
            ...realmSearchProjectionSelect,
            workMemberships: true,
            contentModerationState: true,
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
    .map((t: any) => mainMarkdownSource(t.description))
    .filter(isNonEmptyString);
  const aliasValues = aliases.map((alias: any) => alias.value).filter(Boolean);

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
    titles,
    descriptions,
    aliasValues,
    translations: translations.map((tr: any) => ({
      language: tr.language,
      title: tr.title ?? null,
      description: tr.description ?? null,
    })),
    extra: realm.extra ?? undefined,
  };
}

// ANCHOR: Realm sync functions

export async function syncSingleRealm(client: SearchClient, unitId: string) {
  const realm = await getSearchPrismaClient().realm.findUnique({
    where: { unitId },
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

const entityIncludeForSync = {
  unit: {
    include: {
      translations: true,
      aliases: {
        where: {
          status: "ACTIVE" as const,
          OR: [
            { score: { gt: VISIBILITY_THRESHOLD } },
            { pinned: true },
          ] as any,
        },
        orderBy: [{ pinned: "desc" as const }, { score: "desc" as const }],
      } as any,
    },
  },
} as const;

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
  const entity = await getSearchPrismaClient().entity.findUnique({
    where: { unitId },
    include: entityIncludeForSync,
  });

  if (!entity) {
    await client.deleteEntities([unitId]);
    return;
  }

  const doc = buildEntityDocument(entity);
  await client.addOrUpdateEntities([doc]);
}

export async function patchEntityAliases(client: SearchClient, unitId: string) {
  const entity = await getSearchPrismaClient().entity.findUnique({
    where: { unitId },
    select: { unitId: true },
  });
  if (!entity) {
    await client.deleteEntities([unitId]);
    return;
  }

  const aliases = await getSearchPrismaClient().unitAlias.findMany({
    where: {
      unitId,
      status: "ACTIVE",
      OR: [{ score: { gt: VISIBILITY_THRESHOLD } }, { pinned: true }] as any,
    },
    orderBy: [{ pinned: "desc" }, { score: "desc" }],
  });

  await client.patchEntities([
    {
      id: unitId,
      aliasValues: aliases.map((alias) => alias.value).filter(Boolean),
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

    const entities: any[] = await getSearchPrismaClient().entity.findMany({
      include: entityIncludeForSync,
      orderBy: { unitId: "asc" },
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
    });

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
  const entities: any[] = await getSearchPrismaClient().entity.findMany({
    include: entityIncludeForSync,
    orderBy: { unitId: "asc" },
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
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

    const users: any[] = await getSearchPrismaClient().user.findMany({
      take: BATCH_SIZE,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { unitId: cursor } : undefined,
      orderBy: { unitId: "asc" },
    });

    if (users.length === 0) break;

    // Slug now lives on the USER Unit. Batch-fetch.
    const unitSlugs = await getSearchPrismaClient().unit.findMany({
      where: { id: { in: users.map((u) => u.unitId) } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(unitSlugs.map((u) => [u.id, u.slug ?? null]));

    const formatted: UserSearchDocument[] = users.map((u) => ({
      id: u.unitId,
      unitId: u.unitId,
      name: u.name,
      email: u.email,
      slug: slugById.get(u.unitId) ?? null,
      avatar: u.avatar,
      bio: u.bio,
      description: u.description,
      descriptionText: mainMarkdownSource(u.description),
      followersCount: u.followersCount,
      followingsCount: u.followingsCount,
      joinDate:
        u.joinDate instanceof Date
          ? u.joinDate.toISOString()
          : (u.joinDate ?? null),
      permission: (u.permission ?? null) as any,
    }));

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
  const users: any[] = await getSearchPrismaClient().user.findMany({
    take: limit + 1,
    skip: options.cursor ? 1 : 0,
    cursor: options.cursor ? { unitId: options.cursor } : undefined,
    orderBy: { unitId: "asc" },
  });
  const { current, nextCursor } = segmentRows(users, limit, "unitId");
  if (current.length > 0) {
    const unitSlugs = await getSearchPrismaClient().unit.findMany({
      where: { id: { in: current.map((u) => u.unitId) } },
      select: { id: true, slug: true },
    });
    const slugById = new Map(unitSlugs.map((u) => [u.id, u.slug ?? null]));

    await client.addOrUpdateUsers(
      current.map((u) => ({
        id: u.unitId,
        unitId: u.unitId,
        name: u.name,
        email: u.email,
        slug: slugById.get(u.unitId) ?? null,
        avatar: u.avatar,
        bio: u.bio,
        description: u.description,
        descriptionText: mainMarkdownSource(u.description),
        followersCount: u.followersCount,
        followingsCount: u.followingsCount,
        joinDate:
          u.joinDate instanceof Date
            ? u.joinDate.toISOString()
            : (u.joinDate ?? null),
        permission: (u.permission ?? null) as any,
      })),
    );
  }
  return { processed: current.length, ...(nextCursor ? { nextCursor } : {}) };
}
