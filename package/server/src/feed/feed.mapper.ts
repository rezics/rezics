import type {
  FeedCursor,
  FeedBookRow,
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

function dateCursorValue(value: Date | string | undefined): string | undefined {
  return typeof value === "string" ? value : value?.toISOString();
}

export function cursorForFeedRows(rows: FeedRow[]): FeedCursor | null {
  const cursorRows = rows.filter(
    (
      row,
    ): row is
      | (FeedPostRow & { post: CursorPost })
      | FeedUnitRow
      | FeedBookRow =>
      row.type === "post" || row.type === "unit" || row.type === "book",
  ) as Array<(FeedPostRow & { post: CursorPost }) | FeedUnitRow | FeedBookRow>;
  const last =
    cursorRows
      .filter(
        (row): row is (FeedPostRow & { post: CursorPost }) | FeedUnitRow =>
          row.type === "post" || row.type === "unit",
      )
      .at(-1) ?? cursorRows.at(-1);
  if (!last) return null;
  if (last.type === "unit") {
    return {
      rowId: last.rowId,
      createdAt: dateCursorValue(last.unit.createdAt),
    };
  }
  if (last.type === "book") {
    return {
      rowId: last.rowId,
      createdAt: dateCursorValue(last.book.createdAt),
    };
  }
  return {
    rowId: last.rowId,
    ...(last.post.feedSortValue !== undefined &&
    last.post.feedSortValue !== null
      ? { sortValue: last.post.feedSortValue }
      : {}),
    createdAt: dateCursorValue(last.post.createdAt),
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
