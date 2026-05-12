import type {
  ProgressExtra,
  UnitLastPosition,
  UserUnitProgressStatus,
} from "@rezics/contract";
import {
  useDeleteUnitProgress,
  useUpdateUnitProgress,
} from "@rezics/api/progress/progress.mutations";
import {
  useAddShelfUnitMutation,
  useRemoveShelfUnitMutation,
} from "@rezics/api/shelf/shelf.mutations";
import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  type ShelfOp,
  planRemoveProgress,
  planTransition,
} from "../models/transition";
import { useSystemShelfIds } from "./useSystemShelfIds";

export type StatusTransitionPayload = {
  to: UserUnitProgressStatus;
  progress?: number;
  lastPosition?: UnitLastPosition | null;
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
  const { t } = useTranslation();
  const { getShelfId } = useSystemShelfIds();

  const updateProgress = useUpdateUnitProgress(unitId);
  const deleteProgress = useDeleteUnitProgress(unitId);
  const addShelfUnit = useAddShelfUnitMutation();
  const removeShelfUnit = useRemoveShelfUnitMutation();

  const inFlightRetries = useRef(new Set<string>());

  const runShelfOp = useCallback(
    async (op: ShelfOp) => {
      const shelfId = getShelfId(op.shelfKey);
      if (!shelfId) {
        throw new Error(`No shelf id for ${op.shelfKey}`);
      }
      if (op.kind === "add") {
        await addShelfUnit.mutateAsync({
          shelfId,
          input: { unitId, kind: "book" },
        });
      } else {
        await removeShelfUnit.mutateAsync({ shelfId, childUnitId: unitId });
      }
    },
    [addShelfUnit, getShelfId, removeShelfUnit, unitId],
  );

  const showRetryToast = useCallback(
    (
      retryKey: string,
      messageKey: string,
      defaultMessage: string,
      retry: () => Promise<void>,
    ) => {
      if (inFlightRetries.current.has(retryKey)) return;
      toast.error(t(messageKey, defaultMessage), {
        action: {
          label: t("common.retry", "重試"),
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
    [t],
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
          "progress_status.toast.both_failed",
          "進度與書架更新失敗",
          async () => {
            await Promise.allSettled([retryProgress(), retryShelf()]);
          },
        );
      } else if (progressFailed) {
        showRetryToast(
          `${unitId}:progress`,
          "progress_status.toast.progress_failed",
          "進度更新失敗",
          retryProgress,
        );
      } else if (shelfFailed) {
        showRetryToast(
          `${unitId}:shelf`,
          "progress_status.toast.shelf_failed",
          "書架更新失敗",
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
          lastPosition: payload.lastPosition,
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

  const removeProgress = useCallback(async (): Promise<StatusTransitionFailure> => {
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
      addShelfUnit.isPending ||
      removeShelfUnit.isPending,
    [
      addShelfUnit.isPending,
      deleteProgress.isPending,
      removeShelfUnit.isPending,
      updateProgress.isPending,
    ],
  );

  return { transition, removeProgress, isPending };
}
