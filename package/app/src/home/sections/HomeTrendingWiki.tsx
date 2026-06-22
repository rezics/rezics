import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { getBookTitle } from "@/shared/utils/translation-helpers";
import { HomeSectionShell } from "./HomeSectionShell";

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

  return (
    <HomeSectionShell title={resolvedTitle} isLoading={isLoading} error={error}>
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
    </HomeSectionShell>
  );
};
