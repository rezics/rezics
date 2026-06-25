import type { ShelfSortOrder } from "@rezics/contract/api/shelf/shelf";
import { useBatchUpdateShelfItemsMutation } from "@rezics/contract/api/shelf/shelf.mutations";
import { shelfItemsInfiniteQuery } from "@rezics/contract/api/shelf/shelf.queries";
import type {
  ShelfItemBatchOp,
  ShelfItemBatchResult,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemType,
} from "@rezics/contract";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { appendAfter, betweenNeighbors } from "../models/positionMath";
import {
  clear,
  clearSucceeded,
  dirty,
  emptyLog,
  enqueue,
  type ItemOpEntry,
  type ItemOpLog,
  markFailed,
  pendingCount,
} from "../states/itemOpLog";

export interface AddInput {
  unitId: string;
  kind: ShelfItemKind;
}

export interface AttachInput {
  parentItemType?: ShelfItemType;
  parentItemId: string;
  childItemType?: ShelfItemType;
  childItemId: string;
  childKind: ShelfItemKind;
  role: ShelfItemParentRole;
  position?: string;
}

export interface SetChildrenInput {
  parentItemType?: ShelfItemType;
  parentItemId: string;
  role: ShelfItemParentRole;
  childItemType?: ShelfItemType;
  childItemIds: string[];
  childKind?: ShelfItemKind;
}

export interface ReorderBetween {
  before?: string;
  after?: string;
}

export interface SaveResult {
  results: ShelfItemBatchResult[];
  okCount: number;
  failedCount: number;
}

export interface UseShelfItemsEditor {
  log: ItemOpLog;
  units: ShelfItemDTO[];
  relations: ShelfItemChildDTO[];
  isLoading: boolean;
  hasMoreUnits: boolean;
  isLoadingMoreUnits: boolean;
  loadMoreUnits: () => Promise<void>;
  dirty: boolean;
  pendingCount: number;
  saving: boolean;
  lastResult: SaveResult | null;
  enqueueAdd: (input: AddInput) => void;
  enqueueReorder: (unitId: string, between: ReorderBetween) => void;
  enqueueCrossPageMove: (
    unitId: string,
    toPage: number,
    pageSize: number,
    order: ShelfSortOrder,
  ) => void;
  enqueueDelete: (unitId: string) => void;
  enqueueAttach: (input: AttachInput) => void;
  enqueueDetach: (
    parentItemId: string,
    childItemId: string,
    role: ShelfItemParentRole,
  ) => void;
  enqueueSetChildren: (input: SetChildrenInput) => void;
  save: () => Promise<SaveResult>;
  retryFailed: () => Promise<SaveResult>;
  discard: () => void;
}

