import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, CircularProgress, Typography, Chip } from '@mui/material';
import { bookQueries } from '@package/api/book/book';
import type { BookDTO } from '@package/contract';
import { useTranslation } from 'react-i18next';
import { Link } from '@/component/Navigation/Link';

type Book = BookDTO;

export type HomeTagExploreProps = {
  title?: string;
  limit?: number; // number of books to sample tags from
  maxTags?: number; // max tags to display
};

/**
 * HomeTagExplore
 * Collects tags from a sampled list of books and shows popular tags.
 */
export const HomeTagExplore: React.FC<HomeTagExploreProps> = ({
  title,
  limit = 60,
  maxTags = 18,
}) => {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t('page.home.sections.tag_explore');

  const { data, isLoading, error } = useQuery(
    bookQueries.list({ start: 0, limit }),
  );

  const tags = useMemo(() => {
    const books: Book[] = data?.books ?? [];
    const freq = new Map<string, number>();
    for (const b of books) {
      for (const tag of b.tags ?? []) {
        freq.set(tag, (freq.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTags)
      .map(([t]) => t);
  }, [data, maxTags]);

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
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Link key={tag} to="/book" search={{ tags: tag }}>
            <Chip label={tag} clickable variant="outlined" />
          </Link>
        ))}
      </div>
    </div>
  );
};

export default HomeTagExplore;
