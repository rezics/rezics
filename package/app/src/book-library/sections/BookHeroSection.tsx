import { tagQueries } from "@rezics/api/tag/tag.queries";
import type { BookDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import {
  getBookCoverUrl,
  getEntityTranslation,
  getTranslation,
} from "@/shared/utils/translation-helpers";

import { useBookLanguage } from "../hooks/useBookLanguage";
import { BookHeroActionMenu } from "./BookHeroActionMenu";
import { BookHeroActionStack } from "./BookHeroActionStack";
import { BookHeroCountsStrip } from "./BookHeroCountsStrip";
import { BookHeroFeaturedReview } from "./BookHeroFeaturedReview";
import { BookHeroScoreBlock } from "./BookHeroScoreBlock";

type Book = BookDTO;

interface BookHeroSectionProps {
  bookInfo: Book;
  rating: number;
  /** Number of users who rated; 0 hides the count line under the score. */
  ratingCount?: number;
}

export const BookHeroSection: React.FC<BookHeroSectionProps> = ({
  bookInfo,
  rating,
  ratingCount = 0,
}) => {
  const { t } = useTranslation();
  const { bookId: routeBookId } = useParams({ strict: false }) as {
    bookId?: string;
  };
  const bookId = routeBookId ?? bookInfo?.unitId ?? "";
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

  const selectedTranslation = getTranslation(
    bookInfo?.translations,
    selectedLang,
    bookInfo?.defaultLanguage ?? undefined,
  );
  const title = selectedTranslation?.title ?? "";
  const coverUrl = getBookCoverUrl(bookInfo);
  const author = getEntityTranslation(
    bookInfo?.attributions,
    "author",
    selectedLang,
  );
  const publisher = getEntityTranslation(
    bookInfo?.attributions,
    "publisher",
    selectedLang,
  );
  const producer = getEntityTranslation(
    bookInfo?.attributions,
    "producer",
    selectedLang,
  );

  const { data: tagsData } = useQuery(tagQueries.forUnit(bookId));
  const unitTags = tagsData?.tags ?? [];
  const tagUnitIds = unitTags.map((tag) => tag.tagUnitId);
  const { data: tagTranslations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, selectedLang),
  );
  const navigateToTagSearch = useNavigateToBookTagSearch();

  const metaParts: string[] = [];
  if (author?.name) metaParts.push(author.name);
  if (publisher?.name) metaParts.push(publisher.name);
  if (producer?.name) metaParts.push(producer.name);
  if (typeof bookInfo?.textLength === "number" && bookInfo.textLength > 0) {
    metaParts.push(
      t("book.hero.meta.length_chars", "{{count}} 字", {
        count: bookInfo.textLength,
      }),
    );
  }
  if (bookInfo?.isbn13) {
    metaParts.push(`ISBN ${bookInfo.isbn13}`);
  }

  return (
    <div
      className="bg-cover bg-center relative"
      style={{ backgroundImage: `url(${coverUrl})` }}
    >
      <div className="bg-black/65 backdrop-blur-md w-full">
        <div className="container mx-auto max-w-[1250px] px-4 py-8 lg:py-10">
          {/* Top utility row: action cluster on right */}
          <div className="flex items-start justify-end mb-4 min-h-[36px]">
            <BookHeroActionMenu bookInfo={bookInfo} shareTitle={title} />
          </div>

          {/* Title row — full width, large */}
          <h1 className="text-white font-serif text-3xl lg:text-5xl font-semibold leading-tight tracking-tight break-words">
            {title}
          </h1>

          {/* Meta inline line */}
          {metaParts.length > 0 && (
            <p className="mt-3 text-white/70 text-sm lg:text-base flex flex-wrap items-center gap-x-2 gap-y-1">
              {metaParts.map((part, i) => (
                <span key={`${part}-${i}`} className="flex items-center gap-2">
                  {i > 0 && <span className="text-white/40">·</span>}
                  <span>{part}</span>
                </span>
              ))}
            </p>
          )}

          {/* Tag chips row */}
          {unitTags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {unitTags.map((tag) => {
                const tr = tagTranslations?.[tag.tagUnitId];
                const label = tr?.name || tag.tagUnitId;
                const slug = tr?.slug || undefined;
                return (
                  <button
                    key={tag.tagUnitId}
                    type="button"
                    onClick={() =>
                      navigateToTagSearch([
                        { slug, unitId: tag.tagUnitId, name: label },
                      ])
                    }
                    className="px-2.5 py-1 rounded-full bg-white/10 text-white/90 text-xs hover:bg-white/20 transition cursor-pointer"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Body grid — cover · featured review · right column */}
          <div className="mt-8 grid grid-cols-12 gap-6 lg:gap-8 items-start">
            <div className="col-span-12 sm:col-span-3 lg:col-span-2 flex justify-center sm:justify-start">
              <LazyLoadImage
                src={coverUrl}
                alt={title}
                className="max-h-[280px] rounded-lg shadow-xl"
              />
            </div>

            <div className="col-span-12 sm:col-span-9 lg:col-span-6 min-w-0">
              <BookHeroFeaturedReview bookId={bookId} />
            </div>

            <div className="col-span-12 lg:col-span-4 flex flex-col gap-5 lg:items-end">
              <div className="self-stretch lg:self-end">
                <BookHeroScoreBlock rating={rating} count={ratingCount} />
              </div>
              <div className="self-stretch lg:max-w-[260px] w-full lg:w-auto">
                <BookHeroCountsStrip bookId={bookId} />
              </div>
              <div className="self-stretch lg:max-w-[260px] w-full lg:w-auto">
                <BookHeroActionStack bookId={bookId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
