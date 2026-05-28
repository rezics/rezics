import {
  useDeleteUnitProgress,
  useUpdateUnitProgress,
} from "@rezics/api/progress/progress.mutations";
import { useSystemShelfIdResolver } from "@rezics/api/shelf";
import {
  useAddShelfUnitMutation,
  useRemoveShelfUnitMutation,
} from "@rezics/api/shelf/shelf.mutations";
import type { ProgressExtra, UserUnitProgressStatus } from "@rezics/contract";
import {
  common_retry,
  progress_status_toast_both_failed,
  progress_status_toast_progress_failed,
  progress_status_toast_shelf_failed,
} from "@rezics/i18n/messages";
import { useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
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
  const addShelfUnit = useAddShelfUnitMutation();
  const removeShelfUnit = useRemoveShelfUnitMutation();

  const inFlightRetries = useRef(new Set<string>());

  const runShelfOp = useCallback(
    async (op: ShelfOp) => {
      const shelfId = await resolveSystemShelfId(op.shelfKey);
      if (op.kind === "add") {
        await addShelfUnit.mutateAsync({
          shelfId,
          input: { unitId, kind: "book" },
        });
      } else {
        await removeShelfUnit.mutateAsync({ shelfId, shelfUnitId: unitId });
      }
    },
    [addShelfUnit, removeShelfUnit, resolveSystemShelfId, unitId],
  );

  const showRetryToast = useCallback(
    (retryKey: string, message: () => string, retry: () => Promise<void>) => {
      if (inFlightRetries.current.has(retryKey)) return;
      toast.error(message(), {
        action: {
          label: common_retry(),
          onClick: () => {
            if (inFlightRetries.current.has(retryKey)) return;
            inFlightRetries.current.add(retryKey);
            retry().finally(() => {
              inFlightRetries.current.delete(retryKey);
            });
          },
        },
      });
    },
    [],
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
          progress_status_toast_both_failed,
          async () => {
            await Promise.allSettled([retryProgress(), retryShelf()]);
          },
        );
      } else if (progressFailed) {
        showRetryToast(
          `${unitId}:progress`,
          progress_status_toast_progress_failed,
          retryProgress,
        );
      } else if (shelfFailed) {
        showRetryToast(
          `${unitId}:shelf`,
          progress_status_toast_shelf_failed,
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
      addShelfUnit.isPending ||
      removeShelfUnit.isPending,
    [
      addShelfUnit.isPending,
      deleteProgress.isPending,
      isSystemShelfPending,
      removeShelfUnit.isPending,
      updateProgress.isPending,
    ],
  );

  return { transition, removeProgress, isPending };
}
