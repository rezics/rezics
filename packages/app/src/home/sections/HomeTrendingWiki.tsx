import { bookQueries } from "@rezics/contract/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { QueryErrorDisplay } from "@/core";
import { getBookTitle } from "@/shared/utils/translation-helpers";

type Book = BookDTO;

export type HomeTrendingWikiProps = {
  title?: string;
  limit?: number;
};

export const HomeTrendingWiki: React.FC<HomeTrendingWikiProps> = ({
  title,
  limit = 6,
}) => {
  const { t } = useTranslation(["page"]);
  const resolvedTitle = title ?? t("page:home_sections_trending_wiki");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );
  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <h2 className="text-base font-semibold mb-3">{resolvedTitle}</h2>
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold m-0">{resolvedTitle}</h2>
        {isLoading && <Spinner size="sm" />}
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {books.map((book) => (
          <Card key={book.unitId} surface="contained">
            <CardContent>
              <p className="text-sm font-medium mb-1">{getBookTitle(book)}</p>
              <p className="text-sm text-text-secondary line-clamp-3 m-0">
                {t("page:home_sections_wiki_teaser_placeholder")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
