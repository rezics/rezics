import { describe, expect, test } from "bun:test";
import type {
  ShelfItemBatchAddOp,
  ShelfItemBatchAttachOp,
  ShelfItemBatchDeleteOp,
  ShelfItemBatchDetachOp,
  ShelfItemBatchReorderOp,
  ShelfItemBatchReorderToPageOp,
  ShelfItemBatchSetChildrenOp,
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

const addOp = (unitId: string, position = "a0"): ShelfItemBatchAddOp => ({
  op: "add",
  itemType: "unit",
  itemId: unitId,
  kind: "post",
  position,
});

const reorderOp = (
  unitId: string,
  position: string,
): ShelfItemBatchReorderOp => ({
  op: "reorder",
  itemType: "unit",
  itemId: unitId,
  position,
});

const deleteOp = (unitId: string): ShelfItemBatchDeleteOp => ({
  op: "delete",
  itemType: "unit",
  itemId: unitId,
});

const reorderToPageOp = (
  unitId: string,
  toPage: number,
): ShelfItemBatchReorderToPageOp => ({
  op: "reorderToPage",
  itemType: "unit",
  itemId: unitId,
  toPage,
  edge: "first",
});

const attachOp = (
  parentItemId: string,
  childItemId: string,
): ShelfItemBatchAttachOp => ({
  op: "attach",
  parentItemType: "unit",
  parentItemId,
  childItemType: "unit",
  childItemId,
  childKind: "review",
  role: "review",
});

const detachOp = (
  parentItemId: string,
  childItemId: string,
): ShelfItemBatchDetachOp => ({
  op: "detach",
  parentItemType: "unit",
  parentItemId,
  childItemType: "unit",
  childItemId,
  role: "review",
});

const setChildrenOp = (
  parentItemId: string,
  childItemIds: string[],
): ShelfItemBatchSetChildrenOp => ({
  op: "setChildren",
  parentItemType: "unit",
  parentItemId,
  role: "tag",
  childItemType: "unit",
  childItemIds,
});

describe("itemOpLog", () => {
  test("enqueue adds an entry and increments seq", () => {
    const log = enqueue(emptyLog, addOp("u1"));
    expect(log.entries).toHaveLength(1);
    expect(log.nextSeq).toBe(2);
    expect(pendingCount(log)).toBe(1);
    expect(dirty(log)).toBe(true);
  });

  test("add then delete on same unitId collapses to no-op", () => {
    let log = emptyLog;
    log = enqueue(log, addOp("u1"));
    log = enqueue(log, deleteOp("u1"));
    expect(log.entries).toHaveLength(0);
    expect(dirty(log)).toBe(false);
  });

  test("two reorders on same unitId keep only the latest", () => {
    let log = emptyLog;
    log = enqueue(log, reorderOp("u1", "a1"));
    log = enqueue(log, reorderOp("u1", "a2"));
    expect(log.entries).toHaveLength(1);
    expect((log.entries[0]!.op as ShelfItemBatchReorderOp).position).toBe("a2");
  });

  test("reorder variants on same unitId keep only the latest", () => {
    let log = emptyLog;
    log = enqueue(log, reorderOp("u1", "a1"));
    log = enqueue(log, reorderToPageOp("u1", 3));
    log = enqueue(log, reorderOp("u1", "a2"));
    expect(log.entries).toHaveLength(1);
    expect(log.entries[0]!.op).toEqual(reorderOp("u1", "a2"));
  });

  test("attach then detach on same (parent, child, role) collapses", () => {
    let log = emptyLog;
    log = enqueue(log, attachOp("p1", "c1"));
    log = enqueue(log, detachOp("p1", "c1"));
    expect(log.entries).toHaveLength(0);
  });

  test("two setChildren on same (parent, role) keep only the latest", () => {
    let log = emptyLog;
    log = enqueue(log, setChildrenOp("p1", ["c1"]));
    log = enqueue(log, setChildrenOp("p1", ["c2", "c3"]));
    expect(log.entries).toHaveLength(1);
    expect(
      (log.entries[0]!.op as ShelfItemBatchSetChildrenOp).childItemIds,
    ).toEqual(["c2", "c3"]);
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
