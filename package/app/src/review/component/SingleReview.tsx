import { Avatar, Box, Rating, Tooltip, Typography } from "@mui/material";
import type { ReviewDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar } from "@/engagement/component/ReactionBar";
import { ReactionStatistics } from "@/engagement/component/ReactionStatistics";
import { CollapsibleReview } from "@/readlist/component/Review";
import { parseReactionSummaries } from "@/shared/util/reaction-summaries-parser";

export const ReviewHeader: React.FC<{
  review: ReviewDTO;
}> = ({ review }) => {
  const { t } = useTranslation();
  const followersCount = review.user?.followersCount ?? 0;
  return (
    <div className="flex flex-wrap items-center mb-2 gap-2">
      <Tooltip title={t("review.open_user_interface")} placement="top-start">
        <Link
          to="/user/$unitId"
          params={{ unitId: review.user?.unitId ?? "" }}
          className="flex items-center"
        >
          {/* Avatar */}
          <Avatar src={review.user?.avatar ?? ""} variant="rounded" />

          {/* User Info */}
          <div className="ml-2">
            <Typography variant="subtitle1" fontWeight="bold">
              {review.user?.name}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {followersCount} followers
            </Typography>
          </div>
        </Link>
      </Tooltip>

      {/* Follow Button removed because performance issue */}

      {/* Rating + Time (push to right, but wrap under on small screens) */}
      <div className="ml-auto text-right min-w-[120px]">
        <Tooltip title={t("review.open_review_page")} placement="top-end">
          <Link to="/review/$reviewId" params={{ reviewId: review.unitId }}>
            <div>
              <Rating defaultValue={review.rating} precision={0.5} readOnly />
              <Typography variant="body2" color="text.secondary">
                {review.created_at}
              </Typography>
            </div>
          </Link>
        </Tooltip>
      </div>
    </div>
  );
};

const ReviewFooter: React.FC<{
  review: ReviewDTO;
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
  review: ReviewDTO;
  onReply: (reviewId: string) => void;
};

export const SingleReviewShow: React.FC<SingleReviewShowProps> = ({
  review,
  onReply,
}) => {
  return (
    <div>
      <Box key={review.unitId}>
        <Box sx={{ mt: 2 }}>
          <CollapsibleReview
            review={review}
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
  review: ReviewDTO;
  handleReply: (reviewId: string) => void;
};

export const SingleReviewContainer: React.FC<SingleReviewContainerProps> = ({
  review,
  handleReply,
}) => {
  return <SingleReviewShow review={review} onReply={handleReply} />;
};
