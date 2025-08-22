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
import { QuoteExcerptPreview } from "@/component/Book/QuoteExcerptPreview.tsx";
import { ReadlistByBookPreview } from "@/component/Book/ReadlistByBookPreview.tsx";
import { ArrowForwardIconContainer } from "@/component/Common/ArrowForwardIcon.tsx";
import { BookHeroContainer } from "@component/Book/BookHero.tsx";
import { ChapterListContainer } from "@component/Book/ChapterList.tsx";

import { useBookPageStore } from "@/global/page/bookPageStore.ts";
import { routeStore } from "@/global/routeStore.ts";
import { startThrottledScroll } from "@/util/ScrollUtil.ts";
import type { Book } from "contract";
import useSWR from "swr";

const createBookInput = {
    operation: "book.read",
    parameter: { id: "undefined" },
    select: {
        id: true,
        name: true,
        authors: [{ id: true, name: true, description: true }], // TODO contract need to add avatar
        cover: true,
        description: true,
        length: true,
        publishers: [{ id: true, name: true }],
    },
} satisfies Book.Input.Read;

type BookType = Book.Output.Read<typeof createBookInput.select>;

type TabValue = "0" | "1" | "2";

type ShowProps = {
    ref?: React.Ref<unknown>;
    data: BookType & { [key: string]: any };
    // data: BookType;
    activeTab: string;
    onTabChange?: (
        event: React.SyntheticEvent | null,
        newValue: TabValue,
    ) => void;
};

