import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  CircularProgress,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import { bookQueries } from '@package/api/book/book';
import type { BookDTO } from '@package/contract';
import { useTranslation } from 'react-i18next';

type Book = BookDTO;

export type HomeTrendingWikiProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeTrendingWiki
 * Placeholder: uses books as entries to show wiki-like teaser content.
 */
export const HomeTrendingWiki: React.FC<HomeTrendingWikiProps> = ({
  title,
  limit = 6,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('page.home.sections.trending_wiki');

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );
  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {books.map(book => (
          <Card key={book.unitId} className="overflow-hidden">
            <CardContent>
              <Typography variant="subtitle2" className="mb-1">
                {book.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                className="line-clamp-3"
              >
                {t('page.home.sections.wiki_teaser_placeholder')}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomeTrendingWiki;
