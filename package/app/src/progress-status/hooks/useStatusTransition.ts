import {
  useDeleteUnitProgress,
  useUpdateUnitProgress,
} from "@rezics/api/progress/progress.mutations";
import { useSystemShelfIdResolver } from "@rezics/api/shelf";
import {
  useAddShelfItemMutation,
  useRemoveShelfItemMutation,
} from "@rezics/api/shelf/shelf.mutations";
import type { ProgressExtra, UserUnitProgressStatus } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { useCallback, useMemo } from "react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
import {
  planRemoveProgress,
  planTransition,
  type ShelfOp,
} from "../models/transition";
export type StatusTransitionPayload = {
  to: UserUnitProgressStatus;
  progress?: number;
  lastReadNodeId?: string | null;
  extra?: ProgressExtra | null;
  completedCount?: number;
};

export type StatusTransitionFailure = {
  progress: boolean;
  shelf: boolean;
};

export type UseStatusTransitionResult = {
  transition: (
    payload: StatusTransitionPayload,
  ) => Promise<StatusTransitionFailure>;
  removeProgress: () => Promise<StatusTransitionFailure>;
  isPending: boolean;
};

export function useStatusTransition(
  unitId: string,
  currentStatus: UserUnitProgressStatus | null,
): UseStatusTransitionResult {
  const updateProgress = useUpdateUnitProgress(unitId);
  const deleteProgress = useDeleteUnitProgress(unitId);
  const { resolve: resolveSystemShelfId, isPending: isSystemShelfPending } =
    useSystemShelfIdResolver();
  const addShelfItem = useAddShelfItemMutation();
  const removeShelfItem = useRemoveShelfItemMutation();

  const showRetryToast = useRetryToast();

  const runShelfOp = useCallback(
    async (op: ShelfOp) => {
      const shelfId = await resolveSystemShelfId(op.shelfKey);
      if (op.kind === "add") {
        await addShelfItem.mutateAsync({
          shelfId,
          input: { itemType: "unit", itemId: unitId, kind: "book" },
        });
      } else {
        await removeShelfItem.mutateAsync({
          shelfId,
          itemType: "unit",
          itemId: unitId,
        });
      }
    },
    [addShelfItem, removeShelfItem, resolveSystemShelfId, unitId],
  );

  const dispatchShelfOps = useCallback(
    async (ops: ShelfOp[]) => {
      const results = await Promise.allSettled(ops.map((op) => runShelfOp(op)));
      const failedOps = ops.filter((_, i) => results[i].status === "rejected");
      return failedOps;
    },
    [runShelfOp],
  );

  const handlePartialFailure = useCallback(
    (
      progressFailed: boolean,
      failedShelfOps: ShelfOp[],
      retryShelf: () => Promise<void>,
      retryProgress: () => Promise<void>,
    ) => {
      const shelfFailed = failedShelfOps.length > 0;

      if (progressFailed && shelfFailed) {
        showRetryToast(
          `${unitId}:both`,
          getI18nRuntime().i18n.t(
            "community:progress_status_toast_both_failed",
          ),
          async () => {
            await Promise.allSettled([retryProgress(), retryShelf()]);
          },
        );
      } else if (progressFailed) {
        showRetryToast(
          `${unitId}:progress`,
          getI18nRuntime().i18n.t(
            "community:progress_status_toast_progress_failed",
          ),
          retryProgress,
        );
      } else if (shelfFailed) {
        showRetryToast(
          `${unitId}:shelf`,
          getI18nRuntime().i18n.t(
            "community:progress_status_toast_shelf_failed",
          ),
          retryShelf,
        );
      }
    },
    [showRetryToast, unitId],
  );

  const transition = useCallback(
    async (
      payload: StatusTransitionPayload,
    ): Promise<StatusTransitionFailure> => {
      const ops = planTransition(currentStatus, payload.to);

      const writeProgress = async () => {
        await updateProgress.mutateAsync({
          status: payload.to,
          progress: payload.progress,
          lastReadNodeId: payload.lastReadNodeId,
          extra: payload.extra,
          completedCount: payload.completedCount,
        });
      };

      const [progressResult, shelfFailedOps] = await Promise.all([
        writeProgress().then(
          () => ({ ok: true as const }),
          (error) => ({ ok: false as const, error }),
        ),
        dispatchShelfOps(ops),
      ]);

      const progressFailed = !progressResult.ok;
      const shelfFailed = shelfFailedOps.length > 0;

      handlePartialFailure(
        progressFailed,
        shelfFailedOps,
        () => dispatchShelfOps(shelfFailedOps).then(() => undefined),
        () => writeProgress(),
      );

      return { progress: progressFailed, shelf: shelfFailed };
    },
    [currentStatus, dispatchShelfOps, handlePartialFailure, updateProgress],
  );

  const removeProgress =
    useCallback(async (): Promise<StatusTransitionFailure> => {
      const ops = planRemoveProgress(currentStatus);

      const runDelete = async () => {
        await deleteProgress.mutateAsync();
      };

      const [progressResult, shelfFailedOps] = await Promise.all([
        runDelete().then(
          () => ({ ok: true as const }),
          (error) => ({ ok: false as const, error }),
        ),
        dispatchShelfOps(ops),
      ]);

      const progressFailed = !progressResult.ok;
      const shelfFailed = shelfFailedOps.length > 0;

      handlePartialFailure(
        progressFailed,
        shelfFailedOps,
        () => dispatchShelfOps(shelfFailedOps).then(() => undefined),
        () => runDelete(),
      );

      return { progress: progressFailed, shelf: shelfFailed };
    }, [currentStatus, deleteProgress, dispatchShelfOps, handlePartialFailure]);

  const isPending = useMemo(
    () =>
      updateProgress.isPending ||
      deleteProgress.isPending ||
      isSystemShelfPending ||
      addShelfItem.isPending ||
      removeShelfItem.isPending,
    [
      addShelfItem.isPending,
      deleteProgress.isPending,
      isSystemShelfPending,
      removeShelfItem.isPending,
      updateProgress.isPending,
    ],
  );

  return { transition, removeProgress, isPending };
}
