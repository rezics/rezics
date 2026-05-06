import { bookQueries } from "@rezics/api/book/book";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { useCanEdit } from "@rezics/api/hooks";
import { progressApi, useUpdateUnitProgress } from "@rezics/api";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { handleExternalLinkClick } from "@rezics/ui/link/handleExternalLinkClick.ts";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditOutlined } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { bookReadLayoutRoute } from "@/router";
import { PostListSection, ReplyComposer } from "@/post";
import {
  EMPTY_CHAPTER_ROUTE_ID,
  decodeBookIndexPath,
  findBookIndexOccurrence,
  withBookIndexOccurrences,
} from "@/book-library/models/bookIndexPath";
import { useEnsureChapterUnit } from "@/book-library/hooks/useEnsureChapterUnit";

export const BookReadChapterPage: React.FC = () => {
  const { bookId, chapterId } = bookReadLayoutRoute.useParams();
  const search = bookReadLayoutRoute.useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [chapterDiscussionUnitId, setChapterDiscussionUnitId] = useState<
    string | null
  >(null);
  const [pendingChapterAction, setPendingChapterAction] = useState<
    "content" | "review" | "discussion" | "progress" | null
  >(null);
  const emptyChapterPath =
    chapterId === EMPTY_CHAPTER_ROUTE_ID
      ? decodeBookIndexPath(search.path)
      : null;

  const { data, isPending, error, isError } = useQuery({
    ...chapterDetailQuery(chapterId),
    enabled: !emptyChapterPath,
  });
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId ?? ""),
    enabled: Boolean(bookId),
  });
  const { data: bookIndex } = useQuery({
    ...bookQueries.chapterIndex(bookId ?? ""),
    enabled: Boolean(bookId && emptyChapterPath),
  });
  const updateBookProgress = useUpdateUnitProgress(bookId ?? "");
  const ensureChapterUnit = useEnsureChapterUnit(bookId ?? "");

  const canEdit = useCanEdit({ resource: "chapter", ownerUnit: bookInfo });

  const md = createRezicsRenderer();
  const emptyChapter = emptyChapterPath
    ? findBookIndexOccurrence(
        withBookIndexOccurrences(bookIndex?.index ?? []),
        emptyChapterPath,
      )
    : null;
  const title = emptyChapter?.title ?? search.title ?? data?.title;
  const chapterHtml = md.render(data?.content || "");

  const handleSaveBookPosition = () => {
    if (!bookId || !emptyChapterPath) return;
    updateBookProgress.mutate({
      status: "ACTIVE",
      lastPosition: {
        kind: "bookIndexPath",
        bookUnitId: bookId,
        path: emptyChapterPath,
        ...(emptyChapter?.chapterUnitId
          ? { chapterUnitId: emptyChapter.chapterUnitId }
          : {}),
      },
    });
  };

  const ensureEmptyChapterUnit = async () => {
    if (!emptyChapterPath) {
      throw new Error("Cannot materialize without a BookIndex path");
    }
    return ensureChapterUnit({
      title: title ?? "",
      path: emptyChapterPath,
      chapterUnitId: emptyChapter?.chapterUnitId,
    });
  };

  const handleEditEmptyChapter = async () => {
    if (!bookId) return;
    setPendingChapterAction("content");
    try {
      const chapterUnitId = await ensureEmptyChapterUnit();
      navigate({
        to: "/book/$bookId/edit/$chapterId",
        params: { bookId, chapterId: chapterUnitId },
      });
    } finally {
      setPendingChapterAction(null);
    }
  };

  const handleReviewEmptyChapter = async () => {
    setPendingChapterAction("review");
    try {
      const chapterUnitId = await ensureEmptyChapterUnit();
      navigate({
        to: "/review/new/$bookUnitId",
        params: { bookUnitId: chapterUnitId },
      });
    } finally {
      setPendingChapterAction(null);
    }
  };

  const handleDiscussEmptyChapter = async () => {
    setPendingChapterAction("discussion");
    try {
      const chapterUnitId = await ensureEmptyChapterUnit();
      setChapterDiscussionUnitId(chapterUnitId);
    } finally {
      setPendingChapterAction(null);
    }
  };

  const handleSaveChapterProgress = async () => {
    setPendingChapterAction("progress");
    try {
      const chapterUnitId = await ensureEmptyChapterUnit();
      await progressApi.updateUnitProgress(chapterUnitId, {
        status: "ACTIVE",
        lastPosition: {
          kind: "chapter",
          chapterUnitId,
        },
      });
    } finally {
      setPendingChapterAction(null);
    }
  };

  if (!emptyChapterPath && isPending) return <div>Loading...</div>;
  if (isError) return <QueryErrorDisplay error={error} />;

  return (
    <div className="w-11/12 mx-auto p-4">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        {canEdit && bookId && chapterId && !emptyChapterPath && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label={t("common.edit")}
            onClick={() =>
              navigate({ to: `/book/${bookId}/edit/${chapterId}` })
            }
          >
            <EditOutlined className="w-4 h-4" />
          </Button>
        )}
      </div>
      {emptyChapterPath ? (
        <div className="max-w-prose text-text-secondary leading-relaxed">
          <p>
            This chapter is listed in the table of contents but has no saved
            content yet.
          </p>
          <p className="mt-3">
            You can still open chapter actions for content, discussion, reviews,
            and reading progress.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={handleSaveBookPosition}
            disabled={updateBookProgress.isPending}
          >
            {updateBookProgress.isPending
              ? t("book.read.position.saving", "Saving position...")
              : t("book.read.position.save", "Save reading position")}
          </Button>
          <div className="mt-5 flex flex-wrap gap-2">
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleEditEmptyChapter}
                disabled={pendingChapterAction !== null}
              >
                {pendingChapterAction === "content"
                  ? t("book.read.chapter_actions.preparing", "Preparing...")
                  : t("book.read.chapter_actions.content", "Edit content")}
              </Button>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={handleReviewEmptyChapter}
              disabled={pendingChapterAction !== null}
            >
              {pendingChapterAction === "review"
                ? t("book.read.chapter_actions.preparing", "Preparing...")
                : t("book.read.chapter_actions.review", "Write chapter review")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleDiscussEmptyChapter}
              disabled={pendingChapterAction !== null}
            >
              {pendingChapterAction === "discussion"
                ? t("book.read.chapter_actions.preparing", "Preparing...")
                : t("book.read.chapter_actions.discuss", "Discuss chapter")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleSaveChapterProgress}
              disabled={pendingChapterAction !== null}
            >
              {pendingChapterAction === "progress"
                ? t("book.read.chapter_actions.saving", "Saving...")
                : t("book.read.chapter_actions.progress", "Save chapter progress")}
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
      ) : (
        <div id="markdown-chapter-content" className="markdown-body">
          {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated click handler only intercepts links in rendered markdown. */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: markdown links remain keyboard-accessible as native anchors. */}
          <div
            onClick={handleExternalLinkClick}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering
            dangerouslySetInnerHTML={{ __html: chapterHtml }}
          />
        </div>
      )}
    </div>
  );
};
