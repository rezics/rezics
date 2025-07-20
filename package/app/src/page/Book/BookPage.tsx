import React, { useEffect, useMemo, useRef } from "react";
import { Box, Container, Grid, Typography, Paper, Divider, Avatar, Stack, Tab } from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useParams, Link, useLocation } from "wouter";
import { BookTagView } from "@/component/Book/BookTagPreview";
import { BookReviews } from "@/component/Book/BookReviewsPreview";
import { ShortBookReviews } from "@/component/Book/ShortBookReviewsPreview";
import { AccentBarWithText } from "@component/Common/AccentBar";

import { ChapterList } from "@component/Book/ChapterList";
import { ArrowForwardIcon } from "@component/Common/ArrowForwardIcon";
import { BookHero } from "@component/Book/BookHero";
import { BookDescription } from "@/component/Book/BookDescription";
import { QuoteExcerptPreview } from "@/component/Book/QuoteExcerptPreview";
import { ReadlistByBookPreview } from "@/component/Book/ReadlistByBookPreview";

import { routeStore } from "@/global/routeStore";
import { startThrottledScroll } from "@/util/ScrollUtil";
import { repeatTask } from "@/util/taskScheduler";
import { fadeOverlay } from "@/util/pageAnimateUtil";
import { Book } from "contract";
import tsr from "@/api/tsr";

export namespace BookPage {
    type Tab = "0" | "1" | "2";

    export type Show = {
        data: Book;
        activeTab: string;
        onTabChange: (event: React.SyntheticEvent | null, newValue: Tab) => void;
    };

    export const Show: React.FC<Show> = ({ data, activeTab, onTabChange }) => {
        return (
            <Box id="book-detail">
                {/* Book Overview */}
                <BookHero.Container data={data} />

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

                                <TabPanel value="0" keepMounted={true}>
                                    <Stack spacing={4}>
                                        {/* ANCHOR Description */}
                                        <BookDescription.Container description={data?.description || ""} />
                                        <Divider />

                                        {/* ANCHOR Tags */}
                                        {/* <BookTagView.Container tagObjects={data?.book.tags || []} /> */}
                                        <BookTagView.Container />
                                        <Divider />

                                        {/* ANCHOR 最新章节 */}

                                        {/* ANCHOR Quote Excerpt Preview */}
                                        <Link href={`/quote/book/${data?.id}`} className="flex mb-4">
                                            <ArrowForwardIcon.Container size={16}>
                                                <AccentBarWithText.Container text="原文摘录" />
                                            </ArrowForwardIcon.Container>
                                        </Link>
                                        <QuoteExcerptPreview.Container id={data?.id || ""} />
                                        <Divider />

                                        {/* ANCHOR Short Reviews */}
                                        <Box>
                                            <Link href={`/review/short/book/${data?.id}`} className="flex mb-4">
                                                <ArrowForwardIcon.Container size={16}>
                                                    <AccentBarWithText.Container text="短评" />
                                                </ArrowForwardIcon.Container>
                                            </Link>
                                            <ShortBookReviews bookId={data?.id || ""} />
                                        </Box>
                                    </Stack>
                                </TabPanel>

                                <TabPanel value="1" keepMounted={true}>
                                    <Stack spacing={4}>
                                        {/* ANCHOR Book Reviews */}
                                        <BookReviews bookId={data?.id || ""} title={data?.title || ""} />

                                        {/* ANCHOR Book Lists */}
                                        <ReadlistByBookPreview bookId={data?.id || ""} title={data?.title || ""} />
                                    </Stack>
                                </TabPanel>

                                <TabPanel value="2" keepMounted={true}>
                                    <Stack spacing={4}>
                                        {/* 章节列表 */}
                                        <ChapterList id={data?.id || "0"} />
                                    </Stack>
                                </TabPanel>
                            </TabContext>
                        </Grid>

                        {/* ANCHOR Sidebar */}
                        <Grid size={{ xs: 12, lg: 3 }}>
                            <Paper className="p-3 mt-4">
                                {/* Author Info */}
                                <Box>
                                    <Typography variant="h6" className="font-bold mb-4">
                                        作者：{data?.author?.name}
                                    </Typography>

                                    <Box className="mb-4">
                                        <Avatar
                                            src={data?.author.avatar || ""}
                                            className="w-20 h-20 float-left mr-4 mb-2 rounded-full"
                                        />
                                        <Typography variant="body2">{data?.author.description}</Typography>
                                        <div className="clear-both" />
                                    </Box>
                                </Box>
                                <Divider className="my-4" />

                                {/* Book Info */}
                                <Box>
                                    <Typography variant="h6" className="font-bold mb-4">
                                        书籍信息
                                    </Typography>
                                    <Stack spacing={1}>
                                        <Typography variant="body2">书名：{data?.title}</Typography>
                                        <Typography variant="body2">作者：{data?.author?.name}</Typography>
                                        <Typography variant="body2">出版社：{data?.publisher}</Typography>
                                        <Typography variant="body2">出版日期：{data?.publishDate}</Typography>
                                        <Typography variant="body2">ISBN：{data?.isbn}</Typography>
                                    </Stack>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </Box>
        );
    };

