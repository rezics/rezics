import {
  useDeleteUnitProgress,
  useUpdateUnitProgress,
} from "@rezics/api/progress/progress.mutations";
import type { UserUnitProgressStatus } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { useMemo } from "react";
import { useRetryToast } from "@/shared/hooks/useRetryToast";
export type StatusTransitionPayload = {
  to: UserUnitProgressStatus;
  progress?: number;
  lastReadNodeId?: string | null;
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
  _currentStatus: UserUnitProgressStatus | null,
): UseStatusTransitionResult {
  const updateProgress = useUpdateUnitProgress(unitId);
  const deleteProgress = useDeleteUnitProgress(unitId);

  const showRetryToast = useRetryToast();

  const handlePartialFailure = (
    progressFailed: boolean,
    retryProgress: () => Promise<void>,
  ) => {
    if (progressFailed) {
      showRetryToast(
        `${unitId}:progress`,
        getI18nRuntime().i18n.t(
          "community:progress_status_toast_progress_failed",
        ),
        retryProgress,
      );
    }
  };

  const transition = async (
    payload: StatusTransitionPayload,
  ): Promise<StatusTransitionFailure> => {
    const writeProgress = async () => {
      await updateProgress.mutateAsync({
        status: payload.to,
        progress: payload.progress,
        lastReadNodeId: payload.lastReadNodeId,
        completedCount: payload.completedCount,
      });
    };

    const progressResult = await writeProgress().then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error }),
    );

    const progressFailed = !progressResult.ok;

    handlePartialFailure(progressFailed, () => writeProgress());

    return { progress: progressFailed, shelf: false };
  };

  const removeProgress = async (): Promise<StatusTransitionFailure> => {
    const runDelete = async () => {
      await deleteProgress.mutateAsync();
    };

    const progressResult = await runDelete().then(
      () => ({ ok: true as const }),
      (error) => ({ ok: false as const, error }),
    );

    const progressFailed = !progressResult.ok;

    handlePartialFailure(progressFailed, () => runDelete());

    return { progress: progressFailed, shelf: false };
  };

  const isPending = useMemo(
    () => updateProgress.isPending || deleteProgress.isPending,
    [deleteProgress.isPending, updateProgress.isPending],
  );

  return { transition, removeProgress, isPending };
}
