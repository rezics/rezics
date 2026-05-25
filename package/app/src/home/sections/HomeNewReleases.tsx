import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { page_home_sections_new_book_recommendations } from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";

const i18nMessages = {
  page_home_sections_new_book_recommendations,
};

type Book = BookDTO;

export type HomeNewReleasesProps = {
  title?: string;
  limit?: number;
};

export const HomeNewReleases: React.FC<HomeNewReleasesProps> = ({
  title,
  limit = 12,
}) => {
  const m = useMessage(i18nMessages);
  const resolvedTitle =
    title ?? m.page_home_sections_new_book_recommendations();

  const { data, isLoading, error } = useQuery(
    bookQueries.list({
      start: 0,
      limit,
      sort: { type: "createdAt", order: "desc" },
    }),
  );

  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <h6 className="text-base font-semibold m-0">{resolvedTitle}</h6>
        </div>
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
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
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
                  className="w-full h-44 object-cover"
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

export default HomeNewReleases;
