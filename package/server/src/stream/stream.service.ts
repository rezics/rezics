import type {
  ContentDoc,
  StreamFilterType,
  StreamPostRow,
  StreamQuery,
  StreamResponse,
  StreamRow,
  StreamSort,
  StreamUnitRow,
  PostDTO,
  PostKind as PostKindValue,
  PostListQuery,
  UnitType,
  ZoneBoundary,
} from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { type BookWithRelations, bookService, mapBookToDTO } from "@/book";
import { db } from "@/db";
import { postService } from "@/post";
import { mapPostToDTO } from "@/post/post.mapper";
import { shelfService } from "@/shelf";
import {
  type EffectiveReadLanguageInput,
  resolveEffectiveReadLanguageCandidates,
} from "@/unit/language-resolution";
import { hydrateVariantContextSummaries } from "@/unit/variant-context";
import { AppError } from "@/utils/errors";
import { zoneService } from "@/zone";
import { UnitTranslation } from "../db/schema/translation";
import { Unit } from "../db/schema/unit";
import { mapBookToStreamRow, mapShelfToStreamRow } from "./stream.mapper";
import {
  streamResponse,
  mapPostToStreamRow,
  mapUnitToStreamRow,
} from "./stream.response";

const STREAM_LIMIT_CAP = 50;
const RECOMMENDATION_ITEM_LIMIT = 8;
const FIRST_RECOMMENDATION_AFTER = 4;
const RECOMMENDATION_SPACING = 6;

function normalizeSort(sort: StreamQuery["sort"]): StreamSort {
  return sort ?? "best";
}

