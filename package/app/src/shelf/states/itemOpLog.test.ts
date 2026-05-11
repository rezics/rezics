import { describe, expect, test } from "bun:test";
import type {
  ShelfItemBatchAddOp,
  ShelfItemBatchDeleteOp,
  ShelfItemBatchReorderOp,
  ShelfItemBatchSetTagsOp,
} from "@rezics/contract";
import {
  clear,
  clearSucceeded,
  coalesce,
  dirty,
  emptyLog,
  enqueue,
  markFailed,
  pendingCount,
} from "./itemOpLog";

const addOp = (itemRef: string, position = "a0"): ShelfItemBatchAddOp => ({
  op: "add",
  itemRef,
  kind: "post",
  position,
});

const reorderOp = (
  itemRef: string,
  position: string,
): ShelfItemBatchReorderOp => ({
  op: "reorder",
  itemRef,
  position,
});

const deleteOp = (itemRef: string): ShelfItemBatchDeleteOp => ({
  op: "delete",
  itemRef,
});

const setTagsOp = (
  itemRef: string,
  tagIds: string[],
): ShelfItemBatchSetTagsOp => ({
  op: "setTags",
  itemRef,
  tagIds,
});

describe("itemOpLog", () => {
  test("enqueue adds an entry and increments seq", () => {
    const log = enqueue(emptyLog, addOp("u1"));
    expect(log.entries).toHaveLength(1);
    expect(log.nextSeq).toBe(2);
    expect(pendingCount(log)).toBe(1);
    expect(dirty(log)).toBe(true);
  });

  test("add then delete on same ref collapses to no-op", () => {
    let log = emptyLog;
    log = enqueue(log, addOp("u1"));
    log = enqueue(log, deleteOp("u1"));
    expect(log.entries).toHaveLength(0);
    expect(dirty(log)).toBe(false);
  });

  test("two reorders on same ref keep only the latest", () => {
    let log = emptyLog;
    log = enqueue(log, reorderOp("u1", "a1"));
    log = enqueue(log, reorderOp("u1", "a2"));
    expect(log.entries).toHaveLength(1);
    expect((log.entries[0]!.op as ShelfItemBatchReorderOp).position).toBe("a2");
  });

  test("two setTags on same ref keep only the latest", () => {
    let log = emptyLog;
    log = enqueue(log, setTagsOp("u1", ["t1"]));
    log = enqueue(log, setTagsOp("u1", ["t2", "t3"]));
    expect(log.entries).toHaveLength(1);
    expect((log.entries[0]!.op as ShelfItemBatchSetTagsOp).tagIds).toEqual([
      "t2",
      "t3",
    ]);
  });

  test("clear empties live entries", () => {
    let log = enqueue(emptyLog, addOp("u1"));
    log = clear(log);
    expect(log.entries).toHaveLength(0);
  });

  test("markFailed flags an entry; coalesce leaves failed entries alone", () => {
    let log = enqueue(emptyLog, addOp("u1"));
    const id = log.entries[0]!.id;
    log = markFailed(log, id, "server rejected");
    expect(log.entries[0]!.failedReason).toBe("server rejected");

    log = enqueue(log, addOp("u2"));
    expect(log.entries).toHaveLength(2);
    expect(log.entries[0]!.failedReason).toBe("server rejected");
  });

  test("clearSucceeded removes entries by id", () => {
    let log = enqueue(emptyLog, addOp("u1"));
    log = enqueue(log, addOp("u2"));
    const firstId = log.entries[0]!.id;
    log = clearSucceeded(log, new Set([firstId]));
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]!.id).not.toBe(firstId);
  });

  test("idempotent coalesce on already-coalesced log", () => {
    let log = enqueue(emptyLog, addOp("u1"));
    log = enqueue(log, reorderOp("u2", "a3"));
    const before = log.entries;
    const after = coalesce(log).entries;
    expect(after).toEqual(before);
  });
});
