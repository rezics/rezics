import { useBatchUpdateShelfUnitsMutation } from "@rezics/api/shelf/shelf.mutations";
import { shelfUnitsQuery } from "@rezics/api/shelf/shelf.queries";
import type { ShelfSortOrder } from "@rezics/api/shelf";
import type {
  ShelfUnitBatchOp,
  ShelfUnitBatchResult,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
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
  unitId: string;
  kind: ShelfUnitKind;
}

export interface AttachInput {
  parentUnitId: string;
  childUnitId: string;
  childKind: ShelfUnitKind;
  role: ShelfUnitRelationRole;
  position?: string;
}

export interface SetChildrenInput {
  parentUnitId: string;
  role: ShelfUnitRelationRole;
  childUnitIds: string[];
  childKind?: ShelfUnitKind;
}

export interface ReorderBetween {
  before?: string;
  after?: string;
}

export interface SaveResult {
  results: ShelfUnitBatchResult[];
  okCount: number;
  failedCount: number;
}

export interface UseShelfItemsEditor {
  log: ItemOpLog;
  units: ShelfUnitDTO[];
  relations: ShelfUnitRelationDTO[];
  isLoading: boolean;
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
    parentUnitId: string,
    childUnitId: string,
    role: ShelfUnitRelationRole,
  ) => void;
  enqueueSetChildren: (input: SetChildrenInput) => void;
  save: () => Promise<SaveResult>;
  retryFailed: () => Promise<SaveResult>;
  discard: () => void;
}

export function useShelfItemsEditor(shelfId: string): UseShelfItemsEditor {
  const { data, isLoading } = useQuery(shelfUnitsQuery(shelfId));
  const serverUnits = useMemo(() => data?.units ?? [], [data?.units]);
  const serverRelations = useMemo(
    () => data?.relations ?? [],
    [data?.relations],
  );

  const [log, setLog] = useState<ItemOpLog>(emptyLog);
  const [lastResult, setLastResult] = useState<SaveResult | null>(null);
  const batchMutation = useBatchUpdateShelfUnitsMutation();

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

  const enqueueAdd = useCallback(
    (input: AddInput) => {
      setLog((current) => {
        const pendingTop = lastPositionOfPendingAdds(current) ?? lastPosition;
        const position = appendAfter(pendingTop);
        const op: ShelfUnitBatchOp = {
          op: "add",
          unitId: input.unitId,
          kind: input.kind,
          position,
        };
        return enqueue(current, op);
      });
    },
    [lastPosition],
  );

  const enqueueReorder = useCallback(
    (unitId: string, between: ReorderBetween) => {
      const position = betweenNeighbors(between.before, between.after);
      setLog((current) =>
        enqueue(current, { op: "reorder", unitId, position }),
      );
    },
    [],
  );

  const enqueueCrossPageMove = useCallback(
    (
      unitId: string,
      toPage: number,
      pageSize: number,
      order: ShelfSortOrder,
    ) => {
      setLog((current) =>
        enqueue(current, {
          op: "reorderToPage",
          unitId,
          toPage,
          edge: "first",
          pageSize,
          order,
        }),
      );
    },
    [],
  );

  const enqueueDelete = useCallback((unitId: string) => {
    setLog((current) => enqueue(current, { op: "delete", unitId }));
  }, []);

  const enqueueAttach = useCallback((input: AttachInput) => {
    setLog((current) =>
      enqueue(current, {
        op: "attach",
        parentUnitId: input.parentUnitId,
        childUnitId: input.childUnitId,
        childKind: input.childKind,
        role: input.role,
        ...(input.position !== undefined ? { position: input.position } : {}),
      }),
    );
  }, []);

  const enqueueDetach = useCallback(
    (
      parentUnitId: string,
      childUnitId: string,
      role: ShelfUnitRelationRole,
    ) => {
      setLog((current) =>
        enqueue(current, {
          op: "detach",
          parentUnitId,
          childUnitId,
          role,
        }),
      );
    },
    [],
  );

  const enqueueSetChildren = useCallback((input: SetChildrenInput) => {
    setLog((current) =>
      enqueue(current, {
        op: "setChildren",
        parentUnitId: input.parentUnitId,
        role: input.role,
        childUnitIds: input.childUnitIds,
        ...(input.childKind ? { childKind: input.childKind } : {}),
      }),
    );
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
    },
    [batchMutation, shelfId],
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
    units: optimisticUnits,
    relations: optimisticRelations,
    isLoading,
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
  serverUnits: ShelfUnitDTO[],
  serverRelations: ShelfUnitRelationDTO[],
  log: ItemOpLog,
  shelfId: string,
): { units: ShelfUnitDTO[]; relations: ShelfUnitRelationDTO[] } {
  let units = serverUnits.map((u) => ({ ...u }));
  let relations = serverRelations.map((r) => ({ ...r }));

  function ensureUnit(unitId: string, kind: ShelfUnitKind, position?: string) {
    const idx = units.findIndex((u) => u.unitId === unitId);
    if (idx >= 0) return;
    const finalPosition = position ?? appendAfter(maxPositionOf(units));
    units = [
      ...units,
      { shelfId, unitId, kind, position: finalPosition },
    ];
  }

  for (const entry of log.entries) {
    if (entry.failedReason) continue;
    const { op } = entry;

    if (op.op === "add") {
      const idx = units.findIndex((u) => u.unitId === op.unitId);
      const next: ShelfUnitDTO = {
        shelfId,
        unitId: op.unitId,
        kind: op.kind,
        position: op.position,
      };
      if (idx >= 0) units[idx] = { ...units[idx]!, ...next };
      else units = [...units, next];
      continue;
    }

    if (op.op === "delete") {
      units = units.filter((u) => u.unitId !== op.unitId);
      relations = relations.filter(
        (r) =>
          r.parentUnitId !== op.unitId && r.childUnitId !== op.unitId,
      );
      continue;
    }

    if (op.op === "reorder" || op.op === "reorderToPage") {
      if (op.op === "reorder") {
        units = units.map((u) =>
          u.unitId === op.unitId ? { ...u, position: op.position } : u,
        );
      }
      // reorderToPage: server-resolved; no optimistic position
      continue;
    }

    if (op.op === "attach") {
      ensureUnit(op.childUnitId, op.childKind, op.position);
      const exists = relations.some(
        (r) =>
          r.parentUnitId === op.parentUnitId &&
          r.childUnitId === op.childUnitId &&
          r.role === op.role,
      );
      if (!exists) {
        relations = [
          ...relations,
          {
            shelfId,
            parentUnitId: op.parentUnitId,
            childUnitId: op.childUnitId,
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
            r.parentUnitId === op.parentUnitId &&
            r.childUnitId === op.childUnitId &&
            r.role === op.role
          ),
      );
      continue;
    }

    if (op.op === "setChildren") {
      for (const childId of op.childUnitIds) {
        ensureUnit(childId, op.childKind ?? ("post" as ShelfUnitKind));
      }
      relations = relations.filter(
        (r) =>
          !(r.parentUnitId === op.parentUnitId && r.role === op.role),
      );
      for (const childId of op.childUnitIds) {
        relations = [
          ...relations,
          {
            shelfId,
            parentUnitId: op.parentUnitId,
            childUnitId: childId,
            role: op.role,
          },
        ];
      }
      continue;
    }
  }

  return { units, relations };
}

function maxPositionOf(units: ShelfUnitDTO[]): string | undefined {
  let last: string | undefined;
  for (const u of units) {
    if (!last || u.position > last) last = u.position;
  }
  return last;
}
