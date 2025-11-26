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

export type HomeTrendingReviewsProps = {
  title?: string;
  limit?: number;
};

/**
 * HomeTrendingReviews
 * Placeholder: uses books as anchors to show review-like snippets.
 */
export const HomeTrendingReviews: React.FC<HomeTrendingReviewsProps> = ({
  title = '热门短评',
  limit = 6,
}) => {
  const {data, isLoading, error} = useQuery(
    bookQueries.list({start: 0, limit}),
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
                “这本书让我重新思考了……（示例占位短评）”
              </Typography>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HomeTrendingReviews;
