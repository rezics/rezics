import React, {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  Alert,
  CircularProgress,
  Typography,
  Card,
  CardContent,
} from '@mui/material';
import {bookQueries} from '@/api/book/book';
import type {BookDTO} from '@package/contract';
import {LazyLoadImage} from '../Common/LazyLoadImage';

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
  title = '新书推荐',
  limit = 12,
}) => {
  const {data, isLoading, error} = useQuery(
    bookQueries.list({
      start: 0,
      limit,
      sort: {type: 'createdAt', order: 'desc'},
    }),
  );

  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-3">
          <Typography variant="h6">{title}</Typography>
        </div>
        <Alert severity="error">{String(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <Typography variant="h6">{title}</Typography>
        {isLoading && <CircularProgress size={20} />}
      </div>
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {books.map(book => (
          <Card key={book.unitId} className="overflow-hidden">
            {book.coverUrl && (
              <LazyLoadImage
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-44 object-cover"
              />
            )}
            <CardContent className="!pt-3">
              <Typography
                variant="subtitle2"
                className="truncate"
                title={book.title}
              >
                {book.title}
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                className="truncate"
              >
                {book.author?.[0]?.name || ''}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomeNewReleases;
