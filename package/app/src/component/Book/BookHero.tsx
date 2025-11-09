import {
  Box,
  Chip,
  Container as MuiContainer,
  Grid,
  Rating,
  Stack,
  Typography,
} from '@mui/material';
import React from 'react';
import {Link} from 'wouter';

import type {BookDTO} from '@package/contract';

type Book = BookDTO;

export const BookHeroShow: React.FC<{
  bookInfo: Book;
  rating: number;
}> = ({bookInfo, rating}) => {
  const tags = bookInfo?.tags ?? [];
  return (
    <div>
      <Box
        className="bg-cover bg-center relative"
        style={{backgroundImage: `url(${bookInfo?.coverUrl})`}}
      >
        {/* Light Pic test is fine, the black blur is thick so the text is always able to read */}
        {/* <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(https://static-cse.canva.cn/blob/239388/e1604019539295.jpg)` }}> */}
        <Box className="bg-black/66 backdrop-blur-md shadow-lg">
          <MuiContainer maxWidth="lg" className="py-6">
            <Grid container spacing={3}>
              {/* Cover Image */}
              <Grid
                size={{xs: 12, md: 3, lg: 2}}
                className="max-h-[300px] w-full"
              >
                <img
                  src={bookInfo?.coverUrl ?? ''}
                  alt={bookInfo?.title}
                  className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                />
              </Grid>

              {/* Book Info */}
              <Grid size={{xs: 12, md: 9}}>
                <Stack spacing={2}>
                  {/* Title and Rating */}
                  <Box className="flex justify-between items-center">
                    <Typography variant="h4" className="font-bold text-white">
                      {bookInfo?.title}
                    </Typography>
                    {/* <Box className="flex items-center gap-2">
                      <Rating
                        value={(rating || 0) / 2}
                        precision={0.5}
                        readOnly
                      />
                      <Typography variant="h6" className="text-amber-500">
                        {rating} / 10
                      </Typography>
                    </Box> */}
                  </Box>

                  {/* Author & Publisher Info */}
                  <Stack spacing={1} className="text-white">
                    <Typography>
                      作者：
                      <Box component="span" className="font-medium">
                        {bookInfo?.author?.[0]?.name}
                      </Box>
                    </Typography>
                    <Typography>
                      出版社：
                      {bookInfo?.press?.[0]?.name}
                    </Typography>
                    <Typography>
                      出品方：
                      {bookInfo?.producer?.[0]?.name}
                    </Typography>
                    <Typography>ISBN：{bookInfo?.isbn ?? ''}</Typography>
                  </Stack>

                  {/* Tags */}
                  <Stack direction="row" spacing={1}>
                    {tags?.map((tag: string) => (
                      <Chip
                        component={Link}
                        href={`/books?tags=${tag}`}
                        key={tag}
                        label={tag}
                        size="small"
                        onClick={() => {
                          console.log('tag clicked', tag);
                        }}
                        className="*:bg-white/10 *:text-white *:hover:bg-white/20 *:p-1"
                      />
                    ))}
                  </Stack>
                </Stack>
              </Grid>
            </Grid>
          </MuiContainer>
        </Box>
      </Box>
    </div>
  );
};

export type Container = {
  bookInfo: Book;
  rating: number;
};

export const BookHeroContainer: React.FC<Container> = ({bookInfo, rating}) => {
  return <BookHeroShow bookInfo={bookInfo} rating={rating} />;
};