export function useShelfItemsEditor(shelfId: string): UseShelfItemsEditor {
  const unitsQuery = useInfiniteQuery(
    shelfItemsInfiniteQuery(shelfId, { limit: 100 }),
  );
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    unitsQuery;
  const serverUnits = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages],
  );
  const serverRelations = useMemo(
    () => dedupeRelations(data?.pages.flatMap((page) => page.relations) ?? []),
    [data?.pages],
  );

  const [log, setLog] = useState<ItemOpLog>(emptyLog);
  const [lastResult, setLastResult] = useState<SaveResult | null>(null);
  const batchMutation = useBatchUpdateShelfItemsMutation();

  // Editing needs complete shelf context for cross-page reorder and relation
  // summaries. This relies on shelf item pages advancing by root-safe cursors;
  // appended child rows must never become the next-page boundary.
  // 编辑需要完整的 shelf 上下文以支持跨页重排与关系摘要。这里依赖 shelf item
  // 分页按 root-safe cursor 前进；附加的 child row 绝不能成为下一页边界。
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const loadMoreUnits = async () => {
    if (!hasNextPage || isFetchingNextPage) return;
    await fetchNextPage();
  };

  const { units: optimisticUnits, relations: optimisticRelations } = useMemo(
    () => applyLiveOps(serverUnits, serverRelations, log, shelfId),
    [serverUnits, serverRelations, log, shelfId],
  );

  const lastPosition = useMemo(() => {
    if (serverUnits.length === 0) return undefined;
    let last = serverUnits[0]!.position;
    for (const u of serverUnits) {
      if (u.position > last) last = u.position;
    }
    return last;
  }, [serverUnits]);

  const enqueueAdd = (input: AddInput) => {
    setLog((current) => {
      const pendingTop = lastPositionOfPendingAdds(current) ?? lastPosition;
      const position = appendAfter(pendingTop);
      const op: ShelfItemBatchOp = {
        op: "add",
        itemType: "unit",
        itemId: input.unitId,
        kind: input.kind,
        position,
      };
      return enqueue(current, op);
    });
  };

  const enqueueReorder = (unitId: string, between: ReorderBetween) => {
    const position = betweenNeighbors(between.before, between.after);
    setLog((current) =>
      enqueue(current, {
        op: "reorder",
        itemType: "unit",
        itemId: unitId,
        position,
      }),
    );
  };

  const enqueueCrossPageMove = (
    unitId: string,
    toPage: number,
    pageSize: number,
    order: ShelfSortOrder,
  ) => {
    setLog((current) =>
      enqueue(current, {
        op: "reorderToPage",
        itemType: "unit",
        itemId: unitId,
        toPage,
        edge: "first",
        pageSize,
        order,
      }),
    );
  };

  const enqueueDelete = (unitId: string) => {
    setLog((current) =>
      enqueue(current, { op: "delete", itemType: "unit", itemId: unitId }),
    );
  };

  const enqueueAttach = (input: AttachInput) => {
    setLog((current) =>
      enqueue(current, {
        op: "attach",
        parentItemType: input.parentItemType ?? "unit",
        parentItemId: input.parentItemId,
        childItemType: input.childItemType ?? "unit",
        childItemId: input.childItemId,
        childKind: input.childKind,
        role: input.role,
        ...(input.position !== undefined ? { position: input.position } : {}),
      }),
    );
  };

  const enqueueDetach = (
    parentItemId: string,
    childItemId: string,
    role: ShelfItemParentRole,
  ) => {
    setLog((current) =>
      enqueue(current, {
        op: "detach",
        parentItemType: "unit",
        parentItemId,
        childItemType: "unit",
        childItemId,
        role,
      }),
    );
  };

  const enqueueSetChildren = (input: SetChildrenInput) => {
    setLog((current) =>
      enqueue(current, {
        op: "setChildren",
        parentItemType: input.parentItemType ?? "unit",
        parentItemId: input.parentItemId,
        role: input.role,
        childItemType: input.childItemType ?? "unit",
        childItemIds: input.childItemIds,
        ...(input.childKind ? { childKind: input.childKind } : {}),
      }),
    );
  };

  const submitOps = async (entries: ItemOpEntry[]): Promise<SaveResult> => {
    if (entries.length === 0) {
      const empty: SaveResult = { results: [], okCount: 0, failedCount: 0 };
      setLastResult(empty);
      return empty;
    }
    const ops = entries.map((e) => e.op);
    const response = await batchMutation.mutateAsync({
      shelfId,
      ops,
    });
    const succeededIds = new Set<string>();
    let okCount = 0;
    let failedCount = 0;
    setLog((current) => {
      let next = current;
      response.results.forEach((res, idx) => {
        const entry = entries[idx]!;
        if (res.status === "ok") {
          succeededIds.add(entry.id);
          okCount += 1;
        } else {
          failedCount += 1;
          next = markFailed(next, entry.id, res.reason);
        }
      });
      return clearSucceeded(next, succeededIds);
    });
    const result: SaveResult = {
      results: response.results,
      okCount,
      failedCount,
    };
    setLastResult(result);
    return result;
  };

  const save = async (): Promise<SaveResult> => {
    return submitOps(log.entries.filter((e) => !e.failedReason));
  };

  const retryFailed = async (): Promise<SaveResult> => {
    const failed = log.entries.filter((e) => e.failedReason);
    setLog((current) => ({
      ...current,
      entries: current.entries.map((e) =>
        e.failedReason ? { ...e, failedReason: undefined } : e,
      ),
    }));
    return submitOps(failed);
  };

  const discard = () => {
    setLog((current) => clear(current));
    setLastResult(null);
  };

  return {
    log,
    units: optimisticUnits,
    relations: optimisticRelations,
    isLoading,
    hasMoreUnits: hasNextPage,
    isLoadingMoreUnits: isFetchingNextPage,
    loadMoreUnits,
    dirty: dirty(log),
    pendingCount: pendingCount(log),
    saving: batchMutation.isPending,
    lastResult,
    enqueueAdd,
    enqueueReorder,
    enqueueCrossPageMove,
    enqueueDelete,
    enqueueAttach,
    enqueueDetach,
    enqueueSetChildren,
    save,
    retryFailed,
    discard,
  };
}

