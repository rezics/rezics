import {Card, CardContent, CardMedia, Typography} from '@mui/material';

import {Link} from '@package/ui/Navigation/Link.tsx';

import type {BookDTO} from '@package/contract';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';

// import { Book } from "contract/schema";
type Book = BookDTO;

type BookListViewShowProps = {
  books: Book[];
};

export const BookListViewItem = ({book}: {book: Book}) => {
  return (
    <div>
      <Link to="/book/$bookId" params={{bookId: book.unitId}}>
        <Card className="mt-4 h-[200px] flex flex-row items-stretch gap-4 w-full">
          {book.coverUrl && (
            <CardMedia className="aspect-[2/3]">
              <LazyLoadImage
                src={book.coverUrl}
                alt={book.title}
                // style={{width: '36%', objectFit: 'cover'}}
                className="!h-full object-cover w-full"
              />
            </CardMedia>
          )}
          <CardContent className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <Typography variant="h6" className="mb-1">
                {book.title}
              </Typography>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                className="mb-2"
              >
                {book.author?.[0]?.name || ''}
              </Typography>
              <Typography variant="body2" className="line-clamp-3">
                {book.description}
              </Typography>
            </div>
            {/* 如果需要底部操作按钮之类的，可以放在这里 */}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

export const BookListViewShow = ({books}: BookListViewShowProps) => {
  return (
    <div className="mt-4 grid grid-cols-1">
      {books.map(book => (
        <div key={book.unitId}>
          <BookListViewItem book={book} />
        </div>
      ))}
    </div>
  );
};

export type BookListViewContainerProps = {
  books: Book[];
};

export const BookListViewContainer = ({books}: BookListViewContainerProps) => {
  return <BookListViewShow books={books} />;
};
