import { BookReviews } from "@/component/Book/BookReviewsPreview.tsx";
import { BookTagView } from "@/component/Book/BookTagPreview.tsx";
import { ShortBookReviews } from "@/component/Book/ShortBookReviewsPreview.tsx";
import { AccentBarWithTextContainer } from "@component/Common/AccentBar.tsx";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { Box, Divider, Grid, Paper, Stack, Tab, Typography } from "@mui/material";
import React, { useEffect, useRef } from "react";
import { useLocation } from "wouter";

import { AuthorInfoContainer } from "@/component/Book/AuthorInfo.tsx";
import { BookDescriptionContainer } from "@/component/Book/BookDescription.tsx";
import { QuoteExcerptPreviewContainer } from "@/component/Book/QuoteExcerptPreview.tsx";
import { ReadlistByBookPreview } from "@/component/Book/ReadlistByBookPreview.tsx";
import { ArrowForwardIconContainer } from "@/component/Common/ArrowForwardIcon.tsx";
import { BookHeroContainer } from "@component/Book/BookHero.tsx";
import { ChapterListContainer } from "@component/Book/ChapterList.tsx";

import { useBookPageStore } from "@/global/page/bookPageStore.ts";
import { routeStore } from "@/global/routeStore.ts";
import { scroll, startThrottledScroll } from "@/util/ScrollUtil.ts";
import { useScrollRestore } from "@/util/useScrollRestore.ts";

import type { BookDetail } from "@/api/book/Book";
import { bookQueries } from "@/api/book/Book";
import { useQuery } from "@tanstack/react-query";

type TabValue = "0" | "1" | "2";

type ShowProps = {
  ref?: React.Ref<unknown>;
  bookInfo: BookDetail;
  tags: string[];
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
  tags,
  rating,
  activeTab,
  onTabChange,
}) => {
  return (
    <Box id="book-detail" ref={ref}>
      {/* Book Overview */}
      <BookHeroContainer bookInfo={bookInfo} tags={tags} rating={rating} />

      {/* Main Content */}
      <Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
        <Grid container spacing={4}>
          {/* Main Content */}
          <Grid size={{ xs: 12, lg: 9 }}>
            <TabContext value={activeTab}>
              <TabList onChange={onTabChange}>
                <Tab label="基本信息" value="0" />
                <Tab label="书评" value="1" />
                <Tab label="目录" value="2" />
              </TabList>
              <TabPanel value="0">
                <Stack spacing={4}>
                  {/* ANCHOR Description */}
                  <BookDescriptionContainer
                    description={bookInfo?.description || ""}
                    bookId={bookInfo?.id || ""}
                  />
                  <Divider />

                  {/* ANCHOR Tags */}
                  <BookTagView.Container bookId={bookInfo?.id || ""} />
                  <Divider />

                  {
                    /* ANCHOR Author Info */
                  }
                  <AuthorInfoContainer
                    author={bookInfo?.authors[0] || {
                      name: "",
                      description: "",
                    }}
                  />
                  <Divider />

                  {/* ANCHOR 最新章节 */}

                  {/* ANCHOR Quote Excerpt Preview */}
                  <div>
                    <ArrowForwardIconContainer
                      size={16}
                      to={`/quote/book/${bookInfo?.id}`}
                    >
                      <AccentBarWithTextContainer text="原文摘录" />
                    </ArrowForwardIconContainer>
                  </div>
                  <QuoteExcerptPreviewContainer id={bookInfo?.id || ""} />
                  <Divider />

                  {/* ANCHOR Short Reviews */}
                  <Box>
                    <div>
                      <ArrowForwardIconContainer
                        size={16}
                        to={`/review/short/book/${bookInfo?.id}`}
                      >
                        <AccentBarWithTextContainer text="短评" />
                      </ArrowForwardIconContainer>
                    </div>
                    <ShortBookReviews bookId={bookInfo?.id || ""} />
                  </Box>
                </Stack>
              </TabPanel>

              <TabPanel value="1">
                <Stack spacing={4}>
                  {/* ANCHOR Book Rating */}
                  {/* TODO 书籍评分综合组件，展示书籍评分（默认为总评分），星级分布，Summary 中应当包含大致的组织组织分布情况，点击进入专门的评分展示Page，展示各个组织的评分，并支持进一步点击查看各个组织的评论，同时也有快捷键编辑/发布自己的评分/评论 */}

                  {/* ANCHOR Book Reviews */}
                  <BookReviews
                    bookId={bookInfo?.id || ""}
                    title={bookInfo?.title || ""}
                  />

                  {/* ANCHOR Book Lists */}
                  <ReadlistByBookPreview
                    bookId={bookInfo?.id || ""}
                    title={bookInfo?.title || ""}
                  />
                </Stack>
              </TabPanel>

              <TabPanel value="2">
                <Stack spacing={4}>
                  {/* ANCHOR Chapter List */}
                  <ChapterListContainer id={bookInfo?.id || "0"} />
                </Stack>
              </TabPanel>
            </TabContext>
          </Grid>

          {/* ANCHOR Sidebar */}
          <Grid size={{ xs: 12, lg: 3 }}>
            <Paper className="p-3 mt-4">
              <Divider className="my-4" />

              {/* Book Info */}
              <Box>
                <Typography variant="h6" className="font-bold mb-4">
                  书籍信息
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="body2">书名：{bookInfo?.title}</Typography>
                  <Typography variant="body2">
                    作者：{bookInfo?.authors?.[0]?.name ?? ""}
                  </Typography>
                  <Typography variant="body2">
                    出版社：{bookInfo?.extra?.publishers?.[0]?.name ?? ""}
                  </Typography>
                  <Typography variant="body2">
                    出版日期：
                    {bookInfo?.extra?.publishDate ?? ""}
                    {/* TODO: i18n later */}
                  </Typography>
                  <Typography variant="body2">
                    ISBN：{bookInfo?.isbn ?? " "}
                    {/* TODO: i18n later */}
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

export const BookPageContainer: React.FC<ContainerProps> = ({ bookId }) => {
  const [location] = useLocation();

  const getInitialTab = (): TabValue => {
    const routeData = routeStore.getState().getRouteData(String(location));
    return (routeData?.tab as TabValue) || "0";
  };
  const [activeTab, setActiveTab] = React.useState<TabValue>(getInitialTab);

  const tabRef = useRef<TabValue>(getInitialTab());

  useScrollRestore(location, tabRef, startThrottledScroll, scroll);

  const handleTabChange = (
    _: React.SyntheticEvent | null,
    newValue: TabValue,
  ) => {
    console.log("handleTabChange", newValue);
    tabRef.current = newValue;
    setActiveTab(newValue);
  };

  // ANCHOR Data Fetching
  const book: any = useBookPageStore((s) => s.books[bookId]);
  const { data, isLoading, error } = useQuery(bookQueries.byId(bookId));
  const rating = 8.5, tags = ["完本", "奇幻", "320万字"];

  useEffect(() => {
    useBookPageStore.getState().updateBook(bookId, { ...data });
  }, [data, isLoading, bookId]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Oh no... {String(error)}</div>;
  }

  if (!book?.id) {
    return null; // 或者 return <div>No data</div>;
  }

  return (
    <BookPageShow
      bookInfo={book}
      tags={tags}
      rating={rating}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
