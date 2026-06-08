import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";

type Book = BookDTO;

export type HomeRankingSectionProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeRankingSection
 * A simple top-N ranking using updatedAt desc as a proxy.
 */
export const HomeRankingSection: React.FC<HomeRankingSectionProps> = ({
  title,
  limit = 10,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_ranking");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({
      start: 0,
      limit,
      sort: { type: "updatedAt", order: "desc" },
    }),
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
      <ul className="list-none m-0 p-0">
        {books.map((book, idx) => {
          const title = getBookTitle(book);
          const coverUrl = getBookCoverUrl(book);
          const authorName = getBookAuthorName(book);
          return (
            <li key={book.unitId} className="py-2 flex items-center gap-3">
              <Avatar className="rounded-md">
                {coverUrl ? (
                  <AvatarImage src={coverUrl} alt={title} />
                ) : (
                  <AvatarFallback>{idx + 1}</AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {idx + 1}
                  </span>
                  <span className="truncate" title={title}>
                    {title}
                  </span>
                </div>
                <div className="text-xs text-text-secondary truncate pl-10">
                  {authorName}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
