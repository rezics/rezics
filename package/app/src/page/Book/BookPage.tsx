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
import { proxy, useSnapshot } from "valtio";
import { useParams } from "wouter";
import { QuoteExcerpt } from "@component/Book/QuoteExcerpt";
import { BookTag } from "@component/Book/BookTag";
import { BookReviews } from "@component/Book/BookReviews";
import { ShortBookReviews } from "@component/Book/ShortBookReviews";
import { BookIncludeByBL } from "@component/BookList/BookIncludeByBL";
import { AccentBar } from "@component/Common/AccentBar";

import { BookInfoQuery } from "@/graphql/bookinfo";
import { QuoteExcerptQuery } from "@/graphql/bookQuoteExcerpt";
import { useQuery } from "urql";

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

const state = proxy({
    book: {
        id: "",
        title: "",
        cover: "",
        author: "",
        rating: 0,
        publisher: "",
        publishDate: "",
        isbn: "",
        tags: [],
        description: "",
    } as Book,
    author: {
        name: "",
        avatar: "",
        description: "",
    } as Author,
    loading: false,
    error: null as string | null,
});


function QuoteExcerpts({ id }: { id: string }) {
    // QuoteExcerptQuery
    const [{ data, fetching, error }] = useQuery({
        query: QuoteExcerptQuery,
        variables: { bookId: id },
    });
    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;
    const quotes = data?.quotes;
    
    return (
        <div>
            {/* Quotes */}
            <Box>
                <Typography variant="h5" className="font-bold mb-4">
                    <AccentBar />
                    原文摘录
                </Typography>
                <Stack spacing={2}>
                    {quotes.map((quote: any) => (
                        <QuoteExcerpt key={quote.id} content={quote.content} />
                    ))}
                </Stack>
            </Box>
        </div>
    );
}

export const BookDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = React.useState(0);

    const snap = useSnapshot(state);

    // BookInfoQuery
    console.log("fetchBookDetail", id);

    const [{ data, fetching, error }] = useQuery({
        query: BookInfoQuery,
        variables: { id },
    });

    if (fetching) return <div>Loading...</div>;
    if (error) return <div>Oh no... {error.message}</div>;

    if (data?.book && data?.author) {
        state.book = { ...data.book };
        state.author = { ...data.author };
    }

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    interface TabPanelProps {
        children?: React.ReactNode;
        index: number;
        value: number;
    }

    function TabPanel(props: TabPanelProps) {
        const { children, value, index, ...other } = props;

        return (
            <div
                role="tabpanel"
                hidden={value !== index}
                id={`simple-tabpanel-${index}`}
                aria-labelledby={`simple-tab-${index}`}
                {...other}
            >
                {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
            </div>
        );
    }

    return (
        <Box id="book-detail">
            {/* Book Overview */}
            <Box className="bg-cover bg-center relative" style={{ backgroundImage: `url(${snap.book.cover})` }}>
                <Box className="bg-black/66 backdrop-blur-md shadow-lg">
                    <Container maxWidth="lg" className="py-6">
                        <Grid container spacing={3}>
                            {/* Cover Image */}
                            <Grid size={{ xs: 12, md: 3, lg: 2 }} className="max-h-[300px] w-full">
                                <img
                                    src={snap.book.cover}
                                    alt={snap.book.title}
                                    className="h-full rounded-lg shadow-lg mr-auto ml-auto"
                                />
                            </Grid>

                            {/* Book Info */}
                            <Grid size={{ xs: 12, md: 10 }}>
                                <Stack spacing={2}>
                                    {/* Title and Rating */}
                                    <Box className="flex justify-between items-center">
                                        <Typography variant="h4" className="font-bold text-white">
                                            {snap.book.title}
                                        </Typography>
                                        <Box className="flex items-center gap-2">
                                            <Rating value={snap.book.rating / 2} precision={0.5} readOnly />
                                            <Typography variant="h6" className="text-amber-500">
                                                {snap.book.rating} / 10
                                            </Typography>
                                        </Box>
                                    </Box>

                                    {/* Author & Publisher Info */}
                                    <Stack spacing={1} className="text-white">
                                        <Typography>
                                            作者：
                                            <Box component="span" className="font-medium">
                                                {snap.book.author}
                                            </Box>
                                        </Typography>
                                        <Typography>出版社：{snap.book.publisher}</Typography>
                                        <Typography>出版日期：{snap.book.publishDate}</Typography>
                                        <Typography>ISBN：{snap.book.isbn}</Typography>
                                    </Stack>

                                    {/* Tags */}
                                    <Stack direction="row" spacing={1}>
                                        {snap.book.tags.map((tag) => (
                                            <Chip
                                                key={tag}
                                                label={tag}
                                                size="small"
                                                className="bg-white/10 text-white hover:bg-white/20"
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
                        <Tabs value={activeTab} onChange={handleTabChange}>
                            <Tab label="基本信息" />
                            <Tab label="书评" />
                            <Tab label="开发中" disabled />
                        </Tabs>

                        <TabPanel value={activeTab} index={0}>
                            <Stack spacing={4}>
                                {/* Description */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        <AccentBar />
                                        简介
                                    </Typography>
                                    <Typography variant="body1" className="whitespace-pre-line">
                                        {snap.book.description}
                                    </Typography>
                                </Box>
                                <Divider />

                                {/* Tags */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        <AccentBar />
                                        Tags
                                    </Typography>
                                    <BookTag />
                                </Box>
                                <Divider />

                                <QuoteExcerpts id={snap.book.id} />
                                <Divider />

                                {/* Short Reviews */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        <AccentBar />
                                        短评
                                    </Typography>
                                    <ShortBookReviews bookId={snap.book.id} />
                                </Box>
                            </Stack>
                        </TabPanel>

                        <TabPanel value={activeTab} index={1}>
                            <Stack spacing={4}>
                                {/* Book Reviews */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        {snap.book.title}的书评
                                    </Typography>
                                    <BookReviews bookId={snap.book.id} />
                                </Box>

                                {/* Book Lists */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        包含 {snap.book.title} 的书单
                                    </Typography>
                                    <BookIncludeByBL />
                                </Box>
                            </Stack>
                        </TabPanel>
                    </Grid>

                    {/* Sidebar */}
                    <Grid size={{ xs: 12, lg: 3 }}>
                        <Paper className="p-3 mt-4">
                            {/* Author Info */}
                            <Box>
                                <Typography variant="h6" className="font-bold mb-4">
                                    作者：{snap.book.author}
                                </Typography>
                                <Box className="flex gap-4 mb-4">
                                    <Avatar src={snap.author.avatar} className="w-20 h-20" />
                                    <Typography variant="body2" className="text-gray-600">
                                        {snap.author.description}
                                    </Typography>
                                </Box>
                            </Box>
                            <Divider className="my-4" />

                            {/* Book Info */}
                            <Box>
                                <Typography variant="h6" className="font-bold mb-4">
                                    书籍信息
                                </Typography>
                                <Stack spacing={1}>
                                    <Typography variant="body2">书名：{snap.book.title}</Typography>
                                    <Typography variant="body2">作者：{snap.book.author}</Typography>
                                    <Typography variant="body2">出版社：{snap.book.publisher}</Typography>
                                    <Typography variant="body2">出版日期：{snap.book.publishDate}</Typography>
                                    <Typography variant="body2">ISBN：{snap.book.isbn}</Typography>
                                </Stack>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};