function postSortForStream(sort: StreamSort): PostListQuery["sort"] {
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

function postCursorForStream(
  cursor: StreamQuery["cursor"],
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

function postQueryForStream(query: StreamQuery, limit: number): PostListQuery {
  return {
    sort: postSortForStream(normalizeSort(query.sort)),
    cursor: postCursorForStream(query.cursor),
    limit,
    ...(query.targetUnitId ? { targetUnitId: query.targetUnitId } : {}),
    ...(query.variantUnitId ? { variantUnitId: query.variantUnitId } : {}),
    ...(query.languages ? { languages: query.languages as string } : {}),
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

function withZoneStreamFilters(
  base: PostListQuery,
  boundaryEnvelope: ZoneBoundary,
): PostListQuery {
  // Zone stream is post-backed in this service; only PostListQuery-native
  // filters from the zone boundary are applied here. Content-only filters
  // such as type/rating belong to the meili query-section path.
  // 专区 stream 在本服务中基于帖子；这里只应用专区边界中 PostListQuery
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

function countPostRows(rows: StreamRow[]): number {
  return rows.filter((row) => row.type === "post").length;
}

function withSliceCursor(
  response: StreamResponse,
  limit: number,
): StreamResponse {
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
} as const satisfies Partial<Record<StreamFilterType, UnitType>>;

function unitTypeForStreamFilter(
  filterType: StreamFilterType,
): UnitType | null {
  return (
    UNIT_FILTER_TYPES[filterType as keyof typeof UNIT_FILTER_TYPES] ?? null
  );
}

function postKindForStreamFilter(
  filterType: StreamFilterType,
): PostKindValue | null {
  if (filterType === "post") return PostKind.POST;
  if (filterType === "review") return PostKind.REVIEW;
  return null;
}

function unitCursorForStream(cursor: StreamQuery["cursor"]): Date | null {
  if (!cursor?.rowId || !cursor.createdAt) return null;
  const [type] = cursor.rowId.split(":");
  if (type !== "unit" && type !== "book") return null;
  const createdAt = new Date(cursor.createdAt);
  return Number.isNaN(createdAt.getTime()) ? null : createdAt;
}

function bookReadLanguageForStream(
  query: StreamQuery,
): EffectiveReadLanguageInput {
  return {
    languages: resolveEffectiveReadLanguageCandidates({
      languages: query.languages,
      appLocale: query.appLocale,
    }),
    appLocale: query.appLocale,
  };
}

type BookServiceListOptions = NonNullable<
  Parameters<typeof bookService.list>[0]
>;
type ShelfServiceListOptions = NonNullable<
  Parameters<typeof shelfService.list>[0]
>;

function bookListLanguageOptions(
  query: StreamQuery,
): Pick<BookServiceListOptions, "appLocale" | "languages"> {
  const readLanguage = bookReadLanguageForStream(query);
  return {
    ...(readLanguage.languages?.length
      ? { languages: readLanguage.languages.join(",") }
      : {}),
    ...(readLanguage.appLocale
      ? {
          appLocale:
            readLanguage.appLocale as BookServiceListOptions["appLocale"],
        }
      : {}),
  };
}

function shelfListLanguageOptions(
  query: StreamQuery,
): Pick<ShelfServiceListOptions, "appLocale" | "languages"> {
  const readLanguage = bookReadLanguageForStream(query);
  return {
    ...(readLanguage.languages?.length
      ? { languages: readLanguage.languages.join(",") }
      : {}),
    ...(readLanguage.appLocale
      ? {
          appLocale:
            readLanguage.appLocale as ShelfServiceListOptions["appLocale"],
        }
      : {}),
  };
}

function mapBookSourceToStreamRow(
  book: BookWithRelations,
  query: StreamQuery,
  reason: string,
) {
  return mapBookToStreamRow(
    mapBookToDTO(book, bookReadLanguageForStream(query)),
    reason,
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

function contentDocOrNull(value: unknown): ContentDoc | null {
  return value && typeof value === "object" ? (value as ContentDoc) : null;
}

function scheduleStreamRows(
  postRows: StreamRow[],
  recommendationRows: StreamRow[],
): StreamRow[] {
  if (postRows.length === 0) {
    return recommendationRows;
  }
  if (recommendationRows.length === 0) {
    return postRows;
  }

  const out: StreamRow[] = [];
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

type StreamPostSource = Parameters<typeof mapPostToDTO>[0] & {
  streamSortValue?: number | string | null;
};

type StreamPostDTO = PostDTO & {
  streamSortValue?: number | string | null;
};

async function mapPostsToDTOs(
  posts: StreamPostSource[],
  query: StreamQuery,
): Promise<StreamPostDTO[]> {
  const variantContexts = await hydrateVariantContextSummaries(posts);
  const languages = resolveEffectiveReadLanguageCandidates({
    languages: query.languages,
    appLocale: query.appLocale,
  });
  return posts.map((post) => ({
    ...mapPostToDTO(post, variantContexts, languages),
    streamSortValue: post.streamSortValue ?? null,
  }));
}

async function mapPostsToStreamRows(
  posts: StreamPostSource[],
  query: StreamQuery,
  input: { realmUnitId?: string | null; reason?: string | null } = {},
): Promise<StreamPostRow[]> {
  const dtos = await mapPostsToDTOs(posts, query);
  return dtos.map((post) =>
    mapPostToStreamRow(post, {
      realmUnitId: input.realmUnitId ?? post.realmUnitId ?? null,
      reason: input.reason,
    }),
  );
}

export interface StreamListOptions {
  isAdmin?: boolean;
  viewerUserId?: string | null;
}

export class StreamService {
  async list(
    query: StreamQuery = {},
    options?: StreamListOptions,
  ): Promise<StreamResponse> {
    const scope = query.scope ?? (query.realmUnitId ? "realm" : "home");
    const sort = normalizeSort(query.sort);
    const limit = Math.max(
      1,
      Math.min(Number(query.limit ?? 20), STREAM_LIMIT_CAP),
    );
    const postQuery = postQueryForStream(query, limit);

    if (scope === "realm") {
      if (!query.realmUnitId) {
        throw new AppError(400, "realmUnitId is required for realm stream");
      }
      const posts = await postService.byRealm(
        query.realmUnitId,
        postQuery,
        options,
      );
      return withSliceCursor(
        streamResponse({
          scope,
          sort,
          rows: await mapPostsToStreamRows(posts.posts, query, {
            realmUnitId: query.realmUnitId,
            reason: "realm-stream-activity",
          }),
        }),
        limit,
      );
    }

    if (scope === "zone") {
      if (!query.zoneUnitId) {
        throw new AppError(400, "zoneUnitId is required for zone stream");
      }
      const zone = await zoneService.getByUnitId(query.zoneUnitId);
      if (!zone) {
        throw new AppError(404, "Zone not found");
      }
      const posts = await postService.list(
        withZoneStreamFilters(postQuery, zone.boundary),
        options,
      );
      return withSliceCursor(
        streamResponse({
          scope,
          sort,
          rows: await mapPostsToStreamRows(posts.posts, query, {
            reason: "zone-stream-activity",
          }),
        }),
        limit,
      );
    }

    if (scope === "library") {
      if (query.libraryKind && query.libraryKind !== "book") {
        throw new AppError(
          400,
          "Only book library streams are supported in v1",
        );
      }
      const targetedLibraryStream = Boolean(
        query.targetUnitId || query.variantUnitId,
      );
      const posts = await postService.list(
        {
          ...postQuery,
          ...(targetedLibraryStream ? {} : { kind: PostKind.REVIEW }),
        },
        options,
      );
      return withSliceCursor(
        streamResponse({
          scope,
          sort,
          rows: await mapPostsToStreamRows(posts.posts, query, {
            reason: targetedLibraryStream
              ? "book-library-activity"
              : "book-library-review",
          }),
        }),
        limit,
      );
    }

    const filterType = query.filterType ?? "all";
    const postKind = postKindForStreamFilter(filterType);
    if (postKind) {
      const posts = await postService.list(
        {
          ...postQuery,
          kind: postKind,
        },
        options,
      );
      return withSliceCursor(
        streamResponse({
          scope,
          sort,
          rows: await mapPostsToStreamRows(posts.posts, query, {
            reason:
              postKind === PostKind.REVIEW
                ? "global-review-rank"
                : "global-post-rank",
          }),
        }),
        limit,
      );
    }

    const unitType = unitTypeForStreamFilter(filterType);
    if (unitType) {
      if (unitType === "BOOK") {
        const bookRows = await this.homeBookRows(query, limit);
        const response = streamResponse({
          scope,
          sort,
          rows: bookRows.rows,
        });
        return bookRows.hasMore ? response : { ...response, nextCursor: null };
      }
      const unitRows = await this.homeUnitRows(query, unitType, limit);
      const response = streamResponse({
        scope,
        sort,
        rows: unitRows.rows,
      });
      return unitRows.hasMore ? response : { ...response, nextCursor: null };
    }

    const [posts, recommendations] = await Promise.all([
      postService.list(postQuery, options),
      query.cursor ? Promise.resolve([]) : this.homeRecommendationRows(query),
    ]);
    const postRows = await mapPostsToStreamRows(posts.posts, query, {
      reason: "global-post-rank",
    });
    return withSliceCursor(
      streamResponse({
        scope,
        sort,
        rows: scheduleStreamRows(postRows, recommendations),
      }),
      limit,
    );
  }

  private async homeBookRows(
    query: StreamQuery,
    limit: number,
  ): Promise<{ rows: StreamRow[]; hasMore: boolean }> {
    const cursorCreatedAt = unitCursorForStream(query.cursor);
    const rows = await db
      .select({
        unitId: Unit.id,
        createdAt: Unit.createdAt,
      })
      .from(Unit)
      .where(
        and(
          eq(Unit.type, "BOOK"),
          eq(Unit.status, "PUBLISHED"),
          eq(Unit.visibility, "PUBLIC"),
          ...(cursorCreatedAt ? [lt(Unit.createdAt, cursorCreatedAt)] : []),
        ),
      )
      .orderBy(desc(Unit.createdAt))
      .limit(limit + 1);
    const visibleRows = rows.slice(0, limit);
    if (visibleRows.length === 0) {
      return { rows: [], hasMore: false };
    }

    const books = await bookService.list({
      ids: visibleRows.map((row) => row.unitId).join(","),
      limit: visibleRows.length,
      ...bookListLanguageOptions(query),
    });
    const booksById = new Map(books.books.map((book) => [book.unitId, book]));
    return {
      hasMore: rows.length > limit,
      rows: visibleRows.flatMap((row) => {
        const book = booksById.get(row.unitId);
        return book
          ? [mapBookSourceToStreamRow(book, query, "home-book-stream")]
          : [];
      }),
    };
  }

  private async homeUnitRows(
    query: StreamQuery,
    unitType: UnitType,
    limit: number,
  ): Promise<{ rows: StreamUnitRow[]; hasMore: boolean }> {
    const cursorCreatedAt = unitCursorForStream(query.cursor);
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
        return mapUnitToStreamRow({
          id: row.unitId,
          type: row.type,
          slug: row.slug ?? null,
          title: translation?.title ?? null,
          summary: translation?.summary ?? null,
          description: contentDocOrNull(translation?.description),
          extra: row.extra as Record<string, unknown> | null,
          createdAt: row.createdAt.toISOString(),
        });
      }),
    };
  }

  private async homeRecommendationRows(
    query: StreamQuery,
  ): Promise<StreamRow[]> {
    const [books, shelves] = await Promise.all([
      bookService.list({
        limit: RECOMMENDATION_ITEM_LIMIT,
        ...bookListLanguageOptions(query),
      }),
      shelfService.list({
        limit: RECOMMENDATION_ITEM_LIMIT,
        ...shelfListLanguageOptions(query),
      }),
    ]);
    return interleaveRows(
      books.books.map((book) =>
        mapBookSourceToStreamRow(book, query, "home-book-recommendation"),
      ),
      shelves.shelves.map((shelf) =>
        mapShelfToStreamRow(shelf, "home-shelf-recommendation"),
      ),
    );
  }
}

export const streamService = new StreamService();

function interleaveRows(left: StreamRow[], right: StreamRow[]): StreamRow[] {
  const rows: StreamRow[] = [];
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    const leftRow = left[index];
    if (leftRow) rows.push(leftRow);
    const rightRow = right[index];
    if (rightRow) rows.push(rightRow);
  }
  return rows;
}
