import { postQueries } from "@rezics/api/post/post";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import type { BookDTO } from "@rezics/contract";
import { PostKind } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { Link, unitHref } from "@rezics/ui/primitive/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { useTranslation } from "react-i18next";
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import {
  type EntityTranslation,
  getBookCoverUrl,
  getEntityTranslationsByRole,
  getTranslation,
} from "@/shared/utils/translation-helpers";

import { useBookLanguage } from "../hooks/useBookLanguage";
import { BookHeroActionBar } from "./BookHeroActionBar";
import { BookHeroCountLinks } from "./BookHeroCountLinks";
import { BookHeroFeaturedReview } from "./BookHeroFeaturedReview";
import { BookHeroScoreBlock } from "./BookHeroScoreBlock";
import { BookHeroStatCards, type BookHeroStatKey } from "./BookHeroStatCards";
import { BookYourScoreBlock } from "./BookYourScoreBlock";

type Book = BookDTO;

interface BookHeroSectionProps {
  bookInfo: Book;
  rating: number;
  /** Number of users who rated; 0 hides the count line under the score. */
  ratingCount?: number;
}

type BriefPart = { id: string; text: string };
type MetaRow = { key: string; label: string; credits: EntityTranslation[] };

const CREDIT_ROLES = [
  { role: "author", labelKey: "book.hero.meta.author", fallback: "作者" },
  {
    role: "co-author",
    labelKey: "book.hero.meta.co_author",
    fallback: "共同作者",
  },
  {
    role: "translator",
    labelKey: "book.hero.meta.translator",
    fallback: "譯者",
  },
  {
    role: "illustrator",
    labelKey: "book.hero.meta.illustrator",
    fallback: "繪者",
  },
  { role: "editor", labelKey: "book.hero.meta.editor", fallback: "編輯" },
  {
    role: "publisher",
    labelKey: "book.hero.meta.publisher",
    fallback: "出版",
  },
  { role: "producer", labelKey: "book.hero.meta.producer", fallback: "製作" },
] as const;

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
  const summary =
    selectedTranslation?.summary ?? selectedTranslation?.description ?? "";
  const coverUrl = getBookCoverUrl(bookInfo);

  const { data: tagsData } = useQuery(tagQueries.forUnit(bookId));
  const unitTags = tagsData?.tags ?? [];
  const tagUnitIds = unitTags.map((tag) => tag.tagUnitId);
  const { data: tagTranslations } = useQuery(
    tagQueries.batchTranslations(tagUnitIds, selectedLang),
  );
  const navigateToTagSearch = useNavigateToBookTagSearch();

  // Lifted review query — drives both the centre review card and the dynamic
  // right-column layout. React Query dedupes with the child component.
  const { data: reviewData } = useQuery({
    ...postQueries.byTarget(bookId, { kind: PostKind.REVIEW, limit: 1 }),
    enabled: Boolean(bookId),
  });
  const hasReview = (reviewData?.posts?.length ?? 0) > 0;

  // When the centre review card renders, the right column has ~4 cols of width
  // and stacks 2 stat cards. Otherwise the stat column takes the centre+right
  // span and promotes all available stats so the stack fills the freed area.
  const statCardKeys: BookHeroStatKey[] = hasReview
    ? ["reviews", "shelves"]
    : ["reviews", "shelves", "tags"];

  const briefParts: BriefPart[] = [
    { id: "kind", text: t("book.hero.kind.book", "Book") },
  ];
  if (typeof bookInfo?.textLength === "number" && bookInfo.textLength > 0) {
    briefParts.push({
      id: "length",
      text: t("book.hero.meta.length_chars", "{{count}} 字", {
        count: bookInfo.textLength,
      }),
    });
  }
  if (bookInfo?.isbn13) {
    briefParts.push({ id: "isbn", text: `ISBN ${bookInfo.isbn13}` });
  }

  const metaRows: MetaRow[] = CREDIT_ROLES.flatMap((config) => {
    const credits = getEntityTranslationsByRole(
      bookInfo?.creditAttributions,
      config.role,
      selectedLang,
    ).filter((credit) => credit.name);

    if (credits.length === 0) return [];

    return [
      {
        key: config.role,
        label: t(config.labelKey, config.fallback),
        credits,
      },
    ];
  });

  return (
    <div className="relative overflow-hidden bg-black">
      <div
        aria-hidden="true"
        className="absolute inset-[-24px] bg-cover bg-center blur-md scale-105"
        style={{ backgroundImage: `url(${coverUrl})` }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-black/65" />
      <div className="relative w-full">
        <div className="container mx-auto max-w-[1280px] px-4 py-8 lg:py-10">
          {/* Title row + inline score (count stacks below the score). */}
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <h1 className="text-white font-serif text-3xl lg:text-5xl font-semibold leading-tight tracking-tight break-words flex-1 min-w-[12rem]">
              {title}
            </h1>
            <div className="flex items-start gap-6 flex-wrap">
              <BookHeroScoreBlock
                rating={rating}
                count={ratingCount}
                variant="inline"
              />
              <BookYourScoreBlock bookUnitId={bookId} />
            </div>
          </div>

          {/* Brief info strip: Book · {wordCount} words · ISBN ... */}
          <p className="mt-2 text-white/70 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            {briefParts.map((part, i) => (
              <span key={part.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/40">·</span>}
                <span>{part.text}</span>
              </span>
            ))}
          </p>

          {/* Body row: cover + (optional review card) + stat cards. */}
          <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
            <div className="flex justify-center lg:justify-start lg:shrink-0">
              <LazyLoadImage
                src={coverUrl}
                alt={title}
                className="max-h-[320px] rounded-lg shadow-xl"
              />
            </div>

            {hasReview && (
              <div className="flex-1 min-w-0 rounded-xl p-6 bg-white/10 flex">
                <BookHeroFeaturedReview bookId={bookId} />
              </div>
            )}

            <div
              className={
                hasReview
                  ? "w-full lg:w-[240px] lg:shrink-0"
                  : "w-full lg:flex-1 lg:max-w-[360px]"
              }
            >
              <BookHeroStatCards bookId={bookId} cardKeys={statCardKeys} />
            </div>
          </div>

          {/* Bottom row: metadata block (left) | action cluster (right). */}
          <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:gap-10">
            <div className="flex-1 min-w-0 space-y-4">
              {summary && (
                <p className="text-white/85 leading-relaxed text-sm lg:text-base max-w-[60ch]">
                  {summary}
                </p>
              )}

              {metaRows.length > 0 && (
                <dl className="border-t border-white/10">
                  {metaRows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-baseline gap-3 border-b border-white/10 py-2.5"
                    >
                      <dt className="text-white font-semibold text-sm w-16 shrink-0">
                        {row.label}
                      </dt>
                      <dd className="text-white/85 text-sm flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        {row.credits.map((credit, index) => (
                          <span key={credit.entityId} className="inline-flex">
                            {index > 0 && (
                              <span
                                aria-hidden="true"
                                className="mr-2 text-white/35"
                              >
                                /
                              </span>
                            )}
                            {credit.unitId ? (
                              <Link
                                to={unitHref({
                                  type: "ENTITY",
                                  unitId: credit.unitId,
                                  slug: credit.slug ?? null,
                                })}
                                className="text-white/90 underline underline-offset-4 decoration-white/30 transition-colors hover:text-white hover:decoration-white/70"
                              >
                                {credit.name}
                              </Link>
                            ) : (
                              credit.name
                            )}
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {unitTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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

              <BookHeroCountLinks bookId={bookId} excludeKeys={statCardKeys} />
            </div>

            <div className="lg:w-[260px] lg:flex-shrink-0">
              <BookHeroActionBar bookInfo={bookInfo} shareTitle={title} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
