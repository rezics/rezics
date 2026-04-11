import {
  Alert,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/util/translation-helpers";

type Book = BookDTO;

export type HomeNewReleasesProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeNewReleases
 * - Fetches latest books (createdAt desc) using the standard list query with q left empty
 * - Displays a responsive grid of book cards
 */
export const HomeNewReleases: React.FC<HomeNewReleasesProps> = ({
  title,
  limit = 12,
}) => {
  const { t } = useTranslation();
  const resolvedTitle =
    title ?? t("page.home.sections.new_book_recommendations");

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
          <Typography variant="h6">{resolvedTitle}</Typography>
        </div>
        <Alert severity="error">{String(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <Typography variant="h6">{resolvedTitle}</Typography>
        {isLoading && <CircularProgress size={20} />}
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

export default HomeNewReleases;
