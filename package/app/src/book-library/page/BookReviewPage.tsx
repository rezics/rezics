import { Box, Button, Divider, Stack, Tab, Tabs, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useAtomValue } from "jotai";
import type React from "react";
import { useState } from "react";
import { ScoreOverview } from "@/engagement/component/ScoreOverview";
import { RemarkInlineForm } from "@/remark/component/RemarkInlineForm";
import { RemarkList } from "@/remark/component/RemarkList";
import { ReviewList } from "@/review/component/ReviewList";
import { getBookTitle } from "@/shared/util/translation-helpers";
import { ShelfByBookPreview } from "../component/ShelfByBookPreview";
import { BookDetailShell } from "../section/BookDetailSection";
import { bookDetailAtomFamily } from "../state/bookDetailAtoms";
import { postQueries } from "@rezics/api/post/post";
import { PostKind } from "@rezics/contract";

export const BookReviewPage: React.FC = () => {
  const { bookId } = useParams({ strict: false }) as { bookId: string };
  const navigate = useNavigate();
  const { data } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;
  const [subTab, setSubTab] = useState<"remarks" | "reviews">("remarks");

  const { data: reviewsData } = useQuery({
    ...postQueries.byTarget(bookId),
    enabled: Boolean(bookId),
  });

  const reviews =
    reviewsData?.posts?.filter((p) => p.kind === PostKind.REVIEW) ?? [];

  if (!bookInfo) return null;

  const title = getBookTitle(bookInfo);

  return (
    <BookDetailShell bookInfo={bookInfo}>
      <Stack spacing={4}>
        {/* Score Overview */}
        <ScoreOverview unitId={bookId} />

        <Divider />

        {/* Inline Remark Form */}
        <RemarkInlineForm bookUnitId={bookId} />

        <Divider />

        {/* Sub-tab toggle: Remarks | Reviews */}
        <Box>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Tabs
              value={subTab}
              onChange={(_, v) => setSubTab(v)}
            >
              <Tab label="Remarks" value="remarks" />
              <Tab label="Reviews" value="reviews" />
            </Tabs>
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
              Write a Full Review
            </Button>
          </Stack>

          <Box mt={2}>
            {subTab === "remarks" ? (
              <RemarkList targetUnitId={bookId} />
            ) : (
              <ReviewList reviews={reviews} />
            )}
          </Box>
        </Box>

        <Divider />

        {/* Shelves containing this book */}
        <ShelfByBookPreview
          bookId={bookInfo?.unitId || ""}
          title={title}
        />
      </Stack>
    </BookDetailShell>
  );
};
