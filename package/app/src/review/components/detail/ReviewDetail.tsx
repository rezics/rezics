import { Avatar, Box, Tooltip, Typography } from "@mui/material";
import type { BookDTO, PostDTO } from "@rezics/contract";
import { MarkdownContent } from "@rezics/ui/composite/content/MarkdownContent.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";
import { BookListViewItem } from "@/book-library/components/BookList/BookListView";
import { ReactionBar } from "@/engagement";
import {
  reviewDetailActions,
  reviewPolicy,
} from "../../models/reviewPolicy";

interface ReviewDetailProps {
  review: PostDTO;
  book?: BookDTO | null;
  onReplyInvoke?: () => void;
}

export const ReviewDetail: React.FC<ReviewDetailProps> = ({
  review,
  book,
  onReplyInvoke,
}) => {
  const { t } = useTranslation();
  const rating = (review.extra as { rating?: number } | null)?.rating;
  const title = (review.extra as { title?: string } | null)?.title;
  const dateStr = review.createdAt
    ? new Date(String(review.createdAt)).toLocaleDateString()
    : "";

  return (
    <Box className="flex flex-col gap-8">
      {book && <BookListViewItem book={book} />}

      <Box className="flex items-center justify-between">
        <Typography variant="h5" fontWeight={700}>
          {title || t("pages.review_page")}
        </Typography>
        {rating !== undefined && (
          <Typography variant="body2" color="text.secondary">
            {rating.toFixed(1)} / 10
          </Typography>
        )}
      </Box>

      <Box className="flex items-start gap-4">
        <Avatar
          src={review.author?.avatar ?? ""}
          sx={{ width: 56, height: 56, borderRadius: 1 }}
          onClick={(e) => e.stopPropagation()}
        />
        <Box className="flex-1">
          <Tooltip
            title={t("review.open_user_interface")}
            placement="top-start"
          >
            <MUILink
              to="/user/$unitId"
              params={{ unitId: review.author?.unitId ?? "" }}
            >
              <Typography variant="h6" fontWeight={700} color="primary">
                {review.author?.name}
              </Typography>
            </MUILink>
          </Tooltip>
          {dateStr && (
            <Typography variant="caption" color="text.secondary">
              {dateStr}
            </Typography>
          )}
        </Box>
      </Box>

      <Box>
        <MarkdownContent content={review.body ?? ""} />
      </Box>

      <ReactionBar
        size="lg"
        post={review}
        policy={reviewPolicy}
        actions={reviewDetailActions}
        onReplyInvoke={onReplyInvoke}
      />
    </Box>
  );
};
