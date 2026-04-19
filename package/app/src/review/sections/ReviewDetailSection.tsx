import { ChatBubbleOutline } from "@mui/icons-material";
import { Box, IconButton, Typography } from "@mui/material";
import { bookQueries } from "@rezics/api/book/book";
import { useCanEdit } from "@rezics/api/hooks";
import { postQueries } from "@rezics/api/post/post";
import { AccentBar } from "@rezics/ui/primitive/decorative/AccentBar.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { InlinePostForm, PostTreeSection } from "@/post";
import { ReviewDetail } from "../components/detail/ReviewDetail";

interface ReviewDetailSectionProps {
  reviewId: string;
}

export const ReviewDetailSection: React.FC<ReviewDetailSectionProps> = ({
  reviewId,
}) => {
  const { t } = useTranslation();
  const commentRef = useRef<HTMLDivElement>(null);
  const [showReplyForm, setShowReplyForm] = useState(false);

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

  const handleGoToComments = () => {
    commentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <Box className="flex flex-col gap-6">
      {canEdit && (
        <Box alignSelf="flex-end">
          <MUILink to="/review/$reviewId/edit" params={{ reviewId }}>
            {t("common.edit")}
          </MUILink>
        </Box>
      )}

      <ReviewDetail review={review} book={book} />

      <Box ref={commentRef} className="mt-4 flex flex-col gap-3">
        <Box className="flex items-center justify-between">
          <Box className="flex items-center gap-2">
            <AccentBar />
            <Typography variant="h6" fontWeight={700}>
              {t("review.comments")}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <ChatBubbleOutline fontSize="small" />
          </IconButton>
        </Box>

        {showReplyForm && (
          <InlinePostForm
            targetUnitId={review.unitId}
            placeholder="Write a reply..."
            onSuccess={() => setShowReplyForm(false)}
          />
        )}

        <PostTreeSection rootPostUnitId={review.unitId} />
      </Box>
    </Box>
  );
};
