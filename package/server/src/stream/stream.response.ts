import type {
  StreamCursor,
  StreamBookRow,
  StreamPostRow,
  StreamResponse,
  StreamRow,
  StreamScope,
  StreamSort,
  StreamUnitRow,
  PostDTO,
} from "@rezics/contract";
import {
  mapPostToStreamRow as mapPostToStreamEnvelopeRow,
  mapUnitToStreamRow as mapUnitToStreamEnvelopeRow,
} from "./stream.mapper";

type CursorPost = PostDTO & {
  /**
   * Internal cursor value produced by the selected stream source.
   * 由所选 stream 来源生成的内部游标值。
   */
  streamSortValue?: number | string | null;
};

export const mapPostToStreamRow = mapPostToStreamEnvelopeRow;

export const mapUnitToStreamRow = (
  unit: StreamUnitRow["unit"],
): StreamUnitRow => mapUnitToStreamEnvelopeRow(unit, "home-unit-stream");

function dateCursorValue(value: Date | string | undefined): string | undefined {
  return typeof value === "string" ? value : value?.toISOString();
}

export function cursorForStreamRows(rows: StreamRow[]): StreamCursor | null {
  const cursorRows = rows.filter(
    (
      row,
    ): row is
      | (StreamPostRow & { post: CursorPost })
      | StreamUnitRow
      | StreamBookRow =>
      row.type === "post" || row.type === "unit" || row.type === "book",
  ) as Array<
    (StreamPostRow & { post: CursorPost }) | StreamUnitRow | StreamBookRow
  >;
  const last =
    cursorRows
      .filter(
        (row): row is (StreamPostRow & { post: CursorPost }) | StreamUnitRow =>
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
    ...(last.post.streamSortValue !== undefined &&
    last.post.streamSortValue !== null
      ? { sortValue: last.post.streamSortValue }
      : {}),
    createdAt: dateCursorValue(last.post.createdAt),
  };
}

export function streamResponse(input: {
  scope: StreamScope;
  sort: StreamSort;
  rows: StreamRow[];
}): StreamResponse {
  return {
    scope: input.scope,
    sort: input.sort,
    rows: input.rows,
    nextCursor: cursorForStreamRows(input.rows),
  };
}
