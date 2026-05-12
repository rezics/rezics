import type { ShelfUnitBatchOp } from "@rezics/contract";

export interface ItemOpEntry {
  id: string;
  op: ShelfUnitBatchOp;
  failedReason?: string;
}

export interface ItemOpLog {
  entries: ItemOpEntry[];
  nextSeq: number;
}

export const emptyLog: ItemOpLog = { entries: [], nextSeq: 1 };

/**
 * Coalescing key for an op: relation-shaped ops (`attach`/`detach`/`setChildren`)
 * key by `(parent, child, role)` or `(parent, role)`; unit-shaped ops key by `unitId`.
 */
function unitKeyOf(op: ShelfUnitBatchOp): string | null {
  switch (op.op) {
    case "add":
    case "reorder":
    case "reorderToPage":
    case "delete":
      return op.unitId;
    case "attach":
    case "detach":
      return `${op.parentUnitId}|${op.childUnitId}|${op.role}`;
    case "setChildren":
      return `${op.parentUnitId}|${op.role}`;
    default:
      return null;
  }
}

export function enqueue(log: ItemOpLog, op: ShelfUnitBatchOp): ItemOpLog {
  const id = `op-${log.nextSeq}`;
  const next: ItemOpLog = {
    entries: [...log.entries, { id, op }],
    nextSeq: log.nextSeq + 1,
  };
  return coalesce(next);
}

/**
 * Reduce the entry list (applied right-to-left so latest op wins):
 *
 * - `add` then `delete` on the same unitId → drop both
 * - `reorder` then later `reorder*` on same unitId → keep only the latest
 * - `reorderToPage` then later `reorder*` on same unitId → keep only the latest
 * - `setChildren` then later `setChildren` on same `(parent, role)` → latest only
 * - `attach` then later `detach` on same `(parent, child, role)` → drop both
 *
 * Failed entries are skipped by coalescing.
 */
export function coalesce(log: ItemOpLog): ItemOpLog {
  const live = log.entries.filter((e) => !e.failedReason);
  const failed = log.entries.filter((e) => e.failedReason);

  const reversed = [...live].reverse();
  const kept: ItemOpEntry[] = [];
  const seenReorderRef = new Set<string>();
  const seenSetChildrenRef = new Set<string>();
  const droppedAddRef = new Set<string>();
  const seenDeleteRef = new Set<string>();
  const seenAttachKey = new Set<string>();
  const droppedDetachKey = new Set<string>();

  for (const entry of reversed) {
    const key = unitKeyOf(entry.op);
    if (key === null) continue;
    const kind = entry.op.op;

    if (kind === "delete") {
      if (seenDeleteRef.has(key)) continue;
      seenDeleteRef.add(key);
      kept.push(entry);
      continue;
    }
    if (kind === "add") {
      if (seenDeleteRef.has(key)) {
        droppedAddRef.add(key);
        continue;
      }
      kept.push(entry);
      continue;
    }
    if (kind === "reorder" || kind === "reorderToPage") {
      if (seenReorderRef.has(key)) continue;
      seenReorderRef.add(key);
      kept.push(entry);
      continue;
    }
    if (kind === "setChildren") {
      if (seenSetChildrenRef.has(key)) continue;
      seenSetChildrenRef.add(key);
      kept.push(entry);
      continue;
    }
    if (kind === "detach") {
      seenAttachKey.add(key);
      kept.push(entry);
      continue;
    }
    if (kind === "attach") {
      if (seenAttachKey.has(key)) {
        droppedDetachKey.add(key);
        continue;
      }
      kept.push(entry);
      continue;
    }
  }

  const cleaned = kept
    .reverse()
    .filter((e) => {
      const key = unitKeyOf(e.op);
      if (key === null) return true;
      if (e.op.op === "delete" && droppedAddRef.has(key)) return false;
      if (e.op.op === "detach" && droppedDetachKey.has(key)) return false;
      return true;
    });

  return {
    entries: [...failed, ...cleaned],
    nextSeq: log.nextSeq,
  };
}

export function clear(log: ItemOpLog): ItemOpLog {
  return { entries: [], nextSeq: log.nextSeq };
}

export function clearSucceeded(log: ItemOpLog, succeededIds: Set<string>): ItemOpLog {
  return {
    entries: log.entries.filter((e) => !succeededIds.has(e.id)),
    nextSeq: log.nextSeq,
  };
}

export function markFailed(
  log: ItemOpLog,
  opId: string,
  reason: string,
): ItemOpLog {
  return {
    entries: log.entries.map((e) =>
      e.id === opId ? { ...e, failedReason: reason } : e,
    ),
    nextSeq: log.nextSeq,
  };
}

export function dirty(log: ItemOpLog): boolean {
  return log.entries.length > 0;
}

export function pendingCount(log: ItemOpLog): number {
  return log.entries.length;
}
