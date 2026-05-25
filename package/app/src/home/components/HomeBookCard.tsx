import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Card, CardContent } from "@rezics/ui/shadcn";
import { Link } from "@/shared/ui/link";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/utils/translation-helpers";
import { useMessage } from "@rezics/i18n/react";
import { book_no_cover, book_unknown_author } from "@rezics/i18n/messages";
const i18nMessages = {
  book_no_cover,
  book_unknown_author,
};

const BookCard = ({
  book,
  className = "",
}: {
  book: BookDTO;
  className?: string;
}) => {
  const m = useMessage(i18nMessages);
  const title = getBookTitle(book);
  const coverUrl = getBookCoverUrl(book);
  const authorName = getBookAuthorName(book);

  return (
    <Card
      key={book.unitId}
      className={`flex flex-col rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 group shadow-sm ${className}`}
    >
      <Link
        to={`/book/${book.unitId}` as any}
        className="flex flex-col items-stretch justify-start"
      >
        {coverUrl ? (
          <div className="relative w-full h-42 aspect-[3/4] overflow-hidden bg-gray-100">
            <LazyLoadImage
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          </div>
        ) : (
          <div className="w-full aspect-[3/4] h-42 bg-gray-200 flex items-center justify-center text-gray-400">
            {m.book_no_cover()}
          </div>
        )}

        <CardContent className="flex flex-col flex-1 w-full gap-1 p-1">
          <div
            className="font-bold leading-tight line-clamp-2 min-h-[2.5em]"
            title={title}
          >
            {title}
          </div>

          <p className="text-xs text-gray-500 truncate mt-auto pt-1 m-0">
            {authorName || m.book_unknown_author()}
          </p>
        </CardContent>
      </Link>
    </Card>
  );
};

export default BookCard;
