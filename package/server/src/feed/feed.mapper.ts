import type {
  FeedContentRow,
  FeedCursor,
  FeedRow,
  FeedResponse,
  FeedScope,
  FeedSort,
  FeedWorkSummary,
  PostDTO,
} from "@rezics/contract";

type FeedPost = PostDTO & {
  /** Internal cursor value produced by the selected feed source. */
  feedSortValue?: number | string | null;
};

export function postHrefForFeed(post: PostDTO, realmUnitId?: string | null) {
  if (realmUnitId) return `/realm/${realmUnitId}/post/${post.unitId}`;
  return `/post/${post.unitId}`;
}

function targetUnitForPost(post: PostDTO): FeedWorkSummary | null {
  if (!post.targetUnitId) return null;
  return {
    unitId: post.targetUnitId,
    title: post.extra?.book?.title ?? null,
  };
}

export function mapPostToFeedRow(
  post: PostDTO,
  input: {
    realm?: FeedContentRow["realm"];
    realmUnitId?: string | null;
    reason?: string | null;
  } = {},
): FeedContentRow {
  return {
    type: "content",
    rowId: `post:${post.unitId}`,
    post,
    href: postHrefForFeed(post, input.realmUnitId),
    realm: input.realm ?? null,
    targetUnit: targetUnitForPost(post),
    variantContext: post.variantContext ?? null,
    recommendationReason: input.reason ?? null,
  };
}

export function cursorForFeedRows(rows: FeedRow[]): FeedCursor | null {
  const last = rows
    .filter((row): row is FeedContentRow => row.type === "content")
    .at(-1) as (FeedContentRow & { post: FeedPost }) | undefined;
  if (!last) return null;
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
