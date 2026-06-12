import { postQueries } from "@rezics/api/post/post";
import { tagQueries } from "@rezics/api/tag/tag.queries";
import type { BookDTO } from "@rezics/contract";
import { mainMarkdownSource, PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { getI18nRuntime } from "@rezics/i18n/runtime";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type React from "react";
import { useNavigateToBookTagSearch } from "@/search";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import {
  type EntityTranslation,
  getBookCoverUrl,
  getEntityTranslationsByRole,
  getTranslation,
} from "@/shared/utils/translation-helpers";
import { SourceEvidencePreview } from "../components/SourceEvidencePreview";
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
  /** Number of users who rated; 0 hides the count line under the score. 打分的用户数；为 0 时隐藏分数下方的计数行。 */
  ratingCount?: number;
}

type BriefPart = { id: string; text: string };
type MetaRow = { key: string; label: string; credits: EntityTranslation[] };

const i18nMessages = {
  book_hero_meta_author: () => getI18nRuntime().i18n.t("book:hero_meta_author"),
  book_hero_meta_co_author: () =>
    getI18nRuntime().i18n.t("book:hero_meta_co_author"),
  book_hero_meta_translator: () =>
    getI18nRuntime().i18n.t("book:hero_meta_translator"),
  book_hero_meta_illustrator: () =>
    getI18nRuntime().i18n.t("book:hero_meta_illustrator"),
  book_hero_meta_editor: () => getI18nRuntime().i18n.t("book:hero_meta_editor"),
  book_hero_meta_publisher: () =>
    getI18nRuntime().i18n.t("book:hero_meta_publisher"),
  book_hero_meta_producer: () =>
    getI18nRuntime().i18n.t("book:hero_meta_producer"),
} as const;

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

/**
 * Book Hero Section - Full-width header with cover, title, rating, and metadata.
 * 图书英雄部分——包含封面、标题、评分和元数据的全宽标题。
 *
 * Renders a dramatic dark background hero with book cover, dynamic stat cards,
 * featured review (if available), and metadata rows.
 *
 * Mobile <640px:
 * +-----------------+
 * | Title           |
 * | Score (inline)  |
 * | Brief info      |
 * +-----------------+
 * | Cover centered  |
 * +-----------------+
 * | Review (opt)    |
 * | Stat cards      |
 * +-----------------+
 * | Metadata        |
 * | Tags            |
 * | Actions         |
 * +-----------------+
 *
 * Tablet 640-1023px:
 * +-----------------+
 * | Title + Score   |
 * | Brief info      |
 * +-----------------+
 * | Cover | Stacked |
 * |       | cards   |
 * +-----------------+
 * | Metadata + Tags |
 * | Actions (right) |
 * +-----------------+
 *
 * Desktop 1024-1535px:
 * +-----+---+-----+
 * | Title (full) + Score + Your Score |
 * | Brief info                        |
 * +-----+---+-----+
 * | Cov | Rev | Stat |
 * | er  | iew | Cards|
 * +-----+---+-----+
 * | Metadata (left) | Actions (right) |
 * +-----------------+-----------------+
 *
 * Ultra-wide >=1536px:
 * +-----+----+------+
 * | Title (full) + Score + Your Score |
 * | Brief info                        |
 * +-----+----+------+
 * | Cov | Review   | Stat Cards |
 * | er  |          | (promoted) |
 * +-----+----------+------------+
 * | Metadata (left) | Actions (right) |
 * +-----------------+-----------------+
 */
export const BookHeroSection: React.FC<BookHeroSectionProps> = ({
  bookInfo,
  rating,
  ratingCount = 0,
}) => {
  const { t } = useTranslation(["book"]);
  const { bookId: routeBookId } = useParams({ strict: false }) as {
    bookId?: string;
  };
  const bookId = routeBookId ?? bookInfo?.unitId ?? "";
  const [selectedLang] = useBookLanguage(bookId, bookInfo);
  const readContext = useReadLanguageContext();

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
  // 上提的评价查询——同时驱动中部评价卡片和动态的右栏布局。
  // React Query 会与子组件去重。
  const { data: reviewData } = useQuery({
    ...postQueries.list({
      targetUnitId: bookId,
      kind: PostKind.REVIEW,
      languages: readContext.languages,
      appLocale: readContext.appLocale,
      languageMode: readContext.languageMode,
      limit: 1,
    }),
    enabled: readContext.ready && Boolean(bookId),
  });
  const hasReview = (reviewData?.posts?.length ?? 0) > 0;

  // When the centre review card renders, the right column has ~4 cols of width
  // and stacks 2 stat cards. Otherwise the stat column takes the centre+right
  // span and promotes all available stats so the stack fills the freed area.
  // 当中部评价卡片渲染时，右栏约有 4 列宽并堆叠 2 张统计卡片。否则统计列占据
  // 中部+右栏的跨度，并提升所有可用统计项，使堆叠填满腾出的区域。
  const statCardKeys: BookHeroStatKey[] = hasReview
    ? ["reviews", "shelves"]
    : ["reviews", "shelves", "tags"];

  const briefParts: BriefPart[] = [
    { id: "kind", text: t("book:hero_kind_book") },
  ];
  if (typeof bookInfo?.chapterCount === "number") {
    briefParts.push({
      id: "chapters",
      text: t("book:hero_meta_chapter_count", { count: bookInfo.chapterCount }),
    });
  }
  if (typeof bookInfo?.textLength === "number" && bookInfo.textLength > 0) {
    briefParts.push({
      id: "length",
      text: t("book:hero_meta_length_chars", { count: bookInfo.textLength }),
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
        <div className="w-full mx-auto max-w-[1280px] px-4 py-8 lg:py-10">
          {/* Title row + inline score (count stacks below the score). 标题行 + 内联分数（计数堆叠在分数下方）。 */}
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

          {/* Brief info strip: Book · {wordCount} words · ISBN ... 简要信息条：Book · {wordCount} words · ISBN ... */}
          <p className="mt-2 text-white/70 text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            {briefParts.map((part, i) => (
              <span key={part.id} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/40">·</span>}
                <span>{part.text}</span>
              </span>
            ))}
          </p>

          {/* Body row: cover + (optional review card) + stat cards. 主体行：封面 +（可选的评价卡片）+ 统计卡片。 */}
          <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:gap-8 items-stretch">
            <div className="flex justify-center lg:justify-start lg:shrink-0">
              <LazyLoadImage
                src={coverUrl}
                alt={title}
                className="max-h-[320px] rounded-lg object-contain shadow-xl"
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

          {/* Bottom row: metadata block (left) | action cluster (right). 底部行：元数据块（左）| 操作集群（右）。 */}
          <div className="mt-8 flex flex-col lg:flex-row gap-6 lg:gap-10">
            <div className="flex-1 min-w-0 space-y-4">
              {summary && (
                <p className="text-white/85 leading-relaxed text-sm lg:text-base max-w-[60ch]">
                  {summary}
                </p>
              )}

              {metaRows.length > 0 && (
                <dl className="grid grid-cols-[max-content_minmax(0,1fr)] border-t border-white/10">
                  {metaRows.map((row) => (
                    <div key={row.key} className="contents">
                      <dt className="border-b border-white/10 py-2.5 pr-3 text-white font-semibold text-sm">
                        {row.label}
                      </dt>
                      <dd className="border-b border-white/10 py-2.5 text-white/85 text-sm flex flex-wrap items-baseline gap-x-2 gap-y-1">
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
