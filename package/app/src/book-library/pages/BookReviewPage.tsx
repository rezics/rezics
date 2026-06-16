import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { ScoreOverview } from "@/engagement";
import { ReviewList } from "@/review";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { ShelfByBookPreview } from "../components/ShelfByBookPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import {
  postListFiltersForCatalogEntry,
  resolveCatalogEntryInteractionContext,
} from "../models/catalogEntryContext";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const REVIEW_PREVIEW_LIMIT = 5;
const SHELF_PREVIEW_LIMIT = 5;

/**
 * 书籍评论页面。展示书籍的评分概览、相关书架和用户评论列表，支持撰写新评论。
 * Book Review Page: displays book ratings, related shelves, user reviews (max 5), and write review button.
 *
 * Layout breakpoints:
 *
 * Mobile (<640px):
 * ┌──────────────────────┐
 * │ Score Overview       │
 * │ [★★★★☆ 4.2]        │
 * │ 128 ratings          │
 * ├──────────────────────┤
 * │ Related Shelves      │
 * │ [Shelf 1]            │
 * │ [Shelf 2]            │
 * │ [Shelf 3]            │
 * │ [Shelf 4]            │
 * │ [Shelf 5]            │
 * ├──────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━  │
 * ├──────────────────────┤
 * │ Reviews [Write] →    │
 * │ "Book Title Reviews" │
 * ├──────────────────────┤
 * │ [Review 1]           │
 * │ [Review 2]           │
 * │ [Review 3]           │
 * │ [Review 4]           │
 * │ [Review 5]           │
 * └──────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Score Overview (more visible)      │
 * │ [★★★★☆ 4.2] 128 ratings           │
 * ├────────────────────────────────────┤
 * │ Related Shelves (2 columns)        │
 * │ [Shelf 1]        [Shelf 3]         │
 * │ [Shelf 2]        [Shelf 4]         │
 * │ [Shelf 5]        ...               │
 * ├────────────────────────────────────┤
 * │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
 * ├────────────────────────────────────┤
 * │ Reviews [Write Review →]           │
 * │ "Book Title Reviews"               │
 * ├────────────────────────────────────┤
 * │ [Review 1 (wider)]                 │
 * │ [Review 2 (wider)]                 │
 * │ [Review 3 (wider)]                 │
 * │ [Review 4 (wider)]                 │
 * │ [Review 5 (wider)]                 │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌─────────────────────────────────────────────┐
 * │ [Sidebar]           │ Main Content          │
 * │ Score Overview      │ Related Shelves       │
 * │ [★★★★☆ 4.2]       │ [Shelf 1] [Shelf 2]   │
 * │ 128 ratings         │ [Shelf 3] [Shelf 4]   │
 * │                     │ [Shelf 5] ...         │
 * │                     ├─────────────────────┤
 * │                     │ ━━━━━━━━━━━━━━━  │
 * │                     ├─────────────────────┤
 * │                     │ "Book Title Reviews" │
 * │                     │ [Write Review →]    │
 * │                     ├─────────────────────┤
 * │                     │ [Review 1]          │
 * │                     │ [Review 2]          │
 * │                     │ [Review 3]          │
 * │                     │ [Review 4]          │
 * │                     │ [Review 5]          │
 * └─────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌──────────────────────────────────────────────────────┐
 * │ [Sidebar (sticky)]  │ Main Content (optimal width)   │
 * │ Score Overview      │ Related Shelves (3+ columns)   │
 * │ [★★★★☆ 4.2]       │ [Shelf 1] [Shelf 2] [Shelf 3]   │
 * │ 128 ratings         │ [Shelf 4] [Shelf 5] ...        │
 * │ [Sticky position]   ├────────────────────────────────┤
 * │                     │ ━━━━━━━━━━━━━━━━━━━━━━━  │
 * │                     ├────────────────────────────────┤
 * │                     │ "Book Title - Full Reviews"     │
 * │                     │ [Write Review Button →]        │
 * │                     ├────────────────────────────────┤
 * │                     │ [Review 1 (full width)]        │
 * │                     │ [Review 2 (full width)]        │
 * │                     │ [Review 3 (full width)]        │
 * │                     │ [Review 4 (full width)]        │
 * │                     │ [Review 5 (full width)]        │
 * └──────────────────────────────────────────────────────┘
 */
export const BookReviewPage: React.FC = () => {
  const { t } = useTranslation("book");
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const navigate = useNavigate();
  const readContext = useReadLanguageContext();
  const { data } = useQuery({
    ...bookQueries.detail(bookId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: Boolean(bookId) && readContext.ready,
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

  const catalogContext = bookInfo
    ? resolveCatalogEntryInteractionContext(bookInfo)
    : null;
  const { data: reviewsData } = useQuery({
    ...postQueries.list(
      catalogContext
        ? postListFiltersForCatalogEntry(catalogContext, {
            kind: PostKind.REVIEW,
            limit: REVIEW_PREVIEW_LIMIT,
            languages: readContext.languages,
            languageMode: readContext.languageMode,
          })
        : {
            targetUnitId: bookId,
            kind: PostKind.REVIEW,
            limit: REVIEW_PREVIEW_LIMIT,
            languages: readContext.languages,
            languageMode: readContext.languageMode,
          },
    ),
    enabled: readContext.ready && Boolean(catalogContext?.pageUnitId ?? bookId),
  });

  const sidebar = useMemo(
    () => (
      <div className="flex flex-col gap-6">
        <ScoreOverview unitId={bookId} />
      </div>
    ),
    [bookId],
  );
  useBookDetailSidebar(sidebar);

  if (!bookInfo) return null;

  const title =
    getTranslation(
      bookInfo.translations,
      selectedLang,
      bookInfo.defaultLanguage ?? undefined,
    )?.title ?? "";

  const reviews =
    reviewsData?.posts
      ?.filter((p) => p.kind === PostKind.REVIEW)
      .slice(0, REVIEW_PREVIEW_LIMIT) ?? [];

  return (
    <div>
      <div className="lg:hidden">
        <ScoreOverview unitId={bookId} />
      </div>

      <ShelfByBookPreview
        bookId={catalogContext?.primaryTargetUnitId || bookInfo.unitId || ""}
        variantUnitId={catalogContext?.variantUnitId}
        title={title}
        shelfNumber={SHELF_PREVIEW_LIMIT}
      />

      <Separator className="my-4" />

      <div>
        <div className="flex flex-row justify-between items-center mb-2">
          <ArrowForwardIcon size={16} to={`/review/book/${bookId}`}>
            <AccentBarWithText text={t("reviews_of_book", { title })} />
          </ArrowForwardIcon>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({
                to: "/review/new/$bookUnitId",
                params: {
                  bookUnitId:
                    catalogContext?.primaryTargetUnitId ?? bookInfo.unitId,
                },
                search: catalogContext?.variantUnitId
                  ? { variantUnitId: catalogContext.variantUnitId }
                  : undefined,
              })
            }
          >
            {t("write_a_review")}
          </Button>
        </div>
        <ReviewList reviews={reviews} />
      </div>
    </div>
  );
};
