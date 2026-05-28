import { useUnitProgress } from "@rezics/api/progress/progress.queries";
import type { UserUnitProgressStatus } from "@rezics/contract";
import {
  book_hero_actions_mark_as_read,
  book_hero_actions_read_again,
  book_hero_actions_start_reading,
  book_hero_actions_want_to_read,
} from "@rezics/i18n/messages";
import {
  type ReactiveMessageBag,
  useLocale,
  useMessage,
} from "@rezics/i18n/react";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { ActiveProgressModal } from "../components/ActiveProgressModal";
import { BacklogRemoveConfirmModal } from "../components/BacklogRemoveConfirmModal";
import { CompletedConfirmModal } from "../components/CompletedConfirmModal";
import { ReasonModal } from "../components/ReasonModal";
import { StatusOverflowMenu } from "../components/StatusOverflowMenu";
import {
  HERO_STATUS_ITEM_CLASS,
  StatusPrimaryActionButton,
  StatusToggleGroup,
} from "../components/StatusToggleGroup";
import { useReasonPostMutations } from "../hooks/useReasonPostMutations";
import { useStatusTransition } from "../hooks/useStatusTransition";
import {
  appendReasonPostId,
  getReasonPostIds,
  type ReasonStatus,
} from "../models/extra";
import { isToggleGroupStatus, type ToggleGroupStatus } from "../models/status";
import {
  closeStatusModalAtom,
  openStatusModalAtom,
  statusModalAtom,
} from "../states/statusModalAtom";

const i18nMessages = {
  book_hero_actions_mark_as_read,
  book_hero_actions_read_again,
  book_hero_actions_start_reading,
  book_hero_actions_want_to_read,
};

type ProgressMessages = ReactiveMessageBag<typeof i18nMessages>;

export type BookProgressStatusSectionProps = {
  bookUnitId: string;
};

function isReasonStatus(
  status: UserUnitProgressStatus,
): status is ReasonStatus {
  return status === "PAUSED" || status === "DROPPED";
}

function usesChineseProgressLayout(language: string | undefined) {
  return language?.toLowerCase().startsWith("zh") ?? false;
}

function getDefaultPrimaryAction(
  status: UserUnitProgressStatus | null,
  m: ProgressMessages,
): {
  status: ToggleGroupStatus;
  label: string;
} {
  if (!status) {
    return {
      status: "BACKLOG",
      label: m.book_hero_actions_want_to_read(),
    };
  }

  if (status === "ACTIVE") {
    return {
      status: "COMPLETED",
      label: m.book_hero_actions_mark_as_read(),
    };
  }

  if (status === "COMPLETED") {
    return {
      status: "COMPLETED",
      label: m.book_hero_actions_read_again(),
    };
  }

  return {
    status: "ACTIVE",
    label: m.book_hero_actions_start_reading(),
  };
}

export function BookProgressStatusSection({
  bookUnitId,
}: BookProgressStatusSectionProps) {
  const language = useLocale();
  const m = useMessage(i18nMessages);
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
        if (currentStatus === "BACKLOG") {
          openModal({ kind: "removeBacklog", status: "BACKLOG" });
          return;
        }
        void transition({ to: "BACKLOG" });
        return;
      }
      if (next === "ACTIVE") {
        openModal({
          kind: "active",
          status: "ACTIVE",
          draft: {
            progress: progress.data?.progress ?? 0,
            lastReadNodeId: progress.data?.lastReadNodeId ?? null,
          },
        });
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

  const handlePaused = useCallback(() => {
    openModal({ kind: "reason", status: "PAUSED" });
  }, [openModal]);

  const handleRemoveProgress = useCallback(() => {
    void removeProgress();
  }, [removeProgress]);

  const handleRemoveBacklogConfirm = useCallback(async () => {
    await removeProgress();
  }, [removeProgress]);

  const handleActiveSave = useCallback(
    async (payload: { progress: number; lastReadNodeId: string | null }) => {
      await transition({
        to: "ACTIVE",
        progress: payload.progress,
        lastReadNodeId: payload.lastReadNodeId,
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
  const isChineseLayout = usesChineseProgressLayout(language);
  const primaryAction = getDefaultPrimaryAction(currentStatus, m);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="grid w-full grid-cols-4 overflow-hidden rounded-full border border-white/25 bg-transparent divide-x divide-white/15">
        {isChineseLayout ? (
          <StatusToggleGroup
            value={toggleValue}
            onValueChange={handleSelect}
            disabled={isPending}
            className="col-span-3 grid-cols-3 divide-x divide-white/15"
            itemClassName={HERO_STATUS_ITEM_CLASS}
          />
        ) : (
          <StatusPrimaryActionButton
            status={primaryAction.status}
            label={primaryAction.label}
            onClick={() => handleSelect(primaryAction.status)}
            disabled={isPending}
            className="col-span-3"
          />
        )}
        <StatusOverflowMenu
          onSelectBacklog={() => handleSelect("BACKLOG")}
          onSelectActive={() => handleSelect("ACTIVE")}
          onSelectCompleted={() => handleSelect("COMPLETED")}
          onSelectPaused={handlePaused}
          onSelectDropped={handleDropped}
          onRemoveProgress={handleRemoveProgress}
          disabled={isPending}
          currentStatus={currentStatus}
          isActive={currentStatus === "PAUSED" || currentStatus === "DROPPED"}
          showPrimaryStatuses={!isChineseLayout}
        />
      </div>

      <ActiveProgressModal
        open={modal.kind === "active"}
        bookUnitId={bookUnitId}
        initialProgress={modal.draft.progress}
        initialLastReadNodeId={modal.draft.lastReadNodeId}
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

      <BacklogRemoveConfirmModal
        open={modal.kind === "removeBacklog"}
        onCancel={closeModal}
        onConfirm={handleRemoveBacklogConfirm}
        isPending={isPending}
      />
    </div>
  );
}
