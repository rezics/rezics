import { useBatchUpdateShelfItemsMutation } from "@rezics/api/shelf/shelf.mutations";
import { shelfItemsQuery } from "@rezics/api/shelf/shelf.queries";
import type {
  ShelfItemBatchOp,
  ShelfItemBatchResult,
  ShelfItemDTO,
  ShelfItemKind,
} from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
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
  itemRef: string;
  kind: ShelfItemKind;
  tagIds?: string[];
  reviewIds?: string[];
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
  items: ShelfItemDTO[];
  isLoading: boolean;
  dirty: boolean;
  pendingCount: number;
  saving: boolean;
  lastResult: SaveResult | null;
  enqueueAdd: (input: AddInput) => void;
  enqueueReorder: (itemRef: string, between: ReorderBetween) => void;
  enqueueCrossPageMove: (itemRef: string, toPage: number) => void;
  enqueueDelete: (itemRef: string) => void;
  enqueueSetTags: (itemRef: string, tagIds: string[]) => void;
  save: () => Promise<SaveResult>;
  retryFailed: () => Promise<SaveResult>;
  discard: () => void;
}

export function useShelfItemsEditor(shelfUnitId: string): UseShelfItemsEditor {
  const { data, isLoading } = useQuery(shelfItemsQuery(shelfUnitId));
  const serverItems = data?.items ?? [];

  const [log, setLog] = useState<ItemOpLog>(emptyLog);
  const [lastResult, setLastResult] = useState<SaveResult | null>(null);
  const batchMutation = useBatchUpdateShelfItemsMutation();

  const optimisticItems = useMemo(
    () => applyLiveOps(serverItems, log),
    [serverItems, log],
  );

  const lastPosition = useMemo(() => {
    if (serverItems.length === 0) return undefined;
    let last = serverItems[0]!.position;
    for (const it of serverItems) {
      if (it.position > last) last = it.position;
    }
    return last;
  }, [serverItems]);

  const enqueueAdd = useCallback(
    (input: AddInput) => {
      setLog((current) => {
        const pendingTop = lastPositionOfPendingAdds(current) ?? lastPosition;
        const position = appendAfter(pendingTop);
        const op: ShelfItemBatchOp = {
          op: "add",
          itemRef: input.itemRef,
          kind: input.kind,
          position,
          ...(input.tagIds ? { tagIds: input.tagIds } : {}),
          ...(input.reviewIds ? { reviewIds: input.reviewIds } : {}),
        };
        return enqueue(current, op);
      });
    },
    [lastPosition],
  );

  const enqueueReorder = useCallback(
    (itemRef: string, between: ReorderBetween) => {
      const position = betweenNeighbors(between.before, between.after);
      setLog((current) =>
        enqueue(current, { op: "reorder", itemRef, position }),
      );
    },
    [],
  );

  const enqueueCrossPageMove = useCallback(
    (itemRef: string, toPage: number) => {
      setLog((current) =>
        enqueue(current, {
          op: "reorderToPage",
          itemRef,
          toPage,
          edge: "first",
        }),
      );
    },
    [],
  );

  const enqueueDelete = useCallback((itemRef: string) => {
    setLog((current) => enqueue(current, { op: "delete", itemRef }));
  }, []);

  const enqueueSetTags = useCallback((itemRef: string, tagIds: string[]) => {
    setLog((current) => enqueue(current, { op: "setTags", itemRef, tagIds }));
  }, []);

  const submitOps = useCallback(
    async (entries: ItemOpEntry[]): Promise<SaveResult> => {
      if (entries.length === 0) {
        const empty: SaveResult = { results: [], okCount: 0, failedCount: 0 };
        setLastResult(empty);
        return empty;
      }
      const ops = entries.map((e) => e.op);
      const response = await batchMutation.mutateAsync({
        shelfUnitId,
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
    },
    [batchMutation, shelfUnitId],
  );

  const save = useCallback(async (): Promise<SaveResult> => {
    return submitOps(log.entries.filter((e) => !e.failedReason));
  }, [log.entries, submitOps]);

  const retryFailed = useCallback(async (): Promise<SaveResult> => {
    const failed = log.entries.filter((e) => e.failedReason);
    setLog((current) => ({
      ...current,
      entries: current.entries.map((e) =>
        e.failedReason ? { ...e, failedReason: undefined } : e,
      ),
    }));
    return submitOps(failed);
  }, [log.entries, submitOps]);

  const discard = useCallback(() => {
    setLog((current) => clear(current));
    setLastResult(null);
  }, []);

  return {
    log,
    items: optimisticItems,
    isLoading,
    dirty: dirty(log),
    pendingCount: pendingCount(log),
    saving: batchMutation.isPending,
    lastResult,
    enqueueAdd,
    enqueueReorder,
    enqueueCrossPageMove,
    enqueueDelete,
    enqueueSetTags,
    save,
    retryFailed,
    discard,
  };
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
  serverItems: ShelfItemDTO[],
  log: ItemOpLog,
): ShelfItemDTO[] {
  let items = serverItems.map((item) => ({ ...item }));

  for (const entry of log.entries) {
    if (entry.failedReason) continue;
    const { op } = entry;

    if (op.op === "add") {
      const existingIndex = items.findIndex(
        (item) => item.itemRef === op.itemRef,
      );
      const nextItem: ShelfItemDTO = {
        shelfUnitId: "",
        itemRef: op.itemRef,
        kind: op.kind,
        position: op.position,
        reviewIds: op.reviewIds ?? [],
        tagIds: op.tagIds ?? [],
      };
      if (existingIndex >= 0) {
        items[existingIndex] = { ...items[existingIndex]!, ...nextItem };
      } else {
        items = [...items, nextItem];
      }
      continue;
    }

    if (op.op === "delete") {
      items = items.filter((item) => item.itemRef !== op.itemRef);
      continue;
    }

    if (op.op === "reorder") {
      items = items.map((item) =>
        item.itemRef === op.itemRef ? { ...item, position: op.position } : item,
      );
      continue;
    }

    if (op.op === "setTags") {
      items = items.map((item) =>
        item.itemRef === op.itemRef ? { ...item, tagIds: op.tagIds } : item,
      );
    }
  }

  return items;
}
