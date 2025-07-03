import React from "react";
import {
    Box,
    Container,
    Grid,
    Typography,
    Paper,
    Divider,
    Avatar,
    Rating,
    Chip,
    Stack,
    Tabs,
    Tab,
} from "@mui/material";
import { TabContext, TabList, TabPanel } from "@mui/lab";
import { useParams } from "wouter";
import { QuoteExcerpt } from "@component/Book/QuoteExcerpt";
import { BookTag } from "@component/Book/BookTag";
import { BookReviews } from "@component/Book/BookReviews";
import { ShortBookReviews } from "@component/Book/ShortBookReviews";
import { BookIncludeByBL } from "@component/BookList/BookIncludeByBL";
import { AccentBar } from "@component/Common/AccentBar";

import { BookInfoQuery } from "@/graphql/bookInfo";
import { QuoteExcerptQuery } from "@/graphql/bookQuoteExcerpt";
import { useQuery } from "urql";
import { ChapterList } from "@component/Book/ChapterList";

interface Book {
    id: string;
    title: string;
    cover: string;
    author: string;
    rating: number;
    publisher: string;
    publishDate: string;
    isbn: string;
    tags: string[];
    description: string;
}

interface Author {
    name: string;
    avatar: string;
    description: string;
}

interface BookInfo {
    book: Book;
    author: Author;
    loading: boolean;
    error: string | null;
}

function QuoteExcerptList({ id }: { id: string }) {
    // QuoteExcerptQuery
    const [{ data, fetching, error }] = useQuery({
        query: QuoteExcerptQuery,
        variables: { bookId: id },
    });
    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;

    return (
        <div>
            {/* Quotes */}
            <Box>
                <Typography variant="h5" className="font-bold mb-4">
                    <AccentBar />
                    原文摘录
                </Typography>
                <Stack spacing={2}>
                    {(data?.quotes || []).map((quote: any) => (
                        <QuoteExcerpt key={quote.id} content={quote.content} />
                    ))}
                </Stack>
            </Box>
        </div>
    );
}

export const BookDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = React.useState('0');

    // BookInfoQuery
    console.log("fetchBookDetail", id);

    const [{ data, fetching, error }] = useQuery<BookInfo>({
        query: BookInfoQuery,
        variables: { id },
    });

    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;

    const handleTabChange = (_: React.SyntheticEvent, newValue: '0' | '1' | '2') => {
        setActiveTab(newValue);
    };

    return (
        <Box id="book-detail">
            {/* Book Overview */}
            <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(${data?.book.cover})` }}>
                <Box className="bg-black/66 backdrop-blur-md shadow-lg">
                    <Container maxWidth="lg" className="py-6">
                        <Grid container spacing={3}>
                            {/* Cover Image */}
                            <Grid size={{ xs: 12, md: 3, lg: 2 }} className="max-h-[300px] w-full">
                                <img
                                    src={data?.book.cover}
                                    alt={data?.book.title}
                                    className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                                />
                            </Grid>

                            {/* Book Info */}
                            <Grid size={{ xs: 12, md: 9 }}>
                                <Stack spacing={2}>
                                    {/* Title and Rating */}
                                    <Box className="flex justify-between items-center">
                                        <Typography variant="h4" className="font-bold text-white">
                                            {data?.book.title}
                                        </Typography>
                                        <Box className="flex items-center gap-2">
                                            <Rating value={(data?.book.rating || 0) / 2} precision={0.5} readOnly />
                                            <Typography variant="h6" className="text-amber-500">
                                                {data?.book.rating} / 10
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Author & Publisher Info */}
                                    <Stack spacing={1} className="text-white">
                                        <Typography>
                                            作者：
                                            <Box component="span" className="font-medium">
                                                {data?.book.author}
                                            </Box>
                                        </Typography>
                                        <Typography>出版社：{data?.book.publisher}</Typography>
                                        <Typography>出版日期：{data?.book.publishDate}</Typography>
                                        <Typography>ISBN：{data?.book.isbn}</Typography>
                                    </Stack>

                                    {/* Tags */}
                                    <Stack direction="row" spacing={1}>
                                        {data?.book.tags.map((tag: string) => (
                                            <Chip
                                                key={tag}
                                                label={tag}
                                                size="small"
                                                className="*:bg-white/10 *:text-white *:hover:bg-white/20 *:p-1"
                                            />
                                        ))}
                                    </Stack>
                                </Stack>
                            </Grid>
                        </Grid>
                    </Container>
                </Box>
            </Box>

            {/* Main Content */}
            <Container maxWidth="lg" className="mt-4 mb-8">
                <Grid container spacing={4}>
                    {/* Main Content */}
                    <Grid size={{ xs: 12, lg: 9 }}>
                        <TabContext value={activeTab}>
                            <TabList onChange={handleTabChange}>
                                <Tab label="基本信息" value="0" />
                                <Tab label="书评" value="1" />
                                <Tab label="目录" value="2" />
                            </TabList>

                            <TabPanel value="0">
                                <Stack spacing={4}>
                                    {/* Description */}
                                    <Box>
                                        <Typography variant="h5" className="font-bold !mb-4">
                                            <AccentBar />
                                            简介
                                        </Typography>
                                        <Typography variant="body1" className="whitespace-pre-line">
                                            {data?.book.description}
                                        </Typography>
                                    </Box>
                                    <Divider />

                                    {/* Tags */}
                                    <Box>
                                        <Typography variant="h5" className="font-bold !mb-4">
                                            <AccentBar />
                                            Tags
                                        </Typography>
                                        <BookTag />
                                    </Box>
                                    <Divider />

                                    {/* 最新章节 */}

                                    <QuoteExcerptList id={data?.book.id || ""} />
                                    <Divider />

                                    {/* Short Reviews */}
                                    <Box>
                                        <Typography variant="h5" className="font-bold !mb-4">
                                            <AccentBar />
                                            短评
                                        </Typography>
                                        <ShortBookReviews bookId={data?.book.id || ""} />
                                    </Box>
                                </Stack>
                            </TabPanel>

                            <TabPanel value="1">
                                <Stack spacing={4}>
                                    {/* Book Reviews */}
                                    <Box>
                                        <Typography variant="h5" className="font-bold !mb-4">
                                            <AccentBar />
                                            {data?.book.title}的书评
                                        </Typography>
                                        <BookReviews bookId={data?.book.id || ""} />
                                    </Box>

                                    {/* Book Lists */}
                                    <Box>
                                        <Typography variant="h5" className="font-bold !mb-4">
                                            <AccentBar />
                                            包含 {data?.book.title} 的书单
                                        </Typography>
                                        <BookIncludeByBL />
                                    </Box>
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
