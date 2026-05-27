import { postQueries } from "@rezics/api/post/post";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import type { BookDTO } from "@rezics/contract";
import { mainMarkdownSource, PostKind } from "@rezics/contract";
import {
  book_hero_kind_book,
  book_hero_meta_author,
  book_hero_meta_chapter_count,
  book_hero_meta_co_author,
  book_hero_meta_editor,
  book_hero_meta_illustrator,
  book_hero_meta_length_chars,
  book_hero_meta_producer,
  book_hero_meta_publisher,
  book_hero_meta_translator,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { useNavigateToBookTagSearch } from "@/search/hooks/useNavigateToBookTagSearch";
import {
  type EntityTranslation,
  getBookCoverUrl,
  getEntityTranslationsByRole,
  getTranslation,
} from "@/shared/utils/translation-helpers";
import { SourceEvidencePreview } from "../components/SourceEvidencePreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { releaseWorkUnitId } from "../models/releaseWork";
import { BookHeroActionBar } from "./BookHeroActionBar";
import { BookHeroCountLinks } from "./BookHeroCountLinks";
import { BookHeroFeaturedReview } from "./BookHeroFeaturedReview";
import { BookHeroScoreBlock } from "./BookHeroScoreBlock";
import { BookHeroStatCards, type BookHeroStatKey } from "./BookHeroStatCards";
import { BookYourScoreBlock } from "./BookYourScoreBlock";

const i18nMessages = {
  book_hero_kind_book,
  book_hero_meta_chapter_count,
  book_hero_meta_length_chars,
  book_hero_meta_author,
  book_hero_meta_co_author,
  book_hero_meta_editor,
  book_hero_meta_illustrator,
  book_hero_meta_producer,
  book_hero_meta_publisher,
  book_hero_meta_translator,
};

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
  { role: "author", label: i18nMessages.book_hero_meta_author },
  {
    role: "co-author",
    label: i18nMessages.book_hero_meta_co_author,
  },
  {
    role: "translator",
    label: i18nMessages.book_hero_meta_translator,
  },
  {
    role: "illustrator",
    label: i18nMessages.book_hero_meta_illustrator,
  },
  { role: "editor", label: i18nMessages.book_hero_meta_editor },
  {
    role: "publisher",
    label: i18nMessages.book_hero_meta_publisher,
  },
  { role: "producer", label: i18nMessages.book_hero_meta_producer },
] as const;

export const BookHeroSection: React.FC<BookHeroSectionProps> = ({
  bookInfo,
  rating,
  ratingCount = 0,
}) => {
  const m = useMessage(i18nMessages);
  const { bookId: routeBookId } = useParams({ strict: false }) as {
    bookId?: string;
  };
  const bookId = routeBookId ?? bookInfo?.unitId ?? "";
  const workUnitId = releaseWorkUnitId(bookInfo);
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

  const selectedTranslation = getTranslation(
    bookInfo?.translations,
    selectedLang,
    bookInfo?.defaultLanguage ?? undefined,
  );
  const title = selectedTranslation?.title ?? "";
  const summary =
    selectedTranslation?.summary ??
    mainMarkdownSource(selectedTranslation?.description) ??
    "";
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
    ...(workUnitId
      ? postQueries.byWork(workUnitId, {
          kind: PostKind.REVIEW,
          workRoles: ["REVIEW"],
          limit: 1,
        })
      : postQueries.byTarget(bookId, { kind: PostKind.REVIEW, limit: 1 })),
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
    { id: "kind", text: m.book_hero_kind_book() },
  ];
  if (typeof bookInfo?.chapterCount === "number") {
    briefParts.push({
      id: "chapters",
      text: m.book_hero_meta_chapter_count({ count: bookInfo.chapterCount }),
    });
  }
  if (typeof bookInfo?.textLength === "number" && bookInfo.textLength > 0) {
    briefParts.push({
      id: "length",
      text: m.book_hero_meta_length_chars({ count: bookInfo.textLength }),
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
        label: config.label(),
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
                <BookHeroFeaturedReview
                  bookId={bookId}
                  workUnitId={workUnitId}
                />
              </div>
            )}

            <div
              className={
                hasReview
                  ? "w-full lg:w-[240px] lg:shrink-0"
                  : "w-full lg:flex-1 lg:max-w-[360px]"
              }
            >
              <BookHeroStatCards
                bookId={bookId}
                workUnitId={workUnitId}
                cardKeys={statCardKeys}
              />
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
                              <SourceEvidencePreview
                                entityUnitId={credit.unitId}
                                entitySlug={credit.slug}
                                entityName={credit.name}
                                roleLabel={row.label}
                                evidence={credit.evidence}
                              />
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

              <BookHeroCountLinks
                bookId={bookId}
                workUnitId={workUnitId}
                excludeKeys={statCardKeys}
              />
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
