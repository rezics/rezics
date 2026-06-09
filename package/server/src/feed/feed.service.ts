import type {
  FeedCarouselRow,
  FeedContentRow,
  FeedQuery,
  FeedResponse,
  FeedRow,
  FeedSort,
  FeedWorkSummary,
  PostDTO,
  PostListQuery,
  ShelfSummaryDTO,
  ZoneFilters,
} from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { bookService } from "@/book";
import { postService } from "@/post";
import { mapPostToDTO } from "@/post/post.mapper";
import { realmService } from "@/realm";
import { shelfService } from "@/shelf";
import { resolveEffectiveReadLanguageCandidates } from "@/unit/language-resolution";
import { hydrateVariantContextSummaries } from "@/unit/variant-context";
import { AppError } from "@/utils/errors";
import { zoneService } from "@/zone";
import { feedResponse, mapPostToFeedRow } from "./feed.mapper";

const FEED_LIMIT_CAP = 50;
const CAROUSEL_ITEM_LIMIT = 8;
const FIRST_CAROUSEL_AFTER = 4;
const CAROUSEL_SPACING = 6;

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

function tagIdsFromZoneFilters(filters: ZoneFilters | null | undefined) {
  return uniqueStrings((filters?.tags ?? []).map((tag) => tag.unitId));
}

function withZoneFeedFilters(
  base: PostListQuery,
  filters: ZoneFilters | null | undefined,
): PostListQuery {
  if (!filters) return base;
  const zoneTagIds = tagIdsFromZoneFilters(filters);
  // Zone feed is post-backed in this service; only PostListQuery-native filters
  // are applied here. Content-only filters such as type/rating/license belong
  // to a future mixed content feed source.
  return {
    ...base,
    ...(filters.realmUnitId || filters.realmId
      ? { realmUnitId: filters.realmUnitId ?? filters.realmId }
      : {}),
    ...(filters.postKind ? { kind: filters.postKind } : {}),
    ...(filters.languages?.length ? { languages: filters.languages } : {}),
    ...(zoneTagIds.length
      ? { tagIds: uniqueStrings([...(base.tagIds ?? []), ...zoneTagIds]) }
      : {}),
  };
}

function countContentRows(rows: FeedRow[]): number {
  return rows.filter((row) => row.type === "content").length;
}

function withSliceCursor(response: FeedResponse, limit: number): FeedResponse {
  if (countContentRows(response.rows) < limit) {
    return { ...response, nextCursor: null };
  }
  return response;
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

function mapBookToWorkSummary(book: unknown): FeedWorkSummary {
  const source = book as {
    unitId?: string;
    kind?: string | null;
    title?: string | null;
    coverUrl?: string | null;
    unit?: { translations?: Array<{ title?: string | null }> };
  };
  return {
    unitId: source.unitId ?? "",
    kind: source.kind ?? "book",
    title: titleFromTranslations(source),
    coverUrl: source.coverUrl ?? null,
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

function scheduleFeedRows(
  contentRows: FeedRow[],
  carouselRows: FeedCarouselRow[],
): FeedRow[] {
  if (contentRows.length === 0 || carouselRows.length === 0) {
    return contentRows;
  }

  const out: FeedRow[] = [];
  let nextCarouselAt = FIRST_CAROUSEL_AFTER;
  let carouselIndex = 0;

  for (let index = 0; index < contentRows.length; index += 1) {
    out.push(contentRows[index]!);
    const contentPosition = index + 1;
    if (
      carouselIndex < carouselRows.length &&
      contentPosition >= nextCarouselAt &&
      out.at(-1)?.type !== "carousel"
    ) {
      out.push(carouselRows[carouselIndex]!);
      carouselIndex += 1;
      nextCarouselAt = contentPosition + CAROUSEL_SPACING;
    }
  }

  return out;
}

type FeedPostSource = Parameters<typeof mapPostToDTO>[0] & {
  feedSortValue?: number | string | null;
};

type FeedPostDTO = PostDTO & {
  feedSortValue?: number | string | null;
};

type FeedRealmSummary = NonNullable<FeedContentRow["realm"]>;

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

async function mapPostsToFeedRows(
  posts: FeedPostSource[],
  query: FeedQuery,
  input: { realmUnitId?: string | null; reason?: string | null } = {},
): Promise<FeedContentRow[]> {
  const dtos = await mapPostsToDTOs(posts, query);
  const realmIds = dtos
    .map((post) => realmIdForFeedPost(post, input.realmUnitId))
    .filter((unitId): unitId is string => Boolean(unitId));
  const realms = await hydrateRealmSummaries(realmIds, query);
  return dtos.map((post) => {
    const realmUnitId = realmIdForFeedPost(post, input.realmUnitId);
    return mapPostToFeedRow(post, {
      realmUnitId,
      realm: realmUnitId ? (realms.get(realmUnitId) ?? null) : null,
      reason: input.reason,
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
        withZoneFeedFilters(postQuery, zone.filters as ZoneFilters),
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

    const [posts, carousels] = await Promise.all([
      postService.list(postQuery, options),
      query.cursor ? Promise.resolve([]) : this.homeCarouselRows(),
    ]);
    const contentRows = await mapPostsToFeedRows(posts.posts, query, {
      reason: "global-post-rank",
    });
    return withSliceCursor(
      feedResponse({
        scope,
        sort,
        rows: scheduleFeedRows(contentRows, carousels),
      }),
      limit,
    );
  }

  private async homeCarouselRows(): Promise<FeedCarouselRow[]> {
    const [books, shelves] = await Promise.all([
      bookService.list({ limit: CAROUSEL_ITEM_LIMIT }),
      shelfService.list({ limit: CAROUSEL_ITEM_LIMIT }),
    ]);

    const workItems = books.books.map(mapBookToWorkSummary);
    const shelfItems = shelves.shelves.map(mapShelfToSummary);
    const rows: FeedCarouselRow[] = [];
    if (workItems.length >= 2) {
      rows.push({
        type: "carousel",
        rowId: "carousel:home:works",
        carouselKind: "works",
        title: { key: "feed.carousel.works" },
        works: workItems,
      });
    }
    if (shelfItems.length >= 2) {
      rows.push({
        type: "carousel",
        rowId: "carousel:home:shelves",
        carouselKind: "shelves",
        title: { key: "feed.carousel.shelves" },
        shelves: shelfItems,
      });
    }
    return rows;
  }
}

export const feedService = new FeedService();
