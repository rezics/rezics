import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useMemo } from "react";
import { ScoreOverview } from "@/engagement/components/ScoreOverview";
import { ReviewList } from "@/review/components/list/ReviewList";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { ShelfByBookPreview } from "../components/ShelfByBookPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";
import { useBookDetailSidebar } from "./bookDetailLayoutContext";

const REVIEW_PREVIEW_LIMIT = 5;
const SHELF_PREVIEW_LIMIT = 5;

export const BookReviewPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const navigate = useNavigate();
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [selectedLang] = useBookLanguage(bookId, bookInfo);

  const { data: reviewsData } = useQuery({
    ...postQueries.list({
      targetUnitId: bookId,
      kind: PostKind.REVIEW,
      limit: REVIEW_PREVIEW_LIMIT,
    }),
    enabled: Boolean(bookId),
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
        bookId={bookInfo.unitId || ""}
        title={title}
        shelfNumber={SHELF_PREVIEW_LIMIT}
      />

      <Separator className="my-4" />

      <div>
        <div className="flex flex-row justify-between items-center mb-2">
          <ArrowForwardIcon size={16} to={`/review/book/${bookId}`}>
            <AccentBarWithText text={`Reviews of ${title}`} />
          </ArrowForwardIcon>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              navigate({
                to: "/review/new/$bookUnitId",
                params: { bookUnitId: bookId },
              })
            }
          >
            Write a Review
          </Button>
        </div>
        <ReviewList reviews={reviews} />
      </div>
    </div>
  );
};
