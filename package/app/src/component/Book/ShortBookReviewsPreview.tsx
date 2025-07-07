import React from "react";
import { Box, Avatar, Typography, Divider, Stack } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import { Rating } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { CollapsibleText } from "../Common/CollapsibleText";

interface Review {
    id: number;
    user: {
        name: string;
        avatar: string;
    };
    title: string;
    content: string;
    rating: number;
    createdAt: string;
    likes: number;
    dislikes: number;
}

interface ShortBookReviewsProps {
    bookId: string;
}

const state = proxy({
    reviews: [] as Review[],
    loading: false,
    error: null as string | null,
});

export const ShortBookReviews: React.FC<ShortBookReviewsProps> = ({ bookId }) => {
    const snap = useSnapshot(state);

    React.useEffect(() => {
        fetchReviews();
    }, [bookId]);

    const handleLike = (reviewId: number) => {
        console.log("Like review:", reviewId);
    };

    const handleDislike = (reviewId: number) => {
        console.log("Dislike review:", reviewId);
    };

    const fetchReviews = () => {
        // TODO: fetch reviews from server
        // Mock reviews
        state.reviews = [
            {
                id: 1,
                user: {
                    name: "张三",
                    avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
                },
                title: "好书",
                content: "这是一本好书",
                rating: 5,
                createdAt: "2021-01-01",
                likes: 10,
                dislikes: 2,
            },
            {
                id: 2,
                user: {
                    name: "李四",
                    avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
                },
                title: "好书",
                content:
                    '读这本书的时候，文字以更舒缓的节奏停留在纸页上，让我得以随着自己的速度向前走。相比精简过的电影，文字的语言更柔和（简短句较少，不知道是原文的风格还是翻译的风格），增添了很多故事情节和主角的心理活动。于是主角变得比电影更生动。印象中电影前半段的主角较为冷情，对作为证人出席的性侵案受害者共感也少。书中的主角则有被撼动的一刻。"律师应该在不知道真相的情况下辩护"这个方针，电影主角给我的感觉是，因为这样对工作更方便所以选择，书的主角则思考过更多，她更有人文关怀，决定遵循这个原则也是因为法律体系就是这样运转，在这个规则里她应当扮演这样的角色。她思考过何为正义，也拥护正义，并认为正义应该由整个法律体系给出。',
                rating: 4,
                createdAt: "2021-01-01",
                likes: 10,
                dislikes: 2,
            },
            {
                id: 3,
                user: {
                    name: "王五",
                    avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
                },
                title: "好书",
                content: "这是一本好书",
                rating: 3,
                createdAt: "2021-01-01",
                likes: 10,
                dislikes: 2,
            },
            {
                id: 4,
                user: {
                    name: "赵六",
                    avatar: "https://styles.redditmedia.com/t5_26vvze/styles/profileIcon_pyesq04om2re1.jpeg",
                },
                title: "好书",
                content:
                    "的确，没有剧版那样浓烈的情绪铺天盖地的。但因为是可以停顿下来的字里行间，所以，也再次看到了更多的细节。还有一个结尾处，没有被放进剧版里的，关于女记者的又一个三分之一，也很动人。",
                rating: 3.5,
                createdAt: "2021-01-01",
                likes: 10,
                dislikes: 2,
            },
        ];
    };

    return (
        <Stack spacing={2}>
            {snap.reviews.map((review) => (
                <Box key={review.id}>
                    <Box sx={{ display: "flex", gap: 2 }}>
                        <Avatar src={review.user.avatar} sx={{ width: 32, height: 32 }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                <Typography variant="subtitle2" fontWeight="medium">
                                    {review.user.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {review.createdAt}
                                </Typography>
                                <Rating value={review.rating} readOnly size="small" precision={0.5} />
                                <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1 }}>
                                    <Stack direction="row" spacing={2}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                color: "text.secondary",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    color: "primary.main",
                                                },
                                            }}
                                            onClick={() => handleLike(review.id)}
                                        >
                                            <ThumbUpIcon fontSize="small" />
                                            <Typography variant="caption">{review.likes || 0}</Typography>
                                        </Box>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 0.5,
                                                color: "text.secondary",
                                                cursor: "pointer",
                                                "&:hover": {
                                                    color: "error.main",
                                                },
                                            }}
                                            onClick={() => handleDislike(review.id)}
                                        >
                                            <ThumbDownIcon fontSize="small" />
                                            <Typography variant="caption">{review.dislikes || 0}</Typography>
                                        </Box>
                                    </Stack>
                                </Box>
                            </Box>
                            <Typography component="div" variant="body2" color="text.secondary">
                                <CollapsibleText content={review.content} threshold={50} />
                            </Typography>
                        </Box>
                    </Box>
                    <Divider sx={{ mt: 2 }} />
                </Box>
            ))}
        </Stack>
    );
};
