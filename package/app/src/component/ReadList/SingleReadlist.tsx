import React from 'react';
import type {ReadlistResponse} from '@package/contract';
import {
  Card,
  CardMedia,
  Box,
  Typography,
  IconButton,
  Tooltip,
} from '@mui/material';
import ThumbUpAltOutlinedIcon from '@mui/icons-material/ThumbUpAltOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import {Link} from 'wouter';

interface SingleReadlistProps {
  data: ReadlistResponse;
  handleBookListClick: (id: string, e: React.MouseEvent) => void;
  handleLike: (id: string) => void;
  handleFavorite?: (id: string) => void; // optional收藏
  className?: string; // allow external styling overrides
}

/**
 * Horizontal strip readlist card.
 * - Entire card navigates via link & handleBookListClick
 * - Like / Favorite buttons stop propagation to avoid navigation
 */
export function SingleReadlist({
  data,
  handleBookListClick,
  handleLike,
  handleFavorite,
  className = '',
}: SingleReadlistProps) {
  const id = data.id;
  const likeCount = data.likes ?? 0;
  const authorName = data.creator?.name ?? data.creator?.slug ?? '—';
  const cover = data.coverUrl;

  return (
    <Card
      component={Link as any}
      href={`/readlist/${id}`}
      onClick={(e: React.MouseEvent) => handleBookListClick(id, e)}
      elevation={0}
      className={`mt-4 h-[200px] flex flex-row items-stretch gap-4 w-full ${className}`}
    >
      {/* Cover */}
      <CardMedia
        component="img"
        image={cover || '/placeholder-cover.png'}
        alt={data.title}
        style={{width: '36%', objectFit: 'cover'}}
      />
      {/* Right content */}
      <Box className="flex flex-1 flex-col justify-between min-w-0">
        <Box className="flex flex-col gap-1 min-w-0">
          <Typography
            variant="subtitle1"
            className="font-semibold truncate"
            title={data.title}
          >
            {data.title}
          </Typography>
          {data.content && (
            <Typography
              variant="body2"
              color="text.secondary"
              className="line-clamp-2 whitespace-pre-wrap"
            >
              {data.content}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary">
            {authorName}
          </Typography>
        </Box>
        <Box className="flex flex-row items-center justify-between mt-2">
          <Box className="flex flex-row items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {data.books?.length ? <span>{data.books.length} 本书</span> : null}
            {data.reviews?.length ? (
              <span>{data.reviews.length} 评论</span>
            ) : null}
          </Box>
          <Box className="flex flex-row items-center gap-1">
            <Tooltip title={`点赞 (${likeCount})`}>
              <IconButton
                size="small"
                aria-label="like"
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleLike(id);
                }}
              >
                <ThumbUpAltOutlinedIcon fontSize="small" />
                <Typography variant="caption" className="ml-1">
                  {likeCount}
                </Typography>
              </IconButton>
            </Tooltip>
            {handleFavorite && (
              <Tooltip title="收藏">
                <IconButton
                  size="small"
                  aria-label="favorite"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFavorite(id);
                  }}
                >
                  <BookmarkAddOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Box>
    </Card>
  );
}
