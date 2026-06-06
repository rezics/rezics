import { useUpdateUnitProgress } from "@rezics/api";
import { useTranslation } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { useState } from "react";
import { useEnsureChapterUnit } from "@/book-library/hooks/useEnsureChapterUnit";
import { ReplyComposer } from "@/comment";
import { PostListSection } from "@/post";

type EmptyNodeViewProps = {
  bookUnitId: string;
  nodeId: string;
  title: string;
  canEdit: boolean;
  onMaterialized: (contentUnitId: string) => void;
};

type PendingAction = "content" | "review" | "discussion" | null;

export const EmptyNodeView: React.FC<EmptyNodeViewProps> = ({
  bookUnitId,
  nodeId,
  title,
  canEdit,
  onMaterialized,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const navigate = useNavigate();
  const ensure = useEnsureChapterUnit(bookUnitId);
  const updateBookProgress = useUpdateUnitProgress(bookUnitId);
  const [pending, setPending] = useState<PendingAction>(null);
  const [chapterDiscussionUnitId, setChapterDiscussionUnitId] = useState<
    string | null
  >(null);

  const ensureChapterUnit = () =>
    ensure({ title, nodeId, contentUnitId: undefined });

  const handleSaveBookPosition = () => {
    updateBookProgress.mutate({ status: "ACTIVE", lastReadNodeId: nodeId });
  };

  const handleCreateContent = async () => {
    setPending("content");
    try {
      const contentUnitId = await ensureChapterUnit();
      onMaterialized(contentUnitId);
    } finally {
      setPending(null);
    }
  };

  const handleReview = async () => {
    setPending("review");
    try {
      const contentUnitId = await ensureChapterUnit();
      navigate({
        to: "/review/new/$bookUnitId",
        params: { bookUnitId: contentUnitId },
      });
    } finally {
      setPending(null);
    }
  };

  const handleDiscuss = async () => {
    setPending("discussion");
    try {
      const contentUnitId = await ensureChapterUnit();
      setChapterDiscussionUnitId(contentUnitId);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="w-11/12 mx-auto p-4 max-w-prose">
      <h1 className="text-2xl font-bold mb-2">{title}</h1>
      <div className="text-text-secondary leading-relaxed">
        <p>{t("book:read_empty_chapter_description")}</p>
        <p className="mt-3">{t("book:read_empty_chapter_actions_hint")}</p>
        <Button
          type="button"
          variant="outline"
          className="mt-5"
          onClick={handleSaveBookPosition}
          disabled={updateBookProgress.isPending}
        >
          {updateBookProgress.isPending
            ? t("book:read_position_saving")
            : t("book:read_position_save")}
        </Button>
        <div className="mt-5 flex flex-wrap gap-2">
          {canEdit && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleCreateContent}
              disabled={pending !== null}
            >
              {pending === "content"
                ? t("book:read_chapter_actions_preparing")
                : t("book:read_chapter_actions_content")}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleReview}
            disabled={pending !== null}
          >
            {pending === "review"
              ? t("book:read_chapter_actions_preparing")
              : t("book:read_chapter_actions_review")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleDiscuss}
            disabled={pending !== null}
          >
            {pending === "discussion"
              ? t("book:read_chapter_actions_preparing")
              : t("book:read_chapter_actions_discuss")}
          </Button>
        </div>
        {chapterDiscussionUnitId && (
          <div className="mt-6 flex flex-col gap-4 border-t border-border-whisper pt-5">
            <ReplyComposer
              mode="progressive"
              targetUnitId={chapterDiscussionUnitId}
            />
            <PostListSection targetUnitId={chapterDiscussionUnitId} />
          </div>
        )}
      </div>
    </div>
  );
};
