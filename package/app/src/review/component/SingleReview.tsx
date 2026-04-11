import { Avatar, Box, Tooltip, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar } from "@/engagement/component/ReactionBar";
import { ReactionStatistics } from "@/engagement/component/ReactionStatistics";
import { CollapsibleReview } from "@/readlist/component/Review";
import { parseReactionSummaries } from "@/shared/util/reaction-summaries-parser";

/**
 * ReviewHeader - now uses PostDTO instead of ReviewDTO.
 * The post.extra may contain a rating field as { rating: number }.
 */
export const ReviewHeader: React.FC<{
  review: PostDTO;
}> = ({ review }) => {
  const { t } = useTranslation();
  const followersCount = review.author?.followersCount ?? 0;
  // MOCK: rating stored in post.extra.rating when backend supports it
  const rating = (review.extra as any)?.rating as number | undefined;
  return (
    <div className="flex flex-wrap items-center mb-2 gap-2">
      <Tooltip title={t("review.open_user_interface")} placement="top-start">
        <Link
          to="/user/$unitId"
          params={{ unitId: review.author?.unitId ?? "" }}
          className="flex items-center"
        >
          {/* Avatar */}
          <Avatar src={review.author?.avatar ?? ""} variant="rounded" />

          {/* User Info */}
          <div className="ml-2">
            <Typography variant="subtitle1" fontWeight="bold">
              {review.author?.name}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {followersCount} followers
            </Typography>
          </div>
        </Link>
      </Tooltip>

      {/* Rating + Time (push to right, but wrap under on small screens) */}
      <div className="ml-auto text-right min-w-[120px]">
        <Tooltip title={t("review.open_review_page")} placement="top-end">
          <Link to="/review/$reviewId" params={{ reviewId: review.unitId }}>
            <div>
              {rating !== undefined && (
                <Typography variant="body2" color="text.secondary">
                  {rating.toFixed(1)} / 10
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                {review.createdAt
                  ? new Date(String(review.createdAt)).toLocaleDateString()
                  : ''}
              </Typography>
            </div>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
};

const ReviewFooter: React.FC<{
  review: PostDTO;
  onReply: (reviewId: string) => void;
}> = ({ review, onReply }) => {
  const reactionSummaries = parseReactionSummaries(
    review.reactionSummaries ?? [],
  );
  return (
    <div className="w-full flex flex-wrap justify-between items-center gap-2">
      {/* Left: Reaction stats */}
      <div className="ml-2">
        <ReactionStatistics reactionSummaries={reactionSummaries} />
      </div>

      {/* Right: ReactionBar */}
      <div className="flex justify-end">
        <ReactionBar
          unitId={review.unitId}
          onReply={() => onReply(review.unitId)}
          itemUrl={`/review/${review.unitId}`}
          hideReply={true}
          hideLike={true}
          hideDislike={true}
        />
      </div>
    </div>
  );
};

export type SingleReviewShowProps = {
  review: PostDTO;
  onReply: (reviewId: string) => void;
};

export const SingleReviewShow: React.FC<SingleReviewShowProps> = ({
  review,
  onReply,
}) => {
  // MOCK: map PostDTO to CollapsibleReview's expected shape
  const reviewData = {
    unitId: review.unitId,
    title: (review.extra as any)?.title as string | undefined,
    content: review.body ?? undefined,
  };

  return (
    <div>
      <Box key={review.unitId}>
        <Box sx={{ mt: 2 }}>
          <CollapsibleReview
            review={reviewData}
            contentClassName="leading-6"
            header={<ReviewHeader review={review} />}
            footer={<ReviewFooter review={review} onReply={onReply} />}
          />
        </Box>
      </Box>
    </div>
  );
};

export type SingleReviewContainerProps = {
  review: PostDTO;
  handleReply: (reviewId: string) => void;
};

export const SingleReviewContainer: React.FC<SingleReviewContainerProps> = ({
  review,
  handleReply,
}) => {
  return <SingleReviewShow review={review} onReply={handleReply} />;
};