export const BookPageShow: React.FC<ShowProps> = ({
    ref,
    data,
    activeTab,
    onTabChange,
}) => {
    return (
        <Box id="book-detail" ref={ref}>
            {/* Book Overview */}
            <BookHeroContainer data={data} />

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
                                        description={data?.description || ""}
                                        bookId={data?.id || ""}
                                    />
                                    <Divider />

                                    {/* ANCHOR Tags */}
                                    {/* <BookTagView.Container tagObjects={data?.book.tags || []} /> */}
                                    <BookTagView.Container
                                        bookId={data?.id || "1"}
                                    />
                                    <Divider />

                                    {/* ANCHOR Author Info */}
                                    <AuthorInfoContainer
                                        author={data?.authors[0] || {
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
                                            to={`/quote/book/${data?.id}`}
                                        >
                                            <AccentBarWithTextContainer text="原文摘录" />
                                        </ArrowForwardIconContainer>
                                    </div>
                                    <QuoteExcerptPreview.Container
                                        id={data?.id || ""}
                                    />
                                    <Divider />

                                    {/* ANCHOR Short Reviews */}
                                    <Box>
                                        <div>
                                            <ArrowForwardIconContainer
                                                size={16}
                                                to={`/review/short/book/${data?.id}`}
                                            >
                                                <AccentBarWithTextContainer text="短评" />
                                            </ArrowForwardIconContainer>
                                        </div>
                                        <ShortBookReviews
                                            bookId={data?.id || ""}
                                        />
                                    </Box>
                                </Stack>
                            </TabPanel>

                            <TabPanel value="1">
                                <Stack spacing={4}>
                                    {/* ANCHOR Book Rating */}
                                    {/* TODO 书籍评分综合组件，展示书籍评分（默认为总评分），星级分布，Summary 中应当包含大致的组织组织分布情况，点击进入专门的评分展示Page，展示各个组织的评分，并支持进一步点击查看各个组织的评论，同时也有快捷键编辑/发布自己的评分/评论 */}

                                    {/* ANCHOR Book Reviews */}
                                    <BookReviews
                                        bookId={data?.id || ""}
                                        title={data?.name || ""}
                                    />

                                    {/* ANCHOR Book Lists */}
                                    <ReadlistByBookPreview
                                        bookId={data?.id || ""}
                                        title={data?.name || ""}
                                    />
                                </Stack>
                            </TabPanel>

                            <TabPanel value="2">
                                <Stack spacing={4}>
                                    {/* ANCHOR Chapter List */}
                                    <ChapterListContainer id={data?.id || "0"} />
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
                                <Typography
                                    variant="h6"
                                    className="font-bold mb-4"
                                >
                                    书籍信息
                                </Typography>
                                <Stack spacing={1}>
                                    <Typography variant="body2">
                                        书名：{data?.name}
                                    </Typography>
                                    <Typography variant="body2">
                                        作者：{data?.authors[0]?.name}
                                    </Typography>
                                    <Typography variant="body2">
                                        出版社：{data?.publishers[0].name}
                                    </Typography>
                                    <Typography variant="body2">
                                        出版日期：
                                        {data?.publishDate}
                                        {/* TODO: i18n later */}
                                    </Typography>
                                    <Typography variant="body2">
                                        ISBN：{data?.isbn || " "}
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

const scroll = async (distance: number, count = 0) => {
    // After adjusting the page structure, the function worked much better.
    if (count > 1000) {
        return;
    }

    const before = globalThis.pageYOffset;

    globalThis.scrollTo({
        top: distance,
    });

    if (Math.abs(globalThis.pageYOffset - before) > 10) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return scroll(distance, count + 1);
    }
};

export const BookPageContainer: React.FC<ContainerProps> = ({ bookId }) => {
    const [location] = useLocation();

    const getInitialTab = (): TabValue => {
        const routeData = routeStore
            .getState()
            .getRouteData(String(location));
        return (routeData?.tab as TabValue) || "0";
    };
    const [activeTab, setActiveTab] = React.useState<TabValue>(getInitialTab);

    // ANCHOR Data Fetching
    const book: any = useBookPageStore((s) => s.books[bookId]);
    createBookInput.parameter = { id: bookId };
    const { data, isLoading, error } = useSWR<
        Book.Output.Read<typeof createBookInput.select>,
        Error,
        typeof createBookInput
    >(createBookInput);

    useEffect(() => {
        useBookPageStore.getState().updateBook(bookId, { ...data });
    }, [data, isLoading, bookId]);

    const tabRef = useRef<TabValue>(getInitialTab());
    const handleTabChange = (
        _: React.SyntheticEvent | null,
        newValue: TabValue,
    ) => {
        console.log("handleTabChange", newValue);
        tabRef.current = newValue;
        setActiveTab(newValue);
    };

    let stopThrottledScroll: any = useRef(null);
    useEffect(() => {
        const timer = globalThis.setTimeout(() => {
            stopThrottledScroll.current = startThrottledScroll((_y) => {
                // console.log("当前滚动位置：", y);
                // console.log("location", bookId);
                routeStore.getState().setRouteData(String(location), {
                    scrollY: globalThis.pageYOffset,
                    // scrollY: window.scrollY,
                    tab: tabRef.current,
                });
            }, 200); // 150ms 节流
        }, 500); // 500ms 后开始节流
        return () => {
            clearTimeout(timer);
            stopThrottledScroll.current?.();

            const prev = routeStore.getState().getRouteData(String(location)) || {};
            routeStore.getState().setRouteData(String(location), {
                ...prev,
                tab: tabRef.current, // Override tab, scrollY keep unchanged
            });
            console.log(
                "routeStoreData",
                routeStore.getState().getRouteData(String(location)),
            );
        };
    }, [location]);

    useEffect(() => {
        // NOTE 這裏的邏輯還是有問題，雖然理論上只有回退的時候才會觸發滾動，但是我還是不確定會不會有bug
        const routeData = routeStore
            .getState()
            .getRouteData(String(location));
        if (routeData?.scrollY) {
            console.log("scroll to", routeData.scrollY);
            scroll(routeData.scrollY);
        }
    }, [location]);

    if (isLoading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>Oh no... {String(error)}</div>;
    }

    if (!book?.id) {
        return null; // 或者 return <div>No data</div>;
    }
    // if (!data.isbn) {
    //     return null; // 或者 return <div>No data</div>;
    // }

    return (
        <BookPageShow
            data={book}
            activeTab={activeTab}
            onTabChange={handleTabChange}
        />
    );
};
