import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";

import type React from "react";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";

/** Props for BookListViewItem component. */
export type BookListViewItemProps = {
  /** Book data to display. */
  book: BookDTO;
};

/**
 * Book List View Item - Single book card in the list.
 *
 * Displays book cover, title, author, and description preview.
 */
export const BookListViewItem: React.FC<BookListViewItemProps> = ({ book }) => {
  const title = getBookTitle(book);
  const coverUrl = getBookCoverUrl(book);
  const authorName = getBookAuthorName(book);
  const description = getBookDescription(book);

  return (
    <div>
      <Link to="/book/$bookId" params={{ bookId: book.unitId }}>
        <Card className="mt-4 h-[200px] flex flex-row items-stretch gap-4 w-full">
          {coverUrl && (
            <CardMedia className="aspect-[2/3]">
              <LazyLoadImage
                src={coverUrl}
                alt={title}
                className="!h-full object-cover w-full"
              />
            </CardMedia>
          )}
          <CardContent className="flex-1 flex flex-col justify-between min-w-0">
            <div>
              <Typography variant="h6" className="mb-1">
                {title}
              </Typography>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                className="mb-2"
              >
                {authorName}
              </Typography>
              <Typography variant="body2" className="line-clamp-3">
                {description}
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

/** Props for BookListView component. */
export type BookListViewProps = {
  /** List of books to display. */
  books: BookDTO[];
};

/**
 * Book List View - Grid of book cards.
 *
 * Renders a list of BookListViewItem components.
 */
export const BookListView: React.FC<BookListViewProps> = ({ books }) => {
  return (
    <div className="mt-4 grid grid-cols-1">
      {books.map((book) => (
        <div key={book.unitId}>
          <BookListViewItem book={book} />
        </div>
      ))}
    </div>
  );
};
