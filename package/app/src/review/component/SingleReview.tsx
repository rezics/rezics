import { Avatar, Box, Collapse, Tooltip, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ReactionBar } from "@/engagement/component/ReactionBar";
import { ReactionStatistics } from "@/engagement/component/ReactionStatistics";
import { parseReactionSummaries } from "@/shared/util/reaction-summaries-parser";

export const ReviewHeader: React.FC<{
  review: PostDTO;
}> = ({ review }) => {
  const { t } = useTranslation();
  const followersCount = review.author?.followersCount ?? 0;
  // Rating from post.extra.rating (legacy) or linked ScoreEntry via scoreEntryId
  const rating = (review.extra as any)?.rating as number | undefined;
  return (
    <div className="flex flex-wrap items-center mb-2 gap-2">
      <Tooltip title={t("review.open_user_interface")} placement="top-start">
        <Link
          to="/user/$unitId"
          params={{ unitId: review.author?.unitId ?? "" }}
          className="flex items-center"
        >
          <Avatar src={review.author?.avatar ?? ""} variant="rounded" />
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
                  : ""}
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
      <div className="ml-2">
        <ReactionStatistics reactionSummaries={reactionSummaries} />
      </div>
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

const COLLAPSED_MAX_HEIGHT = 200;

export type SingleReviewShowProps = {
  review: PostDTO;
  onReply: (reviewId: string) => void;
};

export const SingleReviewShow: React.FC<SingleReviewShowProps> = ({
  review,
  onReply,
}) => {
  const [expanded, setExpanded] = useState(false);
  const title = (review.extra as any)?.title as string | undefined;
  const content = review.body ?? "";

  return (
    <Box key={review.unitId} sx={{ mt: 2 }}>
      <ReviewHeader review={review} />

      {title && (
        <Typography variant="h6" fontWeight={600} mb={1}>
          {title}
        </Typography>
      )}

      <Box sx={{ position: "relative" }}>
        <Collapse in={expanded} collapsedSize={COLLAPSED_MAX_HEIGHT}>
          <Typography
            variant="body1"
            className="leading-6 whitespace-pre-wrap"
          >
            {content}
          </Typography>
        </Collapse>
        {!expanded && content.length > 300 && (
          <Box
            sx={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background:
                "linear-gradient(transparent, var(--mui-palette-background-paper))",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              cursor: "pointer",
            }}
            onClick={() => setExpanded(true)}
          >
            <Typography variant="caption" color="primary">
              Show more
            </Typography>
          </Box>
        )}
      </Box>

      <ReviewFooter review={review} onReply={onReply} />
    </Box>
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
