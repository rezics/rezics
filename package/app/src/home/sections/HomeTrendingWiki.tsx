import { Card, CardContent } from "@rezics/ui/shadcn";
import { Spinner } from "@rezics/ui";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
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
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.trending_wiki");

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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {books.map((book) => (
          <Card key={book.unitId} className="overflow-hidden">
            <CardContent>
              <p className="text-sm font-medium mb-1">{getBookTitle(book)}</p>
              <p className="text-sm text-text-secondary line-clamp-3 m-0">
                {t("page.home.sections.wiki_teaser_placeholder")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomeTrendingWiki;
