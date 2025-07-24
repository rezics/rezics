import React, { useState, useEffect, useCallback } from "react";
import { z } from "zod"; // 假设从外部导入
import { Box, Typography, Grid, Card, CardContent, ThemeProvider, createTheme, Divider } from "@mui/material";
import { UniversalPaginator } from "@/component/Common/Pagination";
import { contract } from "contract";
import { BookSearchFilter } from "@/component/BookLib/BookSearchFilter";

// 1. Zod Schemas (假设从 './schemas' 等文件导入)
// =============================================
export const PaginationQuerySchema = z.object({
    page: z.number().int().optional().default(1),
    limit: z.number().int().optional().default(100), // 外部API一次获取100条
    type: z.enum(["time", "name", "popular", "agree"]).optional().default("time"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
});
const PostSchema = z.object({
    id: z.string(),
    name: z.string(),
    createdAt: z.date(),
    popularity: z.number(),
    agrees: z.number(),
});
type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
type Post = z.infer<typeof PostSchema>;

// 2. 模拟 API (与之前相同, 但仅用于演示)
// =============================================
const allPosts: Post[] = Array.from({ length: 555 }, (_, i) => ({
    id: `post_${i + 1}`,
    name: `帖子标题 ${i + 1}`,
    createdAt: new Date(Date.now() - Math.random() * 1000 * 3600 * 24 * 30),
    popularity: Math.floor(Math.random() * 1000),
    agrees: Math.floor(Math.random() * 500),
}));

const fetchPostsAPI = (query: PaginationQuery) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            const { page, limit, type, order } = PaginationQuerySchema.parse(query);
            const sorted = [...allPosts].sort((a, b) => {
                let comp = 0;
                if (type === "name") comp = a.name.localeCompare(b.name);
                else if (type === "popular") comp = a.popularity - b.popularity;
                else if (type === "agree") comp = a.agrees - b.agrees;
                else comp = a.createdAt.getTime() - b.createdAt.getTime();
                return order === "asc" ? comp : -comp;
            });
            const total = sorted.length;
            const start = (page - 1) * limit;
            const items = sorted.slice(start, start + limit);
            resolve({ items, total });
        }, 500);
    });
};

// 3. 可复用UI组件 (基本不变)
// =============================================

interface PostCardProps {
    post: Post;
}
const PostCard: React.FC<PostCardProps> = ({ post }) => (
    <Card sx={{ height: "100%", borderRadius: 2 }}>
        <CardContent>
            <Typography gutterBottom variant="h6">
                {post.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
                热度: {post.popularity} | 赞同: {post.agrees}
            </Typography>
        </CardContent>
    </Card>
);

// 5. 示例 App (父组件，负责状态管理和数据获取)
// =============================================
// const theme = createTheme({ palette: { mode: "light" } });

// TODO 目前外部数据更新之后，分页会有错误，错误的回到第一页
export default function TestPaginationPage() {
    const [sortConfig, setSortConfig] = useState<{
        type: "time" | "name" | "popular" | "agree";
        order: "asc" | "desc";
    }>({
        type: "popular",
        order: "desc",
    });
    const [allFetchedItems, setAllFetchedItems] = useState<Post[]>([]);
    const [totalItems, setTotalItems] = useState<number>(0);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [currentExternalPage, setCurrentExternalPage] = useState<number>(0);

    const EXTERNAL_PAGE_SIZE = 100;

    const fetchDataBlock = useCallback(
        async (page: number, currentSort: { type: "time" | "name" | "popular" | "agree"; order: "asc" | "desc" }) => {
            setIsLoading(true);
            try {
                const query: PaginationQuery = {
                    page,
                    limit: EXTERNAL_PAGE_SIZE,
                    type: currentSort.type,
                    order: currentSort.order,
                };
                const response = (await fetchPostsAPI(query)) as { items: Post[]; total: number };
                // setAllFetchedItems((prev) => (page === 1 ? response.items : [...prev, ...response.items]));
                setAllFetchedItems((prev) =>
                    (page === 1 ? response.items : [...prev, ...response.items]).slice(0, 100),
                ); // 最多100个/根据page来算
                setTotalItems(response.total);
                setCurrentExternalPage(page);
            } catch (error) {
                console.error("获取数据失败:", error);
            } finally {
                setIsLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchDataBlock(1, sortConfig);
    }, [sortConfig, fetchDataBlock]);

    const handleSortChange = (newSort: { type?: string; order?: "asc" | "desc" }) => {
        setSortConfig((prev) => ({
            type:
                newSort.type && ["time", "name", "popular", "agree"].includes(newSort.type)
                    ? (newSort.type as "time" | "name" | "popular" | "agree")
                    : prev.type,
            order: newSort.order ?? prev.order,
        }));
        setAllFetchedItems([]);
        setTotalItems(0);
        setCurrentExternalPage(0);
    };

    const handleNeedMoreData = (requestedExternalPage: number) => {
        if (isLoading || requestedExternalPage <= currentExternalPage) {
            return;
        }
        fetchDataBlock(requestedExternalPage, sortConfig);
    };

    useEffect(() => {
        console.log(contract);
    }, []);

    const [currentPage, setCurrentPage] = useState(1);

    return (
        <Box sx={{ bgcolor: "#f4f6f8", p: { xs: 2, md: 4 }, minHeight: "100vh" }}>
            <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: "center", mb: 4 }}>
                通用分页控制器演示
            </Typography>
            <UniversalPaginator<Post>
                data={allFetchedItems}
                totalExternalItems={totalItems}
                itemsPerPage={30}
                externalItemsPerPage={EXTERNAL_PAGE_SIZE}
                sortType={sortConfig.type}
                sortOrder={sortConfig.order}
                onSortChange={handleSortChange}
                requestData={handleNeedMoreData}
                isLoading={isLoading && allFetchedItems.length === 0}
                sortControl={<BookSearchFilter sortType={sortConfig.type} sortOrder={sortConfig.order} onSortChange={handleSortChange} />}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            >
                {(currentPageItems: Post[]) => (
                    <Grid container spacing={2}>
                        {currentPageItems.map((post) => (
                            <Grid sx={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={post.id}>
                                <PostCard post={post} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </UniversalPaginator>
            <Divider className="!my-6" />
            <UniversalPaginator<Post>
                data={allFetchedItems}
                totalExternalItems={totalItems}
                itemsPerPage={30}
                externalItemsPerPage={EXTERNAL_PAGE_SIZE}
                sortType={sortConfig.type}
                sortOrder={sortConfig.order}
                onSortChange={handleSortChange}
                requestData={handleNeedMoreData}
                isLoading={isLoading && allFetchedItems.length === 0}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
            >
                {(currentPageItems: Post[]) => (
                    <Grid container spacing={2}>
                        {currentPageItems.map((post) => (
                            <Grid sx={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={post.id}>
                                <PostCard post={post} />
                            </Grid>
                        ))}
                    </Grid>
                )}
            </UniversalPaginator>
        </Box>
    );
}
