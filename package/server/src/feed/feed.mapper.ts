import type {
  FeedCursor,
  FeedPostRow,
  FeedResponse,
  FeedRow,
  FeedScope,
  FeedSort,
  FeedUnitRow,
  PostDTO,
} from "@rezics/contract";
import { mapPostToStreamRow, mapUnitToStreamRow } from "../stream";

type CursorPost = PostDTO & {
  /**
   * Internal cursor value produced by the selected feed source.
   * 由所选 feed 来源生成的内部游标值。
   */
  feedSortValue?: number | string | null;
};

export const mapPostToFeedRow = mapPostToStreamRow;

export const mapUnitToFeedRow = (unit: FeedUnitRow["unit"]): FeedUnitRow =>
  mapUnitToStreamRow(unit, "home-unit-feed");

export function cursorForFeedRows(rows: FeedRow[]): FeedCursor | null {
  const last = rows
    .filter(
      (row): row is (FeedPostRow & { post: CursorPost }) | FeedUnitRow =>
        row.type === "post" || row.type === "unit",
    )
    .at(-1) as (FeedPostRow & { post: CursorPost }) | FeedUnitRow | undefined;
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
