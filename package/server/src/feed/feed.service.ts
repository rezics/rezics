import type {
  FeedBookRow,
  FeedFilterType,
  FeedPostRow,
  FeedQuery,
  FeedResponse,
  FeedRow,
  FeedShelfRow,
  FeedSort,
  FeedUnitRow,
  FeedWorkSummary,
  PostDTO,
  PostKind as PostKindValue,
  PostListQuery,
  ShelfSummaryDTO,
  ZoneBoundary,
} from "@rezics/contract";
import { mainMarkdownSource, PostKind } from "@rezics/contract";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { bookService } from "@/book";
import { db } from "@/db";
import { UnitTranslation } from "@/db/schema/translation";
import { Unit } from "@/db/schema/unit";
import { postService } from "@/post";
import { mapPostToDTO } from "@/post/post.mapper";
import { realmService } from "@/realm";
import { shelfService } from "@/shelf";
import { resolveEffectiveReadLanguageCandidates } from "@/unit/language-resolution";
import { hydrateVariantContextSummaries } from "@/unit/variant-context";
import { AppError } from "@/utils/errors";
import { zoneService } from "@/zone";
import {
  feedResponse,
  mapPostToFeedRow,
  mapUnitToFeedRow,
} from "./feed.mapper";

const FEED_LIMIT_CAP = 50;
const RECOMMENDATION_ITEM_LIMIT = 8;
const FIRST_RECOMMENDATION_AFTER = 4;
const RECOMMENDATION_SPACING = 6;

function normalizeSort(sort: FeedQuery["sort"]): FeedSort {
  return sort ?? "best";
}

function postSortForFeed(sort: FeedSort): PostListQuery["sort"] {
  switch (sort) {
    case "top":
      return "top";
    case "new":
    case "rising":
      return "new";
    case "hot":
    case "best":
      return "hot";
  }
}

function postCursorForFeed(
  cursor: FeedQuery["cursor"],
): PostListQuery["cursor"] | undefined {
  if (!cursor?.rowId) return undefined;
  const [type, unitId] = cursor.rowId.split(":");
  if (type !== "post" || !unitId) return undefined;
  return {
    unitId,
    sortValue: cursor.sortValue,
    createdAt: cursor.createdAt,
  };
}

function postQueryForFeed(query: FeedQuery, limit: number): PostListQuery {
  return {
    sort: postSortForFeed(normalizeSort(query.sort)),
    cursor: postCursorForFeed(query.cursor),
    limit,
    ...(query.targetUnitId ? { targetUnitId: query.targetUnitId } : {}),
    ...(query.variantUnitId ? { variantUnitId: query.variantUnitId } : {}),
    ...(query.languages ? { languages: query.languages as string } : {}),
    ...(query.languageMode ? { languageMode: query.languageMode } : {}),
    ...(query.tagIds?.length ? { tagIds: query.tagIds } : {}),
    ...(query.realmModerationStatus
      ? { realmModerationStatus: query.realmModerationStatus }
      : {}),
  };
}

function uniqueStrings(values: readonly (string | null | undefined)[]) {
  return [
    ...new Set(values.filter((value): value is string => Boolean(value))),
  ];
}

function zoneBoundaryRealmUnitId(boundary: ZoneBoundary): string | undefined {
  const realm = boundary.filters.realm;
  if (realm && realm !== "context") {
    // PostListQuery is single-realm; a multi-realm boundary is enforced fully
    // on the meili query-section path, not here.
    // PostListQuery 是单 realm 的；多 realm 边界完全在 meili 查询分区路径
    // 上强制执行，而不是这里。
    return realm.unitIds.length === 1 ? realm.unitIds[0] : undefined;
  }
  return boundary.context.kind === "realm"
    ? boundary.context.realmUnitId
    : undefined;
}

