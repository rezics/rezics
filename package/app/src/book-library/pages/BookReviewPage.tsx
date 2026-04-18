import { Box, Button, Divider, Stack } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";
import { ArrowForwardIcon } from "@rezics/ui/composite/navigation/ArrowForwardIcon.tsx";
import { AccentBarWithText } from "@rezics/ui/composite/typography/AccentBarWithText.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { ScoreOverview } from "@/engagement/components/ScoreOverview";
import { ReviewList } from "@/review/components/ReviewList";
import { getTranslation } from "@/shared/utils/translation-helpers";
import { ShelfByBookPreview } from "../components/ShelfByBookPreview";
import { useBookLanguage } from "../hooks/useBookLanguage";
import { BookDetailShell } from "../sections/BookDetailSection";
import { bookDetailAtomFamily } from "../states/bookDetailAtoms";

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
    ...postQueries.byTarget(bookId, {
      kind: "review",
      limit: REVIEW_PREVIEW_LIMIT,
    }),
    enabled: Boolean(bookId),
  });

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

  const sidebar = (
    <Stack spacing={3}>
      <ScoreOverview unitId={bookId} />
    </Stack>
  );

  return (
    <BookDetailShell bookInfo={bookInfo} sidebar={sidebar}>
      <Stack spacing={4}>
        <Box className="lg:hidden">
          <ScoreOverview unitId={bookId} />
        </Box>

        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            mb={1}
          >
            <ArrowForwardIcon size={16} to={`/review/book/${bookId}`}>
              <AccentBarWithText text={`Reviews of ${title}`} />
            </ArrowForwardIcon>
            <Button
              variant="text"
              size="small"
              onClick={() =>
                navigate({
                  to: "/review/new/$bookUnitId",
                  params: { bookUnitId: bookId },
                })
              }
            >
              Write a Review
            </Button>
          </Stack>
          <ReviewList reviews={reviews} />
        </Box>

        <Divider />

        <ShelfByBookPreview
          bookId={bookInfo.unitId || ""}
          title={title}
          shelfNumber={SHELF_PREVIEW_LIMIT}
        />
      </Stack>
    </BookDetailShell>
  );
};
