import type {ReadlistResponse} from '@package/contract';
import {Favorite} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Grid,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import {useLocation} from 'wouter';
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
  const [, navigate] = useLocation();
  return (
    <Card
      sx={{
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
        '&:hover': {
          boxShadow: 4,
        },
      }}
      onClick={e => navigate(`/readlist/${data.id}`)}
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
          <img src={data.coverUrl} alt={data.title} />
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

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={e => {
                e.stopPropagation();
                handleLike(data.id);
              }}
            >
              <Favorite fontSize="small" />
            </IconButton>
            <Typography variant="body2" color="text.secondary">
              {data.likes}
            </Typography>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}
