import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import {Box, Tooltip, Typography} from '@mui/material';
import {Link} from 'wouter';
import type {ReviewDTO} from '@package/contract';
import React, {useState, useEffect} from 'react';
// import { CollapsibleText } from "../Common/CollapsibleText";
import {CollapsibleByLineTextContainer} from '../Common/CollapsibleByLineText';

export function MetaInfoBadge({
  review,
  isRecommended,
}: {
  review: ReviewDTO;
  isRecommended: boolean;
}) {
  return (
    <Tooltip title="阅读完整评测" placement="top-start">
      <Box
        component={Link}
        href={`/remark/${review.unitId}`}
        className="flex items-center gap-1"
        sx={{
          textDecoration: 'none',
          color: 'inherit',
          p: 0.5,
          borderRadius: 1,
          transition: 'background-color 0.2s ease',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
      >
        {isRecommended ? (
          <ThumbUpIcon fontSize="small" color="primary" />
        ) : (
          <ThumbDownIcon fontSize="small" color="disabled" />
        )}

        <Typography variant="caption">
          {review.rating?.toFixed(1) ?? '0.0'}/5.0 · {review.created_at}
        </Typography>
      </Box>
    </Tooltip>
  );
}

type ReactionSummaryDTO = {
  likes?: number;
  dislikes?: number;
  funny?: number;
  replies?: number;
};

export type SingleRemarkShowProps = {
  review: ReviewDTO;
  onLike?: (reviewId: string) => void;
  onDislike?: (reviewId: string) => void;
};

export const SingleRemarkShow: React.FC<SingleRemarkShowProps> = ({
  review,
  onLike,
  onDislike,
}) => {
  const handleLike = () => {
    onLike?.(review.unitId);
  };

  const handleDislike = () => {
    onDislike?.(review.unitId);
  };

  const isRecommended = review.rating && review.rating >= 3 ? true : false;

  const [reactionSummaries, setReactionSummaries] =
    useState<ReactionSummaryDTO>({});

  useEffect(() => {
    const reactionSummariesArray = review.reactionSummaries ?? [];
    const likes =
      reactionSummariesArray.find(reaction => reaction.reaction === 'like')
        ?.count ?? 0;
    const dislikes =
      reactionSummariesArray.find(reaction => reaction.reaction === 'dislike')
        ?.count ?? 0;
    const funny =
      reactionSummariesArray.find(reaction => reaction.reaction === 'love')
        ?.count ?? 0;
    const replies =
      reactionSummariesArray.find(reaction => reaction.reaction === 'reply')
        ?.count ?? 0;
    setReactionSummaries({likes, dislikes, funny, replies});
    console.log(review.reactionSummaries);
  }, [review]);

  return (
    <div className="py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-3">
        <img
          src={review.user?.avatar || ''}
          alt={review.user?.name || ''}
          className="w-10 h-10 rounded-md object-cover mt-2"
        />

        <div className="flex-1 flex flex-col gap-2">
          {/* Row 1: User Info and Rating */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">
              {review.user?.name || ''}
            </span>
            <MetaInfoBadge review={review} isRecommended={isRecommended} />
          </div>

          {/* Row 2: Review Content */}
          <div>
            {/* <p className="text-sm !line-clamp-4 mt-1">{review.content}</p> */}
            <CollapsibleByLineTextContainer
              content={review.content}
              maxLines={4}
            />
          </div>

          {/* Row 3: Reactions */}
          <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
            <div className="flex items-center">
              <div className="flex items-center space-x-1">
                <Tooltip title="有帮助" placement="bottom">
                  <button
                    onClick={handleLike}
                    className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <ThumbUpIcon style={{fontSize: '1rem'}} />
                  </button>
                </Tooltip>
                <Tooltip title="无帮助" placement="bottom">
                  <button
                    onClick={handleDislike}
                    className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
                  >
                    <ThumbDownIcon style={{fontSize: '1rem'}} />
                  </button>
                </Tooltip>
                <Tooltip title="欢乐" placement="bottom">
                  <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <SentimentSatisfiedAltIcon style={{fontSize: '1rem'}} />
                  </button>
                </Tooltip>
                <Tooltip title="颁奖" placement="bottom">
                  <button className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700">
                    <EmojiEventsIcon style={{fontSize: '1rem'}} />
                  </button>
                </Tooltip>
              </div>
              <div className="ml-4 text-xs flex items-center gap-2">
                <span>{reactionSummaries?.likes ?? 0} 人支持</span>
                <span>
                  {reactionSummaries?.funny ?? 0} 人觉得这篇评测很欢乐
                </span>
              </div>
              {/* TODO Add a new line to show Awards or don't show awards for short reviews */}
            </div>
            <Tooltip title="回复数">
              <div className="flex items-center gap-1 cursor-pointer hover:text-blue-500">
                <ChatBubbleOutlineIcon style={{fontSize: '1rem'}} />
                <span className="text-xs">
                  {reactionSummaries?.replies ?? 0}{' '}
                </span>
              </div>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  );
};
