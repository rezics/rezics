import { useToggleNodeCompletion, useUpdateUnitProgress } from "@rezics/api";
import { useCurrentUserId } from "@rezics/api/hooks";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { contentDocMarkdownFallback } from "@rezics/contract";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { useTranslation } from "@rezics/i18n/react";
import { handleExternalLinkClick } from "@rezics/ui/link/handleExternalLinkClick.ts";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditOutlined } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

type ReadingNodeViewProps = {
  bookUnitId: string;
  nodeId: string;
  title: string;
  contentUnitId: string;
  canEdit?: boolean;
  initialIsCompleted?: boolean;
};

export const ReadingNodeView: React.FC<ReadingNodeViewProps> = ({
  bookUnitId,
  nodeId,
  title,
  contentUnitId,
  canEdit = false,
  initialIsCompleted = false,
}) => {
  const { t } = useTranslation(["book", "common"]);
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const { data, isPending, error, isError } = useQuery(
    chapterDetailQuery(contentUnitId),
  );
  const updateProgress = useUpdateUnitProgress(bookUnitId);
  const toggleCompletion = useToggleNodeCompletion(bookUnitId);
  const [isCompleted, setIsCompleted] = useState(initialIsCompleted);

  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberate — record the resume position only when the node changes
  useEffect(() => {
    // Skip progress update for unauthenticated visitors.
    // 未认证的访客跳过进度更新。
    if (!userId) return;
    updateProgress.mutate({ status: "ACTIVE", lastReadNodeId: nodeId });
  }, [nodeId, userId]);

  const handleToggle = () => {
    // Require auth before toggling completion.
    // 切换完成状态前需要认证。
    if (!userId) return;
    const next = !isCompleted;
    setIsCompleted(next);
    toggleCompletion.mutate(
      { nodeId, isCompleted: next },
      { onError: () => setIsCompleted(!next) },
    );
  };

  if (isPending) return <div>{t("common:loading")}</div>;
  if (isError)
    return (
      <div>
        {t("book:reading_error_loading_chapter", { error: String(error) })}
      </div>
    );

  const md = createRezicsRenderer();
  const html = md.render(contentDocMarkdownFallback(data?.content));

  return (
    <div className="w-full mx-auto px-4 pt-4 pb-4">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="text-2xl font-bold truncate">
            {data?.title ?? title}
          </h1>
          {canEdit && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("common:edit")}
              onClick={() =>
                navigate({
                  to: "/book/$bookId/edit/$chapterId",
                  params: { bookId: bookUnitId, chapterId: contentUnitId },
                })
              }
            >
              <EditOutlined className="w-4 h-4" />
            </Button>
          )}
        </div>
        <Button
          type="button"
          variant={isCompleted ? "default" : "outline"}
          onClick={handleToggle}
          disabled={toggleCompletion.isPending}
        >
          {isCompleted
            ? t("book:hero_actions_marked_as_read")
            : t("book:hero_actions_mark_as_read")}
        </Button>
      </div>
      <div id="markdown-chapter-content" className="markdown-body">
        {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated click handler only intercepts links in rendered markdown. */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: markdown links remain keyboard-accessible as native anchors. */}
        <div
          onClick={handleExternalLinkClick}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
};
