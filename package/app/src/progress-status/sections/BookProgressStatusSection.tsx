import type { UserUnitProgressStatus } from "@rezics/contract";
import { useUnitProgress } from "@rezics/api/progress/progress.queries";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { ActiveProgressModal } from "../components/ActiveProgressModal";
import { CompletedConfirmModal } from "../components/CompletedConfirmModal";
import { ReasonModal } from "../components/ReasonModal";
import { StatusOverflowMenu } from "../components/StatusOverflowMenu";
import { StatusToggleGroup } from "../components/StatusToggleGroup";
import { useReasonPostMutations } from "../hooks/useReasonPostMutations";
import { useStatusTransition } from "../hooks/useStatusTransition";
import {
  appendReasonPostId,
  getReasonPostIds,
  type ReasonStatus,
} from "../models/extra";
import {
  isToggleGroupStatus,
  type ToggleGroupStatus,
} from "../models/status";
import {
  closeStatusModalAtom,
  openStatusModalAtom,
  statusModalAtom,
} from "../states/statusModalAtom";

export type BookProgressStatusSectionProps = {
  bookUnitId: string;
};

function isReasonStatus(status: UserUnitProgressStatus): status is ReasonStatus {
  return status === "PAUSED" || status === "DROPPED";
}

export function BookProgressStatusSection({
  bookUnitId,
}: BookProgressStatusSectionProps) {
  const progress = useUnitProgress(bookUnitId);
  const currentStatus: UserUnitProgressStatus | null =
    progress.data?.status ?? null;

  const { transition, removeProgress, isPending } = useStatusTransition(
    bookUnitId,
    currentStatus,
  );

  const { createReasonPost, updateReasonPost } = useReasonPostMutations();

  const [modal] = useAtom(statusModalAtom);
  const openModal = useSetAtom(openStatusModalAtom);
  const closeModal = useSetAtom(closeStatusModalAtom);

  const handleSelect = useCallback(
    (next: ToggleGroupStatus) => {
      if (next === "BACKLOG") {
        if (currentStatus === "BACKLOG") return;
        void transition({ to: "BACKLOG" });
        return;
      }
      if (next === "ACTIVE") {
        openModal({
          kind: "active",
          status: "ACTIVE",
          draft: {
            progress: progress.data?.progress ?? 0,
            lastPosition: progress.data?.lastPosition ?? null,
          },
        });
        return;
      }
      if (next === "PAUSED") {
        openModal({ kind: "reason", status: "PAUSED" });
        return;
      }
      if (next === "COMPLETED") {
        openModal({ kind: "completed", status: "COMPLETED" });
        return;
      }
    },
    [currentStatus, openModal, progress.data, transition],
  );

  const handleDropped = useCallback(() => {
    openModal({ kind: "reason", status: "DROPPED" });
  }, [openModal]);

  const handleRemoveProgress = useCallback(() => {
    void removeProgress();
  }, [removeProgress]);

  const handleActiveSave = useCallback(
    async (payload: {
      progress: number;
      lastPosition: import("@rezics/contract").UnitLastPosition | null;
    }) => {
      await transition({
        to: "ACTIVE",
        progress: payload.progress,
        lastPosition: payload.lastPosition,
      });
      closeModal();
    },
    [closeModal, transition],
  );

  const handleReasonSkip = useCallback(async () => {
    if (!modal.status || !isReasonStatus(modal.status)) return;
    await transition({ to: modal.status });
    closeModal();
  }, [closeModal, modal.status, transition]);

  const handleReasonSave = useCallback(
    async ({
      body,
      visibility,
    }: {
      body: string;
      visibility: "PUBLIC" | "UNLISTED";
    }) => {
      if (!modal.status || !isReasonStatus(modal.status)) return;
      const reasonStatus = modal.status;
      const ids = getReasonPostIds(progress.data?.extra ?? null, reasonStatus);
      const latestId = ids[ids.length - 1];

      if (latestId) {
        await updateReasonPost({
          postUnitId: latestId,
          body,
          visibility,
        });
        await transition({
          to: reasonStatus,
          extra: progress.data?.extra ?? null,
        });
      } else {
        const created = await createReasonPost({
          unitId: bookUnitId,
          body,
          visibility,
        });
        const nextExtra = appendReasonPostId(
          progress.data?.extra ?? null,
          reasonStatus,
          created.unitId,
        );
        await transition({ to: reasonStatus, extra: nextExtra });
      }

      closeModal();
    },
    [
      bookUnitId,
      closeModal,
      createReasonPost,
      modal.status,
      progress.data?.extra,
      transition,
      updateReasonPost,
    ],
  );

  const handleReasonAppend = useCallback(
    async ({
      body,
      visibility,
    }: {
      body: string;
      visibility: "PUBLIC" | "UNLISTED";
    }) => {
      if (!modal.status || !isReasonStatus(modal.status)) return;
      const reasonStatus = modal.status;
      const created = await createReasonPost({
        unitId: bookUnitId,
        body,
        visibility,
      });
      const nextExtra = appendReasonPostId(
        progress.data?.extra ?? null,
        reasonStatus,
        created.unitId,
      );
      await transition({ to: reasonStatus, extra: nextExtra });
      closeModal();
    },
    [
      bookUnitId,
      closeModal,
      createReasonPost,
      modal.status,
      progress.data?.extra,
      transition,
    ],
  );

  const handleCompletedConfirm = useCallback(async () => {
    await transition({
      to: "COMPLETED",
      progress: 1,
      completedCount: (progress.data?.completedCount ?? 0) + 1,
    });
  }, [progress.data?.completedCount, transition]);

  const toggleValue: ToggleGroupStatus | null =
    currentStatus && isToggleGroupStatus(currentStatus) ? currentStatus : null;

  const reasonStatusForModal: ReasonStatus | null =
    modal.kind === "reason" && modal.status && isReasonStatus(modal.status)
      ? modal.status
      : null;

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-stretch gap-2">
        <StatusToggleGroup
          value={toggleValue}
          onValueChange={handleSelect}
          disabled={isPending}
        />
        <StatusOverflowMenu
          onSelectDropped={handleDropped}
          onRemoveProgress={handleRemoveProgress}
          disabled={isPending}
        />
      </div>

      <ActiveProgressModal
        open={modal.kind === "active"}
        bookUnitId={bookUnitId}
        initialProgress={modal.draft.progress}
        initialLastPosition={modal.draft.lastPosition}
        onCancel={closeModal}
        onSave={handleActiveSave}
        isPending={isPending}
      />

      {reasonStatusForModal && (
        <ReasonModal
          open={modal.kind === "reason"}
          status={reasonStatusForModal}
          reasonPostUnitIds={getReasonPostIds(
            progress.data?.extra ?? null,
            reasonStatusForModal,
          )}
          onCancel={closeModal}
          onSkip={handleReasonSkip}
          onSave={handleReasonSave}
          onAppend={handleReasonAppend}
          isPending={isPending}
        />
      )}

      <CompletedConfirmModal
        open={modal.kind === "completed"}
        currentCount={progress.data?.completedCount ?? 0}
        onCancel={closeModal}
        onConfirm={handleCompletedConfirm}
        isPending={isPending}
      />
    </div>
  );
}
