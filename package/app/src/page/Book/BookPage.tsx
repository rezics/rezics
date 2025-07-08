import React, { useMemo } from "react";
import { Box, Container, Grid, Typography, Paper, Divider, Avatar, Stack, Tab } from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useParams, Link } from "wouter";
import { BookTagView } from "@/component/Book/BookTagPreview";
import { BookReviews } from "@/component/Book/BookReviewsPreview";
import { ShortBookReviews } from "@/component/Book/ShortBookReviewsPreview";
import { AccentBarWithText } from "@component/Common/AccentBar";

import { BookInfoQuery } from "@/api/book";
import { useQuery } from "urql";
import { Book, BookInfo } from "@/api/book";

import { ChapterList } from "@component/Book/ChapterList";
import { ArrowForwardIcon } from "@component/Common/ArrowForwardIcon";
import { BookHero } from "@component/Book/BookHero";
import { BookDescription } from "@/component/Book/BookDescription";
import { QuoteExcerptPreview } from "@/component/Book/QuoteExcerptPreview";
import ReadlistByBookPreview from "@/component/Book/ReadlistByBookPreview";

export namespace BookPage {
    export type Show = {
        data: BookInfo;
        activeTab: string;
        onTabChange: (event: React.SyntheticEvent, newValue: "0" | "1" | "2") => void;
    };

    export const Show: React.FC<Show> = ({ data, activeTab, onTabChange }) => {
        return (
            <Box id="book-detail">
                {/* Book Overview */}
                <BookHero.Container data={data.book} />

                {/* Main Content */}
                <Container maxWidth="lg" className="mt-4 mb-8">
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
                                        <BookDescription.Container description={data?.book.description || ""} />
                                        <Divider />

                                        {/* ANCHOR Tags */}
                                        <BookTagView.Container tagObjects={data?.book.tags || []} />
                                        <Divider />

                                        {/* ANCHOR 最新章节 */}

                                        {/* ANCHOR Quote Excerpt Preview */}
                                        <QuoteExcerptPreview.Container id={data?.book.id || ""} />
                                        <Divider />

                                        {/* ANCHOR Short Reviews */}
                                        <Box>
                                            <Link href={`/book/${data?.book.id}/reviews`} className="flex mb-4">
                                                <ArrowForwardIcon.Container size={16}>
                                                    <AccentBarWithText.Container text="短评" />
                                                </ArrowForwardIcon.Container>
                                            </Link>
                                            <ShortBookReviews bookId={data?.book.id || ""} />
                                        </Box>
                                    </Stack>
                                </TabPanel>

                                <TabPanel value="1">
                                    <Stack spacing={4}>
                                        {/* ANCHOR Book Reviews */}
                                        <BookReviews bookId={data?.book.id || ""} title={data?.book.title || ""} />

                                        {/* ANCHOR Book Lists */}
                                        <ReadlistByBookPreview
                                            bookId={data?.book.id || ""}
                                            title={data?.book.title || ""}
                                        />
                                    </Stack>
                                </TabPanel>

                                <TabPanel value="2" keepMounted={true}>
                                    <Stack spacing={4}>
                                        {/* 章节列表 */}
                                        <ChapterList id={data?.book.id || "0"} />
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
                                        作者：{data?.book.author}
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
                                        <Typography variant="body2">书名：{data?.book.title}</Typography>
                                        <Typography variant="body2">作者：{data?.book.author}</Typography>
                                        <Typography variant="body2">出版社：{data?.book.publisher}</Typography>
                                        <Typography variant="body2">出版日期：{data?.book.publishDate}</Typography>
                                        <Typography variant="body2">ISBN：{data?.book.isbn}</Typography>
                                    </Stack>
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>
                </Container>
            </Box>
        );
    };

    export type Container = {};

    export const Container: React.FC<Container> = () => {
        const { id } = useParams<{ id: string }>();
        const [activeTab, setActiveTab] = React.useState("0");

        // BookInfoQuery
        console.log("fetchBookDetail", id);

        const [{ data, fetching, error }] = useQuery<BookInfo>({
            query: BookInfoQuery,
            variables: { id },
        });

        if (fetching) return <div>Loading...</div>;
        if (error) return <div>Oh no... {error.message}</div>;

        const handleTabChange = (_: React.SyntheticEvent, newValue: "0" | "1" | "2") => {
            setActiveTab(newValue);
        };

        return <Show data={data!} activeTab={activeTab} onTabChange={handleTabChange} />;
    };
}

export const BookDetail = BookPage.Container;
