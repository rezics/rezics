import React from "react";
import { Box, Container, Grid, Typography, Paper, Divider, Avatar, Rating, Chip, Stack } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { useParams } from "wouter";
import { QuoteExcerpt } from "@component/Book/QuoteExcerpt";
import { BookTag } from "@component/Book/BookTag";
import { BookReviews } from "@component/Book/BookReviews";
import { ShortBookReviews } from "@component/Book/ShortBookReviews";
import { BookIncludeByBL } from "@component/BookList/BookIncludeByBL";

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

export const BookDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [activeTab, setActiveTab] = React.useState(0);

    const snap = useSnapshot(state);

    const fetchBookDetail = async (id: string | undefined) => {
        if (!id) return;
        console.log("fetchBookDetail", id);

        try {
            state.loading = true;
            // 示例数据
            const bookData = {
                id,
                title: "术师手册",
                cover: "https://bookcover.yuewen.com/qdbimg/349573/1025990049/600.webp",
                author: "听日",
                rating: 8.6,
                publisher: "未来出版社",
                publishDate: "2024-11-10",
                isbn: "978-7-123-45678-9",
                tags: ["完本", "奇幻", "320万字"],
                description:
                    "1668年，我所在的城市被评为全国治安最好的地区。\n我对此做出了不可磨灭的贡献。\n因为我落网了。",
            };

            const authorData = {
                name: "听日",
                avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
                description:
                    "余华，1960年4月出生，1983年开始写作，主要作品有《兄弟》《活着》《许三观卖血记》《在细雨中呼喊》《第七天》等。作品已被翻译成40多种语言在美国、英国、澳大利亚、法国、德国、意大利、西班牙、葡萄牙、荷兰、瑞典、挪威、丹麦、芬兰、希腊、俄罗斯、保加利亚、匈牙利、捷克、斯洛伐克、塞尔维亚、斯洛文尼亚、波兰、罗马尼亚、土耳其、巴西、以色列、埃及、科威特、日本、韩国、越南、泰国、印度和印尼等40多个国家和地区出版。曾获意大利格林扎纳·卡佛文学奖（1998年）、法国文学和艺术骑士勋章（2004年）、法国国际信使外国小说奖（2008年）、意大利朱塞佩·阿切尔比国际文学奖（2014年）等。",
            };

            // 使用原子更新
            state.book = { ...bookData };
            state.author = { ...authorData };
        } catch (error) {
            state.error = error instanceof Error ? error.message : "An error occurred";
        } finally {
            state.loading = false;
        }
    };

    React.useEffect(() => {
        fetchBookDetail(id);
    }, [id]);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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
                            <Grid size={{ xs: 12, md: 2 }}>
                                <img
                                    src={snap.book.cover}
                                    alt={snap.book.title}
                                    className="w-full rounded-lg shadow-lg"
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
                                        Tags
                                    </Typography>
                                    <BookTag />
                                </Box>
                                <Divider />

                                {/* Quotes */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
                                        原文摘录
                                    </Typography>
                                    <Stack spacing={2}>
                                        <QuoteExcerpt content='作为一个词语，"活着"在我们的语言中充满了力量。它的力量不是来自于喊叫，也不是来自于进攻，而是忍受。去忍受生命赋予我们的责任，去忍受现实给予我们的幸福和苦难、无聊和平庸。' />
                                        <QuoteExcerpt content='作为一个词语，"活着"在我们的语言中充满了力量。它的力量不是来自于喊叫，也不是来自于进攻，而是忍受。去忍受生命赋予我们的责任，去忍受现实给予我们的幸福和苦难、无聊和平庸。' />
                                    </Stack>
                                </Box>
                                <Divider />

                                {/* Short Reviews */}
                                <Box>
                                    <Typography variant="h5" className="font-bold mb-4">
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
