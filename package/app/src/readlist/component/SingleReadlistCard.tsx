import type {ReadlistResponse} from '@package/contract';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {useNavigate} from '@tanstack/react-router';
import React from 'react';
import {MiniActionBar} from '@/component/reaction/MiniActionBar';
import {LazyLoadImage} from '@package/ui/primitive/image/LazyLoadImage.tsx';

interface SingleReadlistProps {
  data: ReadlistResponse;
  handleBookListClick: (id: string, e: React.MouseEvent) => void;
  handleLike: (id: string) => void;
}

/**
 * use https://github.com/jaredLunde/masonic to build a waterfall list
 * @param param0
 * @returns
 */
export function SingleReadlist({
  data,
  handleBookListClick,
  handleLike,
}: SingleReadlistProps) {
  const navigate = useNavigate();
  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
      onClick={e => navigate({to: `/readlist/${data.id}`})}
    >
      <CardContent sx={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        <Typography variant="h6" fontWeight="bold" gutterBottom>
          {data.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mb: 2,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.content}
        </Typography>

        <Grid container spacing={1} sx={{mb: 2}}>
          {/* <div>
            {data.books.slice(0, 4).map((book, index) => (
              <Grid size={{xs: 3}} key={book.unitId}>
                {book.coverUrl ? (
                  <Box component="img" src={book.coverUrl} />
                ) : null}
              </Grid>
            ))}
          </div> */}
          <div
            className="relative w-full overflow-hidden rounded-md"
            style={{aspectRatio: '16 / 9'}}
          >
            <LazyLoadImage
              src={data.coverUrl ?? ''}
              alt={data.title}
              className="w-full h-full object-cover"
            />
          </div>
        </Grid>

        <Box
          sx={{
            mt: 'auto',
            pt: 2,
            borderTop: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Avatar
              src={data.creator?.avatar ?? undefined}
              sx={{width: 24, height: 24}}
            />
            <Typography variant="body2" color="text.secondary">
              {data.creator?.name}
            </Typography>
          </Stack>

          <Stack spacing={1} alignItems="center">
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              onClick={e => {
                e.stopPropagation();
                handleLike(data.id);
              }}
              className="flex items-center"
            >
              <Typography color="text.secondary">
                {data.reactionSummaries.find((r: any) => r.reaction === 'like')
                  ?.count ?? 0}
              </Typography>
              <MiniActionBar
                unitId={data.id}
                hideReply={true}
                reactionSummaries={data.reactionSummaries}
              />
            </div>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
