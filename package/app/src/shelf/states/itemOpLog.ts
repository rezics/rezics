import type { ShelfItemBatchOp } from "@rezics/contract";

export interface ItemOpEntry {
  id: string;
  op: ShelfItemBatchOp;
  failedReason?: string;
}

export interface ItemOpLog {
  entries: ItemOpEntry[];
  nextSeq: number;
}

export const emptyLog: ItemOpLog = { entries: [], nextSeq: 1 };

function itemRefOf(op: ShelfItemBatchOp): string {
  return op.itemRef;
}

export function enqueue(log: ItemOpLog, op: ShelfItemBatchOp): ItemOpLog {
  const id = `op-${log.nextSeq}`;
  const next: ItemOpLog = {
    entries: [...log.entries, { id, op }],
    nextSeq: log.nextSeq + 1,
  };
  return coalesce(next);
}

/**
 * Reduce the entry list using these rules (applied right-to-left so the
 * latest op wins):
 *
 * - `add` then `delete` on the same itemRef → drop both
 * - `reorder` then later `reorder` on same itemRef → keep only the latest
 * - `reorderToPage` then later `reorder*` on same itemRef → keep only the latest
 * - `setTags` then later `setTags` on same itemRef → keep only the latest
 *
 * Failed entries are skipped by coalescing — they remain in the log as-is so
 * the user can retry them.
 */
export function coalesce(log: ItemOpLog): ItemOpLog {
  const live = log.entries.filter((e) => !e.failedReason);
  const failed = log.entries.filter((e) => e.failedReason);

  const reversed = [...live].reverse();
  const kept: ItemOpEntry[] = [];
  const seenReorderRef = new Set<string>();
  const seenSetTagsRef = new Set<string>();
  const droppedAddRef = new Set<string>();
  const seenDeleteRef = new Set<string>();

  for (const entry of reversed) {
    const ref = itemRefOf(entry.op);
    const kind = entry.op.op;

    if (kind === "delete") {
      if (seenDeleteRef.has(ref)) continue;
      seenDeleteRef.add(ref);
      kept.push(entry);
      continue;
    }
    if (kind === "add") {
      if (seenDeleteRef.has(ref)) {
        droppedAddRef.add(ref);
        continue;
      }
      kept.push(entry);
      continue;
    }
    if (kind === "reorder" || kind === "reorderToPage") {
      if (seenReorderRef.has(ref)) continue;
      seenReorderRef.add(ref);
      kept.push(entry);
      continue;
    }
    if (kind === "setTags") {
      if (seenSetTagsRef.has(ref)) continue;
      seenSetTagsRef.add(ref);
      kept.push(entry);
      continue;
    }
  }

  const cleaned = kept
    .reverse()
    .filter((e) => {
      const ref = itemRefOf(e.op);
      if (e.op.op === "delete" && droppedAddRef.has(ref)) return false;
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