function withZoneFeedFilters(
  base: PostListQuery,
  boundaryEnvelope: ZoneBoundary,
): PostListQuery {
  // Zone feed is post-backed in this service; only PostListQuery-native
  // filters from the zone boundary are applied here. Content-only filters
  // such as type/rating belong to the meili query-section path.
  // 专区 feed 在本服务中基于帖子；这里只应用专区边界中 PostListQuery
  // 原生支持的过滤。type/rating 等仅内容侧的过滤属于 meili 查询分区路径。
  const boundary = boundaryEnvelope.filters;
  const realmUnitId = zoneBoundaryRealmUnitId(boundaryEnvelope);
  const kind =
    boundary.postKinds?.length === 1 ? boundary.postKinds[0] : undefined;
  const languages = Array.isArray(boundary.languages)
    ? boundary.languages
    : undefined;
  const zoneTagIds = uniqueStrings([
    ...(boundary.tagUnitIds ?? []),
    ...(boundary.realmTagUnitIds ?? []),
  ]);
  return {
    ...base,
    ...(realmUnitId ? { realmUnitId } : {}),
    ...(kind ? { kind } : {}),
    ...(languages?.length ? { languages: languages.join(",") } : {}),
    ...(zoneTagIds.length
      ? { tagIds: uniqueStrings([...(base.tagIds ?? []), ...zoneTagIds]) }
      : {}),
  };
}

function countPostRows(rows: FeedRow[]): number {
  return rows.filter((row) => row.type === "post").length;
}

function withSliceCursor(response: FeedResponse, limit: number): FeedResponse {
  if (countPostRows(response.rows) < limit) {
    return { ...response, nextCursor: null };
  }
  return response;
}

const UNIT_FILTER_TYPES = {
  book: "BOOK",
  game: "GAME",
  media: "MEDIA",
  realm: "REALM",
  zone: "ZONE",
} as const satisfies Partial<
  Record<FeedFilterType, FeedUnitRow["unit"]["type"]>
>;

function unitTypeForFeedFilter(
  filterType: FeedFilterType,
): FeedUnitRow["unit"]["type"] | null {
  return (
    UNIT_FILTER_TYPES[filterType as keyof typeof UNIT_FILTER_TYPES] ?? null
  );
}

function postKindForFeedFilter(
  filterType: FeedFilterType,
): PostKindValue | null {
  if (filterType === "post") return PostKind.POST;
  if (filterType === "review") return PostKind.REVIEW;
  return null;
}