    export type Container = {};

    const RawContainer: React.FC<Container> = () => {
        const { bookId } = useParams();
        const [location] = useLocation();

        console.log("BookPageInit", bookId);

        const getInitialTab = (): Tab => {
            const routeData = routeStore.getState().getRouteData(String(location));
            return (routeData?.tab as Tab) || "0";
        };
        const [activeTab, setActiveTab] = React.useState<Tab>(getInitialTab);

        const { data, isLoading, error } = tsr.books.get.useQuery({
            queryKey: ["book", bookId],
            queryData: {
                params: {
                    bookId: bookId!,
                },
            },
        });

        useEffect(() => {
            console.log("book data", data);
        }, [data]);

        const tabRef = useRef<Tab>(getInitialTab());
        const handleTabChange = (_: React.SyntheticEvent | null, newValue: Tab) => {
            console.log("handleTabChange", newValue);
            tabRef.current = newValue;
            setActiveTab(newValue);
        };

        let stopThrottledScroll: any = null;
        useEffect(() => {
            const timer = window.setTimeout(() => {
                stopThrottledScroll = startThrottledScroll((y) => {
                    console.log("当前滚动位置：", y);
                    console.log("location", bookId);
                    routeStore.getState().setRouteData(String(location), {
                        scrollY: window.scrollY,
                        tab: tabRef.current,
                    });
                }, 200); // 150ms 节流
            }, 500); // 500ms 后开始节流
            return () => {
                clearTimeout(timer);
                stopThrottledScroll?.();

                const prev = routeStore.getState().getRouteData(String(location)) || {};
                routeStore.getState().setRouteData(String(location), {
                    ...prev,
                    tab: tabRef.current, // Override tab, scrollY keep unchanged
                });
                console.log("routeStoreData", routeStore.getState().getRouteData(String(location)));
            };
        }, [location]);

        useEffect(() => {
            const routeData = routeStore.getState().getRouteData(String(location));
            if (routeData?.scrollY) {
                console.log("scrollY to", routeData.scrollY);
                repeatTask(
                    (scrollY = routeData.scrollY) => {
                        window.scrollTo(0, scrollY || 0);
                    },
                    50,
                    200,
                );
            }
            fadeOverlay(250);
        }, [location]);

        if (isLoading) {
            return <div>Loading...</div>;
        }

        if (error) {
            return <div>Oh no... {String(error)}</div>;
        }

        if (!data?.body.isbn) {
            return null; // 或者 return <div>No data</div>;
        }

        return (
            <div>
                <Show data={data.body} activeTab={activeTab} onTabChange={handleTabChange} />
            </div>
        );
    };
    export const Container = RawContainer;
}

export const BookDetail = BookPage.Container;
