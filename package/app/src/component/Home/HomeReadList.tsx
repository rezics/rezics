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

type Book = BookDTO;

export type HomeReadListProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeReadList
 * Horizontal scroll list of books (simulating a read list recommendation section)
 */
export const HomeReadList: React.FC<HomeReadListProps> = ({
  title = '书单推荐',
  limit = 12,
}) => {
  const {data, isLoading, error} = useQuery(
    bookQueries.list({start: 0, limit, q: ''}),
  );
  const books: Book[] = useMemo(() => data?.books ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {title}
        </Typography>
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
      <div className="flex gap-4 overflow-x-auto pb-2">
        {books.map(book => (
          <Card
            key={book.unitId}
            className="min-w-[160px] max-w-[160px] overflow-hidden"
          >
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-48 object-cover"
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

export default HomeReadList;