function unitCursorForFeed(cursor: FeedQuery["cursor"]): Date | null {
  if (!cursor?.rowId || !cursor.createdAt) return null;
  const [type] = cursor.rowId.split(":");
  if (type !== "unit") return null;
  const createdAt = new Date(cursor.createdAt);
  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function titleFromTranslations(
  source:
    | {
        title?: string | null;
        unit?: { translations?: Array<{ title?: string | null }> };
      }
    | null
    | undefined,
): string | null {
  return (
    source?.title ??
    source?.unit?.translations?.find((translation) => translation.title)
      ?.title ??
    null
  );
}

function preferredTranslation<T extends { language: string }>(
  translations: T[],
  languages: string[],
): T | undefined {
  if (languages.length === 0) return translations[0];
  return (
    languages
      .map((language) =>
        translations.find((translation) => translation.language === language),
      )
      .find(Boolean) ?? translations[0]
  );
}

function mapBookToWorkSummary(book: unknown): FeedWorkSummary {
  const source = book as {
    unitId?: string;
    kind?: string | null;
    title?: string | null;
    coverUrl?: string | null;
    summary?: string | null;
    description?: string | null;
    unit?: { translations?: Array<{ title?: string | null }> };
  };
  return {
    unitId: source.unitId ?? "",
    kind: source.kind ?? "book",
    title: titleFromTranslations(source),
    coverUrl: source.coverUrl ?? null,
    description: source.summary ?? source.description ?? null,
  };
}

function mapShelfToSummary(shelf: unknown): ShelfSummaryDTO {
  const source = shelf as Partial<ShelfSummaryDTO>;
  return {
    unitId: source.unitId ?? "",
    slug: source.slug ?? null,
    userId: source.userId ?? null,
    kindKey: source.kindKey ?? null,
    coverUrl: source.coverUrl ?? null,
    title: source.title ?? null,
    itemCount: source.itemCount ?? 0,
    tags: source.tags,
  };
}

function mapBookToFeedRow(book: unknown): FeedBookRow {
  const summary = mapBookToWorkSummary(book);
  return {
    type: "book",
    rowId: `book:${summary.unitId}`,
    book: summary,
    href: `/book/${summary.unitId}`,
    recommendationReason: "home-book-recommendation",
  };
}

function mapShelfToFeedRow(shelf: unknown): FeedShelfRow {
  const summary = mapShelfToSummary(shelf);
  return {
    type: "shelf",
    rowId: `shelf:${summary.unitId}`,
    shelf: summary,
    href: `/shelf/${summary.unitId}`,
    recommendationReason: "home-shelf-recommendation",
  };
}

function scheduleFeedRows(
  postRows: FeedRow[],
  recommendationRows: FeedRow[],
): FeedRow[] {
  if (postRows.length === 0) {
    return recommendationRows;
  }
  if (recommendationRows.length === 0) {
    return postRows;
  }

  const out: FeedRow[] = [];
  let nextRecommendationAt = FIRST_RECOMMENDATION_AFTER;
  let recommendationIndex = 0;

  for (let index = 0; index < postRows.length; index += 1) {
    out.push(postRows[index]!);
    const contentPosition = index + 1;
    if (
      recommendationIndex < recommendationRows.length &&
      contentPosition >= nextRecommendationAt
    ) {
      out.push(recommendationRows[recommendationIndex]!);
      recommendationIndex += 1;
      nextRecommendationAt = contentPosition + RECOMMENDATION_SPACING;
    }
  }

  while (recommendationIndex < recommendationRows.length) {
    out.push(recommendationRows[recommendationIndex]!);
    recommendationIndex += 1;
  }

  return out;
}

type FeedPostSource = Parameters<typeof mapPostToDTO>[0] & {
  feedSortValue?: number | string | null;
};

type FeedPostDTO = PostDTO & {
  feedSortValue?: number | string | null;
};

type FeedRealmSummary = NonNullable<FeedPostRow["realm"]>;

function hasEmbeddedTargetSummary(post: FeedPostDTO): boolean {
  return Boolean(post.extra?.book?.title);
}

function realmIdForFeedPost(
  post: PostDTO,
  fallbackRealmUnitId?: string | null,
) {
  return fallbackRealmUnitId ?? post.realmUnitId ?? null;
}

async function mapPostsToDTOs(
  posts: FeedPostSource[],
  query: FeedQuery,
): Promise<FeedPostDTO[]> {
  const variantContexts = await hydrateVariantContextSummaries(posts);
  const languages = resolveEffectiveReadLanguageCandidates({
    languages: query.languages,
    appLocale: query.appLocale,
  });
  return posts.map((post) => ({
    ...mapPostToDTO(post, variantContexts, languages),
    feedSortValue: post.feedSortValue ?? null,
  }));
}

async function hydrateRealmSummaries(
  realmUnitIds: string[],
  query: FeedQuery,
): Promise<Map<string, FeedRealmSummary>> {
  const uniqueIds = [...new Set(realmUnitIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const languages = resolveEffectiveReadLanguageCandidates({
    languages: query.languages,
    appLocale: query.appLocale,
  });
  const entries = await Promise.all(
    uniqueIds.map(async (unitId) => {
      try {
        const realm = await realmService.getByUnitId(unitId, null, {
          languages,
          appLocale: query.appLocale,
        });
        return [
          unitId,
          {
            unitId: realm.unitId,
            slug: realm.slug ?? null,
            title: realm.title ?? null,
          },
        ] as const;
      } catch {
        return null;
      }
    }),
  );
  return new Map(
    entries.filter((entry): entry is NonNullable<typeof entry> =>
      Boolean(entry),
    ),
  );
}

async function hydrateTargetUnitSummaries(
  targetUnitIds: string[],
  query: FeedQuery,
): Promise<Map<string, FeedWorkSummary>> {
  const uniqueIds = [...new Set(targetUnitIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const languages = resolveEffectiveReadLanguageCandidates({
    languages: query.languages,
    appLocale: query.appLocale,
  });
  const [units, translations] = await Promise.all([
    db
      .select({ id: Unit.id, type: Unit.type })
      .from(Unit)
      .where(inArray(Unit.id, uniqueIds)),
    db
      .select({
        unitId: UnitTranslation.unitId,
        language: UnitTranslation.language,
        title: UnitTranslation.title,
      })
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, uniqueIds)),
  ]);
  const unitTypeMap = new Map(units.map((u) => [u.id, u.type]));
  const titlesByUnit = new Map<string, string | null>();
  for (const unitId of uniqueIds) {
    const unitTranslations = translations.filter((t) => t.unitId === unitId);
    const preferred =
      languages.length > 0
        ? unitTranslations.find((t) => languages.includes(t.language))
        : undefined;
    titlesByUnit.set(
      unitId,
      preferred?.title ?? unitTranslations[0]?.title ?? null,
    );
  }
  const result = new Map<string, FeedWorkSummary>();
  for (const unitId of uniqueIds) {
    result.set(unitId, {
      unitId,
      kind: unitTypeMap.get(unitId)?.toLowerCase() ?? null,
      title: titlesByUnit.get(unitId) ?? null,
    });
  }
  return result;
}

async function mapPostsToFeedRows(
  posts: FeedPostSource[],
  query: FeedQuery,
  input: { realmUnitId?: string | null; reason?: string | null } = {},
): Promise<FeedPostRow[]> {
  const dtos = await mapPostsToDTOs(posts, query);
  const realmIds = dtos
    .map((post) => realmIdForFeedPost(post, input.realmUnitId))
    .filter((unitId): unitId is string => Boolean(unitId));
  const targetUnitIds = dtos
    .filter((post) => !hasEmbeddedTargetSummary(post))
    .map((post) => post.targetUnitId)
    .filter((unitId): unitId is string => Boolean(unitId));
  const [realms, targetUnits] = await Promise.all([
    hydrateRealmSummaries(realmIds, query),
    hydrateTargetUnitSummaries(targetUnitIds, query),
  ]);
  return dtos.map((post) => {
    const realmUnitId = realmIdForFeedPost(post, input.realmUnitId);
    return mapPostToFeedRow(post, {
      realmUnitId,
      realm: realmUnitId ? (realms.get(realmUnitId) ?? null) : null,
      reason: input.reason,
      resolvedTargetUnit: post.targetUnitId
        ? (targetUnits.get(post.targetUnitId) ?? null)
        : null,
    });
  });
}

export interface FeedListOptions {
  isAdmin?: boolean;
  viewerUserId?: string | null;
}

export class FeedService {
  async list(
    query: FeedQuery = {},
    options?: FeedListOptions,
  ): Promise<FeedResponse> {
    const scope = query.scope ?? (query.realmUnitId ? "realm" : "home");
    const sort = normalizeSort(query.sort);
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? 20), FEED_LIMIT_CAP),
    );
    const postQuery = postQueryForFeed(query, limit);

    if (scope === "realm") {
      if (!query.realmUnitId) {
        throw new AppError(400, "realmUnitId is required for realm feed");
      }
      const posts = await postService.byRealm(
        query.realmUnitId,
        postQuery,
        options,
      );
      return withSliceCursor(
        feedResponse({
          scope,
          sort,
          rows: await mapPostsToFeedRows(posts.posts, query, {
            realmUnitId: query.realmUnitId,
            reason: "realm-feed-activity",
          }),
        }),
        limit,
      );
    }

    if (scope === "zone") {
      if (!query.zoneUnitId) {
        throw new AppError(400, "zoneUnitId is required for zone feed");
      }
      const zone = await zoneService.getByUnitId(query.zoneUnitId);
      if (!zone) {
        throw new AppError(404, "Zone not found");
      }
      const posts = await postService.list(
        withZoneFeedFilters(postQuery, zone.boundary),
        options,
      );
      return withSliceCursor(
        feedResponse({
          scope,
          sort,
          rows: await mapPostsToFeedRows(posts.posts, query, {
            reason: "zone-feed-activity",
          }),
        }),
        limit,
      );
    }

    if (scope === "library") {
      if (query.libraryKind && query.libraryKind !== "book") {
        throw new AppError(400, "Only book library feeds are supported in v1");
      }
      const targetedLibraryFeed = Boolean(
        query.targetUnitId || query.variantUnitId,
      );
      const posts = await postService.list(
        {
          ...postQuery,
          ...(targetedLibraryFeed ? {} : { kind: PostKind.REVIEW }),
        },
        options,
      );
      return withSliceCursor(
        feedResponse({
          scope,
          sort,
          rows: await mapPostsToFeedRows(posts.posts, query, {
            reason: targetedLibraryFeed
              ? "book-library-activity"
              : "book-library-review",
          }),
        }),
        limit,
      );
    }

    const filterType = query.filterType ?? "all";
    const postKind = postKindForFeedFilter(filterType);
    if (postKind) {
      const posts = await postService.list(
        {
          ...postQuery,
          kind: postKind,
        },
        options,
      );
      return withSliceCursor(
        feedResponse({
          scope,
          sort,
          rows: await mapPostsToFeedRows(posts.posts, query, {
            reason:
              postKind === PostKind.REVIEW
                ? "global-review-rank"
                : "global-post-rank",
          }),
        }),
        limit,
      );
    }

    const unitType = unitTypeForFeedFilter(filterType);
    if (unitType) {
      const unitRows = await this.homeUnitRows(query, unitType, limit);
      const response = feedResponse({
        scope,
        sort,
        rows: unitRows.rows,
      });
      return unitRows.hasMore ? response : { ...response, nextCursor: null };
    }

    const [posts, recommendations] = await Promise.all([
      postService.list(postQuery, options),
      query.cursor ? Promise.resolve([]) : this.homeRecommendationRows(),
    ]);
    const postRows = await mapPostsToFeedRows(posts.posts, query, {
      reason: "global-post-rank",
    });
    return withSliceCursor(
      feedResponse({
        scope,
        sort,
        rows: scheduleFeedRows(postRows, recommendations),
      }),
      limit,
    );
  }

  private async homeUnitRows(
    query: FeedQuery,
    unitType: FeedUnitRow["unit"]["type"],
    limit: number,
  ): Promise<{ rows: FeedUnitRow[]; hasMore: boolean }> {
    const cursorCreatedAt = unitCursorForFeed(query.cursor);
    const conditions = [
      eq(Unit.type, unitType),
      eq(Unit.status, "PUBLISHED"),
      eq(Unit.visibility, "PUBLIC"),
      ...(cursorCreatedAt ? [lt(Unit.createdAt, cursorCreatedAt)] : []),
    ];
    const rows = await db
      .select({
        unitId: Unit.id,
        type: Unit.type,
        slug: Unit.slug,
        extra: Unit.extra,
        createdAt: Unit.createdAt,
      })
      .from(Unit)
      .where(and(...conditions))
      .orderBy(desc(Unit.createdAt))
      .limit(limit + 1);
    const visibleRows = rows.slice(0, limit);
    if (visibleRows.length === 0) {
      return { rows: [], hasMore: false };
    }
    const translations = await db
      .select({
        unitId: UnitTranslation.unitId,
        language: UnitTranslation.language,
        title: UnitTranslation.title,
        summary: UnitTranslation.summary,
        description: UnitTranslation.description,
      })
      .from(UnitTranslation)
      .where(
        inArray(
          UnitTranslation.unitId,
          visibleRows.map((row) => row.unitId),
        ),
      );
    const languages = resolveEffectiveReadLanguageCandidates({
      languages: query.languages,
      appLocale: query.appLocale,
    });
    const translationsByUnit = new Map<string, typeof translations>();
    for (const translation of translations) {
      const current = translationsByUnit.get(translation.unitId) ?? [];
      current.push(translation);
      translationsByUnit.set(translation.unitId, current);
    }

    return {
      hasMore: rows.length > limit,
      rows: visibleRows.map((row) => {
        const translation = preferredTranslation(
          translationsByUnit.get(row.unitId) ?? [],
          languages,
        );
        const extra = row.extra as { coverUrl?: string | null } | null;
        return mapUnitToFeedRow({
          unitId: row.unitId,
          type: row.type as FeedUnitRow["unit"]["type"],
          slug: row.slug ?? null,
          title: translation?.title ?? null,
          coverUrl: extra?.coverUrl ?? null,
          description:
            translation?.summary ??
            mainMarkdownSource(translation?.description) ??
            null,
          createdAt: row.createdAt.toISOString(),
        });
      }),
    };
  }

  private async homeRecommendationRows(): Promise<FeedRow[]> {
    const [books, shelves] = await Promise.all([
      bookService.list({ limit: RECOMMENDATION_ITEM_LIMIT }),
      shelfService.list({ limit: RECOMMENDATION_ITEM_LIMIT }),
    ]);

    return interleaveRows(
      books.books.map(mapBookToFeedRow),
      shelves.shelves.map(mapShelfToFeedRow),
    );
  }
}

export const feedService = new FeedService();

function interleaveRows(left: FeedRow[], right: FeedRow[]): FeedRow[] {
  const rows: FeedRow[] = [];
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    if (left[index]) rows.push(left[index]);
    if (right[index]) rows.push(right[index]);
  }
  return rows;
}
