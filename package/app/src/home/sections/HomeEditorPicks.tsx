import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { HomeSectionShell } from "./HomeSectionShell";

type Book = BookDTO;

export type HomeEditorPicksProps = {
  title?: string;
  limit?: number;
};

export const HomeEditorPicks: React.FC<HomeEditorPicksProps> = ({
  title,
  limit = 8,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_editor_picks");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );
  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  return (
    <HomeSectionShell title={resolvedTitle} isLoading={isLoading} error={error}>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
        {books.map((book) => {
          const title = getBookTitle(book);
          const coverUrl = getBookCoverUrl(book);
          const authorName = getBookAuthorName(book);
          return (
            <Card key={book.unitId} surface="elevated" className="py-0">
              {coverUrl && (
                <LazyLoadImage
                  src={coverUrl}
                  alt={title}
                  className="w-full h-40 object-cover"
                />
              )}
              <CardContent className="p-3">
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
    </HomeSectionShell>
  );
};