function dedupeRelations(
  relations: readonly (ShelfItemChildDTO | undefined)[],
): ShelfItemChildDTO[] {
  const seen = new Set<string>();
  const out: ShelfItemChildDTO[] = [];
  for (const relation of relations) {
    if (!relation) continue;
    const key = `${relation.parentItemType}:${relation.parentItemId}:${relation.childItemType}:${relation.childItemId}:${relation.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(relation);
  }
  return out;
}

function lastPositionOfPendingAdds(log: ItemOpLog): string | undefined {
  let last: string | undefined;
  for (const entry of log.entries) {
    if (entry.failedReason) continue;
    if (entry.op.op === "add") {
      if (!last || entry.op.position > last) last = entry.op.position;
    }
  }
  return last;
}

function applyLiveOps(
  serverUnits: ShelfItemDTO[],
  serverRelations: ShelfItemChildDTO[],
  log: ItemOpLog,
  shelfId: string,
): { units: ShelfItemDTO[]; relations: ShelfItemChildDTO[] } {
  let units = serverUnits.map((u) => ({ ...u }));
  let relations = serverRelations.map((r) => ({ ...r }));

  function ensureUnit(unitId: string, kind: ShelfItemKind, position?: string) {
    const idx = units.findIndex(
      (u) => u.itemType === "unit" && u.itemId === unitId,
    );
    if (idx >= 0) return;
    const finalPosition = position ?? appendAfter(maxPositionOf(units));
    units = [
      ...units,
      {
        shelfId,
        itemType: "unit",
        itemId: unitId,
        kind,
        position: finalPosition,
      },
    ];
  }

  for (const entry of log.entries) {
    if (entry.failedReason) continue;
    const { op } = entry;

    if (op.op === "add") {
      const idx = units.findIndex(
        (u) => u.itemType === op.itemType && u.itemId === op.itemId,
      );
      const next: ShelfItemDTO = {
        shelfId,
        itemType: op.itemType,
        itemId: op.itemId,
        kind: op.kind,
        position: op.position,
        parentItemType: op.parentItemType,
        parentItemId: op.parentItemId,
        parentRole: op.parentRole,
      };
      if (idx >= 0) units[idx] = { ...units[idx]!, ...next };
      else units = [...units, next];
      continue;
    }

    if (op.op === "delete") {
      units = units.filter(
        (u) => !(u.itemType === op.itemType && u.itemId === op.itemId),
      );
      relations = relations.filter(
        (r) =>
          !(
            (r.parentItemType === op.itemType &&
              r.parentItemId === op.itemId) ||
            (r.childItemType === op.itemType && r.childItemId === op.itemId)
          ),
      );
      continue;
    }

    if (op.op === "reorder" || op.op === "reorderToPage") {
      if (op.op === "reorder") {
        units = units.map((u) =>
          u.itemType === op.itemType && u.itemId === op.itemId
            ? { ...u, position: op.position }
            : u,
        );
      }
      // reorderToPage: server-resolved; no optimistic position
      // reorderToPage：由服务端解析；不做乐观位置更新
      continue;
    }

    if (op.op === "attach") {
      if (op.childItemType === "unit") {
        ensureUnit(op.childItemId, op.childKind, op.position);
      }
      const exists = relations.some(
        (r) =>
          r.parentItemType === op.parentItemType &&
          r.parentItemId === op.parentItemId &&
          r.childItemType === op.childItemType &&
          r.childItemId === op.childItemId &&
          r.role === op.role,
      );
      if (!exists) {
        relations = [
          ...relations,
          {
            shelfId,
            parentItemType: op.parentItemType,
            parentItemId: op.parentItemId,
            childItemType: op.childItemType,
            childItemId: op.childItemId,
            role: op.role,
          },
        ];
      }
      continue;
    }

    if (op.op === "detach") {
      relations = relations.filter(
        (r) =>
          !(
            r.parentItemType === op.parentItemType &&
            r.parentItemId === op.parentItemId &&
            r.childItemType === op.childItemType &&
            r.childItemId === op.childItemId &&
            r.role === op.role
          ),
      );
      continue;
    }

    if (op.op === "setChildren") {
      if (op.childItemType === "unit") {
        for (const childId of op.childItemIds ?? []) {
          ensureUnit(childId, op.childKind ?? ("post" as ShelfItemKind));
        }
      }
      relations = relations.filter(
        (r) =>
          !(
            r.parentItemType === op.parentItemType &&
            r.parentItemId === op.parentItemId &&
            r.childItemType === op.childItemType &&
            r.role === op.role
          ),
      );
      for (const childId of op.childItemIds ?? []) {
        relations = [
          ...relations,
          {
            shelfId,
            parentItemType: op.parentItemType,
            parentItemId: op.parentItemId,
            childItemType: op.childItemType,
            childItemId: childId,
            role: op.role,
          },
        ];
      }
    }
  }

  return { units, relations };
}

function maxPositionOf(units: ShelfItemDTO[]): string | undefined {
  let last: string | undefined;
  for (const u of units) {
    if (!last || u.position > last) last = u.position;
  }
  return last;
}
