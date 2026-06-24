import { describe, expect, test } from "bun:test";
import type { StreamRow } from "@rezics/contract";
import { groupPostReactionTargets } from "../models/streamReactionHydration";

function postRow(unitId: string, contextUnitId: string | null): StreamRow {
  return {
    type: "post",
    rowId: `post:${unitId}`,
    post: { unitId },
    href: `/post/${unitId}`,
    contextUnitId,
  } as StreamRow;
}

describe("groupPostReactionTargets", () => {
  test("groups post reaction targets by stream context", () => {
    const groups = groupPostReactionTargets([
      postRow("post-1", "realm-1"),
      postRow("post-2", null),
      postRow("post-3", "realm-1"),
      {
        type: "book",
        rowId: "book:book-1",
        book: { unitId: "book-1" },
        href: "/book/book-1",
      } as StreamRow,
    ]);

    expect(groups).toEqual([
      { contextUnitId: "realm-1", targetIds: ["post-1", "post-3"] },
      { contextUnitId: null, targetIds: ["post-2"] },
    ]);
  });
});
