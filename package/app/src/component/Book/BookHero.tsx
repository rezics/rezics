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
import {useUserStore} from '@/global/userStore';

import type {BookDTO} from '@package/contract';
import {
  MiniActionBar,
  MiniAdminActionBar,
} from '../Common/Reaction/MiniActionBar';

type Book = BookDTO;

export const BookHeroReactionBar: React.FC<{
  bookInfo: any;
  className?: string;
}> = ({bookInfo, className}) => {
  const color = 'text-white';
  return (
    <div className={className}>
      <MiniAdminActionBar
        editionURL={`/book/${bookInfo?.unitId}/edit`}
        textColor={color}
        userUnitId={bookInfo?.user?.unitId}
      />
      <MiniActionBar
        hideReply={true}
        className={className ?? ''}
        textColor={color}
        unitId={bookInfo?.unitId}
      />
    </div>
  );
};

export const BookHeroShow: React.FC<{
  bookInfo: Book;
  rating: number;
}> = ({bookInfo, rating}) => {
  const tags = bookInfo?.tags ?? [];
  const user: any = useUserStore(state => state.user);
  return (
    <div>
      <Box
        className="bg-cover bg-center relative"
        style={{backgroundImage: `url(${bookInfo?.coverUrl ?? undefined})`}}
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
                  src={bookInfo?.coverUrl ?? undefined}
                  alt={bookInfo?.title}
                  className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                />
              </Grid>

              {/* Book Info */}
              <Grid size={{xs: 12, md: 6}}>
                <Stack spacing={2}>
                  {/* Title and Rating */}
                  <Box className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      <Typography
                        variant="h4"
                        className="font-bold text-white break-words" // optional: break-words
                      >
                        {bookInfo?.title}
                      </Typography>

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
                        <Typography>
                          字数：{bookInfo?.textLength ?? 0}
                        </Typography>
                        <Typography>ISBN：{bookInfo?.isbn ?? ''}</Typography>
                      </Stack>

                      {/* Tags */}
                      <Box className="flex flex-wrap gap-2 mt-2">
                        {tags?.map(tag => (
                          <Chip
                            key={tag}
                            component={Link}
                            href={`/book?tags=${tag}`}
                            label={tag}
                            size="small"
                            className="*:bg-white/10 *:text-white *:hover:bg-white/20 *:px-2 *:py-1"
                          />
                        ))}
                      </Box>
                    </div>
                  </Box>
                </Stack>
              </Grid>

              {/* Reaction Bar */}
              <Grid size={{xs: 12, md: 3}}>
                <div className="flex items-center gap-2 justify-end">
                  <div className="flex flex-col items-start gap-2">
                    <div className="flex items-center gap-2">
                      <Rating
                        // value={(rating || 0) / 2}
                        value={rating}
                        precision={0.5}
                        readOnly
                      />
                      <Typography variant="h6" className="text-amber-500">
                        {rating} / 10
                      </Typography>
                    </div>
                    <BookHeroReactionBar
                      bookInfo={bookInfo}
                      className="self-end"
                    />
                  </div>
                </div>
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
