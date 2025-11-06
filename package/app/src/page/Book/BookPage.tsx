import {BookReviews} from '@/component/Book/BookReviewsPreview.tsx';
import {TagWrapper} from '@/component/Tag/TagWrapper.tsx';
import {ShortBookReviews} from '@/component/Book/ShortBookReviewsPreview.tsx';
import {AccentBarWithTextContainer} from '@component/Common/AccentBar.tsx';
import {TabContext, TabList, TabPanel} from '@mui/lab';
import {Box, Divider, Grid, Paper, Stack, Tab, Typography} from '@mui/material';
import React, {useEffect, useRef} from 'react';
import {useLocation} from 'wouter';

import {AuthorInfoContainer} from '@/component/Book/AuthorInfo.tsx';
import {BookDescription} from '@/component/Book/BookDescription';
import {QuoteExcerptPreviewContainer} from '@/component/Book/QuoteExcerptPreview.tsx';
import {ReadlistByBookPreview} from '@/component/Book/ReadlistByBookPreview.tsx';
import {ArrowForwardIconContainer} from '@/component/Common/ArrowForwardIcon.tsx';
import {BookHeroContainer} from '@component/Book/BookHero.tsx';
import {ChapterListContainer} from '@/component/Book/Chapter/ChapterList';

import {useBookPageStore} from '@/global/page/bookPageStore.ts';
import {routeStore} from '@/global/routeStore.ts';
import {scroll, startThrottledScroll} from '@/util/ScrollUtil.ts';
import {useScrollRestore} from '@/util/useScrollRestore.ts';

import {bookQueries} from '@/api/book/book';
import {useQuery, useSuspenseQuery} from '@tanstack/react-query';

import type {BookDTO} from '@package/contract';

type Book = BookDTO;

type TabValue = '0' | '1' | '2';

type ShowProps = {
  ref?: React.Ref<unknown>;
  bookInfo: Book;
  rating: number;
  activeTab: string;
  onTabChange?: (
    event: React.SyntheticEvent | null,
    newValue: TabValue,
  ) => void;
};

