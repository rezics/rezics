import { Avatar, CircularProgress, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO, PublicUser } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";

type Book = BookDTO;

export type HomeAuthorSpotlightProps = {
  title?: string;
  limit?: number; // number of books to sample authors from
  maxAuthors?: number;
};

/**
 * HomeAuthorSpotlight
 * Collect unique authors from recent books and display them.
 */
export const HomeAuthorSpotlight: React.FC<HomeAuthorSpotlightProps> = ({
  title,
  limit = 24,
  maxAuthors = 12,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.author_spotlight");

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );

  const authors = useMemo(() => {
    const books: Book[] = data?.books ?? [];
    const map = new Map<string, PublicUser>();
    for (const b of books) {
      for (const a of b.author ?? []) {
        if (!map.has(a.unitId)) map.set(a.unitId, a);
      }
      if (map.size >= maxAuthors) break;
    }
    return Array.from(map.values()).slice(0, maxAuthors);
  }, [data, maxAuthors]);

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
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {authors.map((a) => (
          <div
            key={a.unitId}
            className="flex items-center gap-3 p-3 rounded border bg-white"
          >
            <Avatar src={a.avatar || undefined} alt={a.name} />
            <div className="min-w-0">
              <div className="font-medium truncate" title={a.name}>
                {a.name}
              </div>
              {a.bio && (
                <div className="text-xs text-gray-500 truncate" title={a.bio}>
                  {a.bio}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HomeAuthorSpotlight;
