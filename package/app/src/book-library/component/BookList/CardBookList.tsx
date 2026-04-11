import { Card, CardContent, CardMedia, Typography } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/util/translation-helpers";

interface CardBookListProps {
  books: BookDTO[];
}

export const CardBookList = ({ books }: CardBookListProps) => {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {books.map((book) => {
        const title = getBookTitle(book);
        const coverUrl = getBookCoverUrl(book);
        const authorName = getBookAuthorName(book);
        const description = getBookDescription(book);

        return (
          <Card
            key={book.unitId}
            className="h-full flex flex-row items-stretch gap-4 w-full"
          >
            {coverUrl && (
              <CardMedia style={{ width: "36%", objectFit: "cover" }}>
                <LazyLoadImage
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
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
        );
      })}
    </div>
  );
};