export const BookPageShow: React.FC<ShowProps> = ({
  ref,
  bookInfo,
  rating,
  activeTab,
  onTabChange,
}) => {
  console.log('BookPageShow render', bookInfo);
  return (
    <Box id="book-detail" ref={ref}>
      {/* Book Overview */}
      <BookHeroContainer bookInfo={bookInfo} rating={rating} />

      {/* Main Content */}
      <Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
        <Grid container spacing={4}>
          {/* Main Content */}
          <Grid size={{xs: 12, lg: 9}}>
            <TabContext value={activeTab}>
              <TabList onChange={onTabChange}>
                <Tab label="基本信息" value="0" />
                <Tab label="书评" value="1" />
                <Tab label="目录" value="2" />
              </TabList>
              <TabPanel value="0">
                <Stack spacing={4}>
                  {/* ANCHOR Description */}
                  <BookDescription.Container
                    description={bookInfo?.description || ''}
                    bookId={bookInfo?.unitId || ''}
                  />
                  <Divider />

                  {/* ANCHOR Tags */}
                  <div>
                    <ArrowForwardIconContainer
                      size={16}
                      to={`/tag/book/${bookInfo?.unitId}/tags`}
                    >
                      <AccentBarWithTextContainer text="Tags" />
                    </ArrowForwardIconContainer>
                  </div>
                  <TagWrapper
                    filters={{objectId: bookInfo?.unitId || ''}}
                    mode="grouped"
                  />
                  <Divider />

                  {/* ANCHOR Author Info */}
                  <AuthorInfoContainer
                    author={
                      bookInfo?.author?.[0] || {
                        id: '',
                        name: '',
                        bio: '',
                      }
                    }
                  />
                  <Divider />

                  {/* ANCHOR 最新章节 */}

                  {/* ANCHOR Quote Excerpt Preview */}
                  <div>
                    <ArrowForwardIconContainer
                      size={16}
                      to={`/quote/book/${bookInfo?.unitId}`}
                    >
                      <AccentBarWithTextContainer text="原文摘录" />
                    </ArrowForwardIconContainer>
                  </div>
                  <QuoteExcerptPreviewContainer id={bookInfo?.unitId || ''} />
                  <Divider />

                  {/* ANCHOR Short Reviews */}
                  <Box>
                    <div>
                      <ArrowForwardIconContainer
                        size={16}
                        to={`/review/short/book/${bookInfo?.unitId}`}
                      >
                        <AccentBarWithTextContainer text="短评" />
                      </ArrowForwardIconContainer>
                    </div>
                    <ShortBookReviews bookId={bookInfo?.unitId || ''} />
                  </Box>
                </Stack>
              </TabPanel>

              <TabPanel value="1">
                <Stack spacing={4}>
                  {/* ANCHOR Book Rating */}
                  {/* TODO 书籍评分综合组件，展示书籍评分（默认为总评分），星级分布，Summary 中应当包含大致的组织组织分布情况，点击进入专门的评分展示Page，展示各个组织的评分，并支持进一步点击查看各个组织的评论，同时也有快捷键编辑/发布自己的评分/评论 */}

                  {/* ANCHOR Book Reviews */}
                  <BookReviews
                    bookId={bookInfo?.unitId || ''}
                    title={bookInfo?.title || ''}
                  />

                  {/* ANCHOR Book Lists */}
                  <ReadlistByBookPreview
                    bookId={bookInfo?.unitId || ''}
                    title={bookInfo?.title || ''}
                  />
                </Stack>
              </TabPanel>

              <TabPanel value="2">
                <Stack spacing={4}>
                  {/* ANCHOR Chapter List */}
                  <ChapterListContainer id={bookInfo?.unitId || '0'} />
                </Stack>
              </TabPanel>
            </TabContext>
          </Grid>

          {/* ANCHOR Sidebar */}
          <Grid size={{xs: 12, lg: 3}}>
            <Paper className="p-3 mt-4">
              <Divider className="my-4" />

              {/* Book Info */}
              <Box>
                <Typography variant="h6" className="font-bold mb-4">
                  书籍信息
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    书名：{bookInfo?.title}
                  </Typography>
                  <Typography variant="body2">
                    作者：{bookInfo?.author?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    出版社：{bookInfo?.press?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    出品方：
                    {bookInfo?.producer?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    ISBN：{bookInfo?.isbn ?? ' '}
                  </Typography>
                </Stack>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export type ContainerProps = {
  bookId: string;
};

export const BookPageContainer: React.FC<ContainerProps> = ({bookId}) => {
  const [location] = useLocation();

  const getInitialTab = (): TabValue => {
    const routeData = routeStore.getState().getRouteData(String(location));
    return (routeData?.tab as TabValue) || '0';
  };
  const [activeTab, setActiveTab] = React.useState<TabValue>(getInitialTab);

  const tabRef = useRef<TabValue>(getInitialTab());

  useScrollRestore(location, tabRef, startThrottledScroll, scroll);

  const handleTabChange = (
    _: React.SyntheticEvent | null,
    newValue: TabValue,
  ) => {
    console.log('handleTabChange', newValue);
    tabRef.current = newValue;
    setActiveTab(newValue);
  };

  // ANCHOR Data Fetching
  const book: any = useBookPageStore(s => s.books[bookId]);
  // const { data, isLoading, error } = useQuery(bookQueries.byId(bookId));
  const {data, isLoading, error} = useQuery(bookQueries.detail(bookId));
  const rating = 8.5;

  useEffect(() => {
    useBookPageStore.getState().updateBook(bookId, {...data});
  }, [data, isLoading, bookId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Oh no... {String(error)}</div>;
  }

  return (
    <BookPageShow
      bookInfo={book}
      rating={rating}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
