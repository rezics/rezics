import { describe, expect, test } from "bun:test";
import type {
  ShelfUnitBatchAddOp,
  ShelfUnitBatchAttachOp,
  ShelfUnitBatchDeleteOp,
  ShelfUnitBatchDetachOp,
  ShelfUnitBatchReorderOp,
  ShelfUnitBatchReorderToPageOp,
  ShelfUnitBatchSetChildrenOp,
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

const addOp = (unitId: string, position = "a0"): ShelfUnitBatchAddOp => ({
  op: "add",
  unitId,
  kind: "post",
  position,
});

const reorderOp = (
  unitId: string,
  position: string,
): ShelfUnitBatchReorderOp => ({
  op: "reorder",
  unitId,
  position,
});

const deleteOp = (unitId: string): ShelfUnitBatchDeleteOp => ({
  op: "delete",
  unitId,
});

const reorderToPageOp = (
  unitId: string,
  toPage: number,
): ShelfUnitBatchReorderToPageOp => ({
  op: "reorderToPage",
  unitId,
  toPage,
  edge: "first",
});

const attachOp = (
  parentUnitId: string,
  childUnitId: string,
): ShelfUnitBatchAttachOp => ({
  op: "attach",
  parentUnitId,
  childUnitId,
  childKind: "review",
  role: "review",
});

const detachOp = (
  parentUnitId: string,
  childUnitId: string,
): ShelfUnitBatchDetachOp => ({
  op: "detach",
  parentUnitId,
  childUnitId,
  role: "review",
});

const setChildrenOp = (
  parentUnitId: string,
  childUnitIds: string[],
): ShelfUnitBatchSetChildrenOp => ({
  op: "setChildren",
  parentUnitId,
  role: "tag",
  childUnitIds,
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
    expect((log.entries[0]!.op as ShelfUnitBatchReorderOp).position).toBe("a2");
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
      (log.entries[0]!.op as ShelfUnitBatchSetChildrenOp).childUnitIds,
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
