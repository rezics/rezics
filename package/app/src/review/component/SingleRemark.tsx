import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import { Box, Tooltip, Typography } from "@mui/material";
import type { PostDTO } from "@rezics/contract";
import { LazyLoadImage } from "@rezics/ui/primitive/image/LazyLoadImage.tsx";
import { MUILink } from "@rezics/ui/primitive/link/MUILink.tsx";
import { CollapsibleByLineTextContainer } from "@rezics/ui/primitive/typography/collapsible-text/CollapsibleByLineText.tsx";
import type React from "react";
import { useEffect, useState } from "react";
import {
  parseReactionSummaries,
  type ReactionSummaryDTO,
} from "@/shared/util/reaction-summaries-parser";

/**
 * MetaInfoBadge for a remark post.
 * Rating is stored in post.extra.rating if available.
 */
export function MetaInfoBadge({
  review,
  isRecommended,
}: {
  review: PostDTO;
  isRecommended: boolean;
}) {
  // MOCK: rating from post.extra.rating
  const rating = (review.extra as any)?.rating as number | undefined;
  const dateStr = review.createdAt
    ? new Date(String(review.createdAt)).toLocaleDateString()
    : '';

  return (
    <Tooltip title="阅读完整评测" placement="top-start">
      <Box
        component={MUILink}
        to={`/remark/${review.unitId}`}
        className="flex items-center gap-1"
        sx={{
          textDecoration: "none",
          color: "inherit",
          p: 0.5,
          borderRadius: 1,
          transition: "background-color 0.2s ease",
          "&:hover": {
            backgroundColor: "action.hover",
          },
        }}
      >
        {isRecommended ? (
          <ThumbUpIcon fontSize="small" color="primary" />
        ) : (
          <ThumbDownIcon fontSize="small" color="disabled" />
        )}

        <Typography variant="caption">
          {rating?.toFixed(1) ?? "0.0"}/10 · {dateStr}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export type SingleRemarkShowProps = {
  review: PostDTO;
  onLike?: (postId: string) => void;
  onDislike?: (postId: string) => void;
};

export const SingleRemarkShow: React.FC<SingleRemarkShowProps> = ({
  review,
  onLike,
  onDislike,
}) => {
  const _handleLike = () => {
    onLike?.(review.unitId);
  };

  const _handleDislike = () => {
    onDislike?.(review.unitId);
  };

  // MOCK: rating from post.extra.rating
  const rating = (review.extra as any)?.rating as number | undefined;
  const isRecommended = !!(rating && rating >= 3);

  const [reactionSummaries, setReactionSummaries] =
    useState<ReactionSummaryDTO>({});

  useEffect(() => {
    const reactionSummariesArray = review.reactionSummaries ?? [];
    setReactionSummaries(parseReactionSummaries(reactionSummariesArray));
  }, [review]);

  return (
    <div className="py-4 border-b border-gray-200">
      <div className="flex gap-3">
        <LazyLoadImage
          src={review.author?.avatar || ""}
          alt={review.author?.name || ""}
          className="w-10 h-10 rounded-md object-cover mt-2"
        />

        <div className="flex-1 flex flex-col gap-2">
          {/* Row 1: User Info and Rating */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {review.author?.name || ""}
            </span>
            <MetaInfoBadge review={review} isRecommended={isRecommended} />
          </div>

          {/* Row 2: Review Content (body replaces content) */}
          <div>
            <CollapsibleByLineTextContainer
              content={review.body ?? ''}
              maxLines={4}
            />
          </div>

          {/* Row 3: Reactions */}
          <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="flex items-center space-x-1">
              </div>
              <div className="text-xs flex items-center gap-2">
                <span>{reactionSummaries?.likes ?? 0} 人支持</span>
              </div>
            </div>
            <Tooltip title="回复数">
              <div className="flex items-center gap-1 cursor-pointer hover:text-blue-500">
                <ChatBubbleOutlineIcon style={{ fontSize: "1rem" }} />
                <span className="text-xs">
                  {review.replyCount ?? 0}{" "}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};
