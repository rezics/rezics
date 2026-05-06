import { bookQueries } from "@rezics/api/book/book";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { useCanEdit } from "@rezics/api/hooks";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { handleExternalLinkClick } from "@rezics/ui/link/handleExternalLinkClick.ts";
import { Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Pencil as EditOutlined } from "lucide-react";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { bookReadLayoutRoute } from "@/router";
import {
  EMPTY_CHAPTER_ROUTE_ID,
  decodeBookIndexPath,
  findBookIndexOccurrence,
  withBookIndexOccurrences,
} from "@/book-library/models/bookIndexPath";

export const BookReadChapterPage: React.FC = () => {
  const { bookId, chapterId } = bookReadLayoutRoute.useParams();
  const search = bookReadLayoutRoute.useSearch();
  const { t } = useTranslation();
  const navigate = useNavigate();
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
