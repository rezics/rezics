import { IconButton } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { chapterDetailQuery } from "@rezics/api/chapter/chapter";
import { useCanEdit } from "@rezics/api/hooks";
import { createRezicsRenderer } from "@rezics/editor/markdown";
import { handleExternalLinkClick } from "@rezics/ui/link/handleExternalLinkClick.ts";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { bookReadLayoutRoute } from "@/router";
import { Pencil as EditOutlined } from "lucide-react";

export const BookReadChapterPage: React.FC = () => {
  const { bookId, chapterId } = bookReadLayoutRoute.useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isPending, error, isError } = useQuery(
    chapterDetailQuery(chapterId),
  );
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId ?? ""),
    enabled: Boolean(bookId),
  });

  const canEdit = useCanEdit({ resource: "chapter", ownerUnit: bookInfo });

  const md = createRezicsRenderer();
  const chapterHtml = md.render(data?.content || "");

  if (isPending) return <div>Loading...</div>;
  if (isError) return <QueryErrorDisplay error={error} />;

  return (
    <div className="w-11/12 mx-auto p-4">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-2xl font-bold">{data?.title}</h1>
        {canEdit && bookId && chapterId && (
          <IconButton
            size="small"
            aria-label={t("common.edit")}
            onClick={() =>
              navigate({ to: `/book/${bookId}/edit/${chapterId}` })
            }
          >
            <EditOutlined fontSize="small" />
          </IconButton>
        )}
      </div>
      <div id="markdown-chapter-content" className="markdown-body">
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: intentional HTML rendering */}
        <div
          onClick={handleExternalLinkClick}
          dangerouslySetInnerHTML={{ __html: chapterHtml }}
        />
      </div>
    </div>
  );
};
