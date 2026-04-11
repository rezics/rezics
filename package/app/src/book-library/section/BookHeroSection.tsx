import { Rating } from "@mui/material";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";
import {
  MiniActionBar,
  MiniAdminActionBar,
} from "@/engagement/component/MiniActionBar.tsx";
import {
  getBookAuthorName,
  getBookCoverUrl,
  getBookPublisherName,
  getBookTagLabels,
  getBookTitle,
  getPersonCredits,
} from "@/shared/util/translation-helpers";

type Book = BookDTO;

export const BookHeroReactionBar: React.FC<{
  bookInfo: Book;
  className?: string;
}> = ({ bookInfo, className }) => {
  const color = "text-white";
  return (
    <div className={className}>
      <MiniAdminActionBar
        editionURL={`/book/${bookInfo?.unitId}/edit`}
        textColor={color}
        userUnitId={bookInfo?.user?.unitId}
      />
      <MiniActionBar
        hideReply={true}
        className={className ?? ""}
        textColor={color}
        unitId={bookInfo?.unitId}
      />
    </div>
  );
};

export const BookHeroSection: React.FC<{
  bookInfo: Book;
  rating: number;
}> = ({ bookInfo, rating }) => {
  const { t } = useTranslation();
  const title = getBookTitle(bookInfo);
  const coverUrl = getBookCoverUrl(bookInfo);
  const authorName = getBookAuthorName(bookInfo);
  const publisherName = getBookPublisherName(bookInfo);
  const producerCredits = getPersonCredits(bookInfo?.personCredits, 'producer');
  const producerName = producerCredits[0]?.name ?? '';
  const tags = getBookTagLabels(bookInfo);
  return (
    <div
      className="bg-cover bg-center relative"
      style={{
        backgroundImage: `url(${coverUrl})`,
      }}
    >
      <div className="bg-black/60 backdrop-blur-md shadow-lg w-full">
        <div className="container mx-auto max-w-[1250px] py-6 grid grid-cols-12 gap-6 px-4">
          {/* Cover Image */}
          <div className="col-span-4 md:col-span-3 lg:col-span-2 flex justify-center">
            <LazyLoadImage
              src={coverUrl}
              alt={title}
              className="max-h-[300px] rounded-lg"
            />
          </div>

          {/* Book Info */}
          <div className="col-span-8 md:col-span-6 text-white flex flex-col gap-3">
            <h1 className="text-2xl font-bold break-words">
              {title}
            </h1>

            <div className="space-y-1">
              <p>
                {t("book.fields.author")}：
                <span className="font-medium">
                  {authorName}
                </span>
              </p>
              <p>
                {t("book.fields.press")}：{publisherName}
              </p>
              {producerName && (
                <p>
                  {t("book.fields.producer")}：{producerName}
                </p>
              )}
              <p>
                {t("book.fields.text_length")}：{bookInfo?.textLength ?? 0}
              </p>
              <p>
                {t("book.fields.isbn")}：{bookInfo?.isbn13 ?? ''}
              </p>
            </div>

            {/* Tags (scored) */}
            <div className="flex flex-wrap gap-2 mt-1">
              {tags.map((tag) => (
                <Link key={tag.tagUnitId} to="/book" search={{ tags: tag.label }}>
                  <span className="px-2 py-1 rounded bg-white/10 text-white hover:bg-white/20 transition">
                    {tag.label}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Rating + Reaction */}
          <div className="col-span-12 md:col-span-3 lg:col-span-4">
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <Rating value={rating} precision={0.5} readOnly size="large" />
                <span className="text-2xl text-amber-500">{rating} / 10</span>
              </div>
              <BookHeroReactionBar bookInfo={bookInfo} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
