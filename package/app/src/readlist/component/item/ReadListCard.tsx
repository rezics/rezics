import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  useTheme,
} from '@mui/material';
import type {ReadlistDTO} from '@rezics/contract';
import {cn} from '@/shared/util/css-util';
import {useNavigate} from '@tanstack/react-router';

interface ReadListCardProps {
  readlist: ReadlistDTO;
  className?: string;
}

const ReadListCard: React.FC<ReadListCardProps> = ({readlist, className}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const booksCount = readlist.books?.length ?? 0;
  const reviewsCount = readlist.reviews?.length ?? 0;

  const handleOpenReadList = () => {
    if (!readlist.id) return;
    navigate({to: '/readlist/$readlistId', params: {readlistId: readlist.id}});
  };

  return (
    <Card elevation={0} className={cn('w-full transition-all mb-1', className)}>
      <CardActionArea onClick={handleOpenReadList} disabled={!readlist.id}>
        <Box
          className="w-full aspect-[16/9] overflow-hidden relative"
          sx={{borderBottom: `1px solid ${theme.palette.divider}`}}
        >
          {readlist.coverUrl ? (
            <img
              src={readlist.coverUrl}
              alt={readlist.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <Box
              className="w-full h-full flex items-center justify-center"
              sx={{
                background: `linear-gradient(135deg, ${theme.palette.action.hover}, ${theme.palette.background.default})`,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                无封面
              </Typography>
            </Box>
          )}
        </Box>

        <CardContent>
          <Typography variant="h6" className="truncate">
            {readlist.title || '未命名书单'}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
            className="line-clamp-2 mt-1"
          >
            {readlist.content || '暂无简介'}
          </Typography>

          <Box className="flex items-center justify-between text-xs text-muted-foreground mt-3">
            <Box className="flex items-center gap-2">
              <Typography variant="caption" color="text.secondary">
                {booksCount} 本书
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {reviewsCount} 书评
              </Typography>
            </Box>

            <Typography
              variant="caption"
              color="primary"
              noWrap
              sx={{lineHeight: 1}}
            >
              {readlist.creator?.name || '匿名'}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};

export default ReadListCard;
