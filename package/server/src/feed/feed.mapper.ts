import type {
  FeedCursor,
  FeedPostRow,
  FeedResponse,
  FeedRow,
  FeedScope,
  FeedSort,
  FeedUnitRow,
  FeedWorkSummary,
  PostDTO,
} from "@rezics/contract";

type FeedPost = PostDTO & {
  /**
   * Internal cursor value produced by the selected feed source.
   * 由所选 feed 来源生成的内部游标值。
   */
  feedSortValue?: number | string | null;
};

export function postHrefForFeed(post: PostDTO, realmUnitId?: string | null) {
  if (realmUnitId) return `/realm/${realmUnitId}/post/${post.unitId}`;
  return `/post/${post.unitId}`;
}

function targetUnitForPost(
  post: PostDTO,
  resolved?: FeedWorkSummary | null,
): FeedWorkSummary | null {
  if (!post.targetUnitId) return null;
  if (resolved) return resolved;
  return {
    unitId: post.targetUnitId,
    title: post.extra?.book?.title ?? null,
  };
}

export function mapPostToFeedRow(
  post: PostDTO,
  input: {
    realm?: FeedPostRow["realm"];
    realmUnitId?: string | null;
    reason?: string | null;
    resolvedTargetUnit?: FeedWorkSummary | null;
  } = {},
): FeedPostRow {
  return {
    type: "post",
    rowId: `post:${post.unitId}`,
    post,
    href: postHrefForFeed(post, input.realmUnitId),
    realm: input.realm ?? null,
    targetUnit: targetUnitForPost(post, input.resolvedTargetUnit),
    variantContext: post.variantContext ?? null,
    recommendationReason: input.reason ?? null,
  };
}

export function mapUnitToFeedRow(unit: FeedUnitRow["unit"]): FeedUnitRow {
  return {
    type: "unit",
    rowId: `unit:${unit.unitId}`,
    unit,
    href: hrefForFeedUnit(unit),
    recommendationReason: "home-unit-feed",
  };
}

function hrefForFeedUnit(unit: FeedUnitRow["unit"]): string {
  if (unit.type === "BOOK") return `/book/${unit.unitId}`;
  if (unit.type === "REALM") {
    return unit.slug ? `/r/${unit.slug}` : `/realm/${unit.unitId}`;
  }
  if (unit.type === "ZONE") {
    return unit.slug ? `/z/${unit.slug}` : `/zone/${unit.unitId}/search`;
  }
  return `/unit/${unit.unitId}`;
}

export function cursorForFeedRows(rows: FeedRow[]): FeedCursor | null {
  const last = rows
    .filter(
      (row): row is (FeedPostRow & { post: FeedPost }) | FeedUnitRow =>
        row.type === "post" || row.type === "unit",
    )
    .at(-1) as (FeedPostRow & { post: FeedPost }) | FeedUnitRow | undefined;
  if (!last) return null;
  if (last.type === "unit") {
    return {
      rowId: last.rowId,
      createdAt:
        typeof last.unit.createdAt === "string"
          ? last.unit.createdAt
          : last.unit.createdAt?.toISOString(),
    };
  }
  return {
    rowId: last.rowId,
    ...(last.post.feedSortValue !== undefined &&
    last.post.feedSortValue !== null
      ? { sortValue: last.post.feedSortValue }
      : {}),
    createdAt:
      typeof last.post.createdAt === "string"
        ? last.post.createdAt
        : last.post.createdAt?.toISOString(),
  };
}

export function feedResponse(input: {
  scope: FeedScope;
  sort: FeedSort;
  rows: FeedRow[];
}): FeedResponse {
  return {
    scope: input.scope,
    sort: input.sort,
    rows: input.rows,
    nextCursor: cursorForFeedRows(input.rows),
  };
}
