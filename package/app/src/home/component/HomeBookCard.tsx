import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
} from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useTranslation } from "react-i18next";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookTitle,
} from "@/shared/util/translation-helpers";

const BookCard = ({
  book,
  className = "",
}: {
  book: BookDTO;
  className?: string;
}) => {
  const { t } = useTranslation();
  const title = getBookTitle(book);
  const coverUrl = getBookCoverUrl(book);
  const authorName = getBookAuthorName(book);

  return (
    <Card
      key={book.unitId}
      className={`flex flex-col rounded-xl overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${className}`}
      elevation={1}
    >
      <CardActionArea
        component={Link}
        to={`/book/${book.unitId}`}
        className="flex flex-col items-stretch justify-start"
      >
        {coverUrl ? (
          <Box className="relative w-full h-42 aspect-[3/4] overflow-hidden bg-gray-100">
            <LazyLoadImage
              src={coverUrl}
              alt={title}
              className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
            />
          </Box>
        ) : (
          <Box className="w-full aspect-[3/4] h-42 bg-gray-200 flex items-center justify-center text-gray-400">
            {t("book.no_cover")}
          </Box>
        )}

        <CardContent className="flex flex-col flex-1 w-full gap-1 p-1">
          <div
            className="font-bold leading-tight line-clamp-2 min-h-[2.5em]"
            title={title}
          >
            {title}
          </div>

          <Typography
            variant="caption"
            component="p"
            className="text-gray-500 truncate mt-auto pt-1"
          >
            {authorName || t("book.unknown_author")}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default BookCard;
