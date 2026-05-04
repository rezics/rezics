import { Card, CardContent } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
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
        <h6 className="text-base font-semibold mb-3">{resolvedTitle}</h6>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h6 className="text-base font-semibold m-0">{resolvedTitle}</h6>
        {isLoading && <Spinner size="sm" />}
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
                <p className="text-sm font-medium truncate m-0" title={title}>
                  {title}
                </p>
                <p className="text-xs text-text-secondary truncate m-0">
                  {authorName}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default HomeEditorPicks;
