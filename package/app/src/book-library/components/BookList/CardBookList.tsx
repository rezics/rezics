import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Card, CardContent } from "@rezics/ui/shadcn";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookDescription,
  getBookTitle,
} from "@/shared/utils/translation-helpers";

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
            className="h-full flex flex-row items-stretch gap-4 w-full overflow-hidden"
          >
            {coverUrl && (
              <div className="w-[36%] overflow-hidden">
                <LazyLoadImage
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <CardContent className="flex-1 flex flex-col justify-between min-w-0 p-4">
              <div>
                <h6 className="mb-1 text-lg font-medium">{title}</h6>
                <p className="mb-2 text-sm text-rezics-color-text-secondary">
                  {authorName}
                </p>
                <p className="line-clamp-3 text-sm">{description}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
