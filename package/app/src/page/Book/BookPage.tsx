import {BookReviews} from '@/component/Book/BookReviewsPreview.tsx';
import {TagWrapper} from '@/component/Tag/TagWrapper.tsx';
import {RemarkPreview} from '@/component/Book/RemarkPreview';
import {AccentBarWithTextContainer} from '@/component/Common/Navigation/AccentBar';
import {TabContext, TabList, TabPanel} from '@mui/lab';
import {Box, Divider, Grid, Paper, Stack, Tab, Typography} from '@mui/material';
import React, {useEffect, useMemo, useRef} from 'react';
import {useNavigate, useRouterState} from '@tanstack/react-router';

import {AuthorInfoContainer} from '@/component/Book/AuthorInfo.tsx';
import {BookDescription} from '@/component/Book/BookDescription';
import {QuoteExcerptPreviewContainer} from '@/component/Book/QuoteExcerptPreview.tsx';
import {ReadlistByBookPreview} from '@/component/Book/ReadlistByBookPreview.tsx';
import {ArrowForwardIconContainer} from '@/component/Common/Navigation/ArrowForwardIcon';
import {BookHeroContainer} from '@component/Book/BookHero.tsx';
import {ChapterListContainer} from '@/component/Book/Chapter/ChapterList';

import {useBookPageStore} from '@/global/page/bookPageStore.ts';
import {routeStore} from '@/global/routeStore.ts';

import {bookQueries} from '@package/api/book/book';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';

import type {BookDTO} from '@package/contract';
import {useParams} from '@tanstack/react-router';

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
  const {t} = useTranslation();
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
                <Tab label={t('page.book.tabs.basic_info')} value="0" />
                <Tab label={t('page.book.tabs.reviews')} value="1" />
                <Tab label={t('page.book.tabs.toc')} value="2" />
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
                      to={`/tag/book/${bookInfo?.unitId}/tag`}
                    >
                      <AccentBarWithTextContainer text={t('book.tags')} />
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
                        unitId: '',
                        name: '',
                        bio: '',
                        description: '',
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
                      <AccentBarWithTextContainer
                        text={t('book.quote_excerpts')}
                      />
                    </ArrowForwardIconContainer>
                  </div>
                  <QuoteExcerptPreviewContainer id={bookInfo?.unitId || ''} />
                  <Divider />

                  {/* ANCHOR Remark */}
                  <Box>
                    <div>
                      <ArrowForwardIconContainer
                        size={16}
                        to={`/review/book/${bookInfo?.unitId}?tab=remark`}
                      >
                        <AccentBarWithTextContainer text={t('book.remark')} />
                      </ArrowForwardIconContainer>
                    </div>
                    <RemarkPreview bookId={bookInfo?.unitId || ''} />
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
                  {t('book.info_panel.title')}
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">
                    {t('book.fields.title')}：{bookInfo?.title}
                  </Typography>
                  <Typography variant="body2">
                    {t('book.fields.author')}：
                    {bookInfo?.author?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    {t('book.fields.press')}：{bookInfo?.press?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    {t('book.fields.producer')}：
                    {bookInfo?.producer?.[0]?.name ?? ''}
                  </Typography>
                  <Typography variant="body2">
                    {t('book.fields.text_length')}：{bookInfo?.textLength ?? 0}
                  </Typography>
                  <Typography variant="body2">
                    {t('book.fields.isbn')}：{bookInfo?.isbn ?? ' '}
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

export const BookPageContainer: React.FC = () => {
  const {bookId} = useParams({strict: false});
  const navigate = useNavigate();
  const locationKey = useRouterState({
    select: s => s.location.pathname + s.location.searchStr,
  });
  const searchStr = useRouterState({
    select: s => s.location.searchStr,
  });
  const searchParams = useMemo(
    () => new URLSearchParams(searchStr),
    [searchStr],
  );
  const {t} = useTranslation();

  const getInitialTab = (): TabValue => {
    const tabParam = searchParams.get('tab');
    if (tabParam === '0' || tabParam === '1' || tabParam === '2') {
      return tabParam as TabValue;
    }

    const routeData = routeStore.getState().getRouteData(String(locationKey));
    const storeTab = routeData?.tab;
    if (storeTab === '0' || storeTab === '1' || storeTab === '2') {
      return storeTab as TabValue;
    }

    return '0';
  };
  const [activeTab, setActiveTab] = React.useState<TabValue>(getInitialTab);

  const tabRef = useRef<TabValue>(getInitialTab());

  const handleTabChange = (
    _: React.SyntheticEvent | null,
    newValue: TabValue,
  ) => {
    console.log('handleTabChange', newValue);
    tabRef.current = newValue;
    setActiveTab(newValue);

    routeStore.getState().setRouteData(String(locationKey), {
      tab: newValue,
    });

    navigate({to: `/book/${bookId}?tab=${newValue}`});
  };

  // REVIEW 会导致重复写入嘛？
  useEffect(() => {
    routeStore.getState().setRouteData(String(locationKey), {
      tab: activeTab,
    });
  }, [locationKey, activeTab]);

  // ANCHOR Data Fetching
  const book: any = useBookPageStore(s => s.books[bookId]);
  // const { data, isLoading, error } = useQuery(bookQueries.byId(bookId));
  const {data, isLoading, error} = useQuery(bookQueries.detail(bookId));
  const {data: rating} = useQuery(bookQueries.rating(bookId));
  const ratingValue = useMemo(() => {
    const average = (rating?.totalScore || 0) / (rating?.totalCount || 1) || 0;
    return Number(average.toFixed(1));
  }, [rating]);

  useEffect(() => {
    useBookPageStore.getState().updateBook(bookId, {...data});
  }, [data, isLoading, bookId]);

  if (isLoading) {
    return <div>{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div>
        {t('common.error_generic')} {String(error)}
      </div>
    );
  }

  return (
    <BookPageShow
      bookInfo={book}
      rating={ratingValue || 0}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
