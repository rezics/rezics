import {
  Avatar,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
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
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("page.home.sections.ranking");

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
      <List dense>
        {books.map((book, idx) => {
          const title = getBookTitle(book);
          const coverUrl = getBookCoverUrl(book);
          const authorName = getBookAuthorName(book);
          return (
            <ListItem key={book.unitId} className="!py-2">
              <ListItemAvatar>
                {coverUrl ? (
                  <Avatar variant="rounded" src={coverUrl} alt={title} />
                ) : (
                  <Avatar variant="rounded">{idx + 1}</Avatar>
                )}
              </ListItemAvatar>
              <ListItemText
                primary={
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-6 text-right">
                      {idx + 1}
                    </span>
                    <span className="truncate" title={title}>
                      {title}
                    </span>
                  </div>
                }
                secondary={authorName}
              />
            </ListItem>
          );
        })}
      </List>
    </div>
  );
};

export default HomeRankingSection;
