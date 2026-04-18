import { Card, CardContent, CircularProgress, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";

type Book = BookDTO;

export type HomeEditorPicksProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeEditorPicks
 * For now, shows a curated-style grid from the same list API.
 */
export const HomeEditorPicks: React.FC<HomeEditorPicksProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.editor_picks");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );
  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <Typography variant="h6">{resolvedTitle}</Typography>
        {isLoading && <CircularProgress size={20} />}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {books.map((book) => {
          const title = getBookTitle(book);
          const coverUrl = getBookCoverUrl(book);
          const authorName = getBookAuthorName(book);
          return (
            <Card key={book.unitId} className="overflow-hidden">
              {coverUrl && (
                <LazyLoadImage
                  src={coverUrl}
                  alt={title}
                  className="w-full h-40 object-cover"
                />
              )}
              <CardContent className="!pt-3">
                <Typography
                  variant="subtitle2"
                  className="truncate"
                  title={title}
                >
                  {title}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  className="truncate"
                >
                  {authorName}
                </Typography>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default HomeEditorPicks;
