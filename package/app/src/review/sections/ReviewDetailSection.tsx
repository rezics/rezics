import { Box, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useCanEdit } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { PostTreeSection } from "@/post";
import { ReplyComposer, type ReplyComposerHandle } from "@/post/forms/ReplyComposer";
import { useFocusReplyFromQuery } from "@/post/hooks/useFocusReplyFromQuery";
import { ReviewDetail } from "../components/detail/ReviewDetail";

interface ReviewDetailSectionProps {
  reviewId: string;
}

export const ReviewDetailSection: React.FC<ReviewDetailSectionProps> = ({
  reviewId,
}) => {
  const { t } = useTranslation();
  const commentRef = useRef<HTMLDivElement>(null);
  const composerRef = useFocusReplyFromQuery();

  const {
    data: review,
    isLoading,
    error,
  } = useQuery(postQueries.detail(reviewId));
  const bookUnitId = review?.targetUnitId ?? "";
  const { data: book } = useQuery({
    ...bookQueries.detail(bookUnitId),
    enabled: !!bookUnitId,
  });

  const canEdit = useCanEdit({
    resource: "post",
    ownerUnit: { user: review?.author },
  });

  if (isLoading) return <div>{t("common.loading")}</div>;
  if (error) return <QueryErrorDisplay error={error} />;
  if (!review) return <div>{t("common.no_data")}</div>;

  const handleReplyInvoke = () => {
    composerRef.current?.focus();
  };

  return (
    <Box className="flex flex-col gap-8">
      {canEdit && (
        <Box alignSelf="flex-end">
          <MUILink to="/review/$reviewId/edit" params={{ reviewId }}>
            {t("common.edit")}
          </MUILink>
        </Box>
      )}

      <ReviewDetail
        review={review}
        book={book}
        onReplyInvoke={handleReplyInvoke}
      />

      <Box ref={commentRef} className="mt-4 flex flex-col gap-3">
        <Box className="flex items-center gap-2">
          <AccentBar />
          <Typography variant="h6" fontWeight={700}>
            {t("review.comments")}
          </Typography>
        </Box>

        <ReplyComposer
          ref={composerRef}
          mode="progressive"
          targetUnitId={review.unitId}
        />

        <PostTreeSection rootPostUnitId={review.unitId} />
      </Box>
    </Box>
  );
};
