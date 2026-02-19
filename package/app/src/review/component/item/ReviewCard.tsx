import React from 'react';
import {Card, CardContent, Typography, Box, useTheme} from '@mui/material';
import type {ReviewMeiliDTO} from '@package/contract';
import {cn} from '@/shared/shadcn/lib/utils';
interface ReviewCardProps {
  review: ReviewMeiliDTO;
  className?: string;
}

const ReviewCard: React.FC<ReviewCardProps> = ({review, className}) => {
  const theme = useTheme();
  const bookMetadata = review.metadata?.book;

  return (
    <Card
      elevation={0}
      className={cn('w-full transition-all hover:shadow-md', className)}
    >
      <CardContent>
        {/* 中间主体：书籍信息与评论内容 */}
        <Box className="flex gap-4">
          {/* 左侧：书籍封面 */}
          {bookMetadata?.coverUrl && (
            <Box
              className="flex-shrink-0 w-20 h-28 overflow-hidden rounded shadow-sm"
              sx={{border: `1px solid ${theme.palette.divider}`}}
            >
              <img
                src={bookMetadata.coverUrl}
                alt={bookMetadata.title}
                className="w-full h-full object-cover"
              />
            </Box>
          )}

          {/* 右侧：文字详情 */}
          <Box className="flex-grow min-w-0">
            {bookMetadata?.title && (
              <Typography
                variant="caption"
                className="block truncate"
                sx={{letterSpacing: 1}}
              >
                《{bookMetadata.title}》
              </Typography>
            )}

            {review.title && (
              <Typography
                variant="h6"
                className="truncate"
                sx={{fontSize: '1.1rem', color: 'text.primary'}}
              >
                {review.title}
              </Typography>
            )}

            <Typography
              variant="body2"
              color="text.secondary"
              className="line-clamp-3 text-justify"
              sx={{lineHeight: 1.6}}
            >
              {review.content}
            </Typography>

            {!review.title && (
              <Typography
                variant="h6"
                className="invisible"
                sx={{fontSize: '1.1rem', color: 'text.primary'}}
              >
                Blank Title
              </Typography>
            )}
          </Box>
        </Box>

        <Box className="flex items-center justify-between text-xs text-muted-foreground mt-2">
          {/* Left: 统计信息占位 */}
          <Box className="flex items-center gap-2">
            {/* TODO 根据 reactionSummaries 结构循环渲染点赞等图标 */}0 观看
          </Box>

          {/* Right: 用户名 + 评分 */}
          <Box className="flex items-center gap-2">
            <Typography
              variant="caption"
              color="primary"
              noWrap
              sx={{lineHeight: 1}}
            >
              {review.user?.name || '匿名'}
            </Typography>

            {review.rating !== undefined && (
              <Typography
                variant="caption"
                color="secondary"
                noWrap
                sx={{lineHeight: 1}}
              >
                {review.rating}
              </Typography>
            )}
          </Box>
        </Box>

        {/* {review.reactionSummaries && (
          <Box className="mt-3 flex gap-2">
          </Box>
        )} */}
      </CardContent>
    </Card>
  );
};

export default ReviewCard;
