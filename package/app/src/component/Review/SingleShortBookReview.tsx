import React from "react";
import { Box, Avatar, Typography, Rating, Divider, Stack } from "@mui/material";
import ThumbUpIcon from "@mui/icons-material/ThumbUp";
import ThumbDownIcon from "@mui/icons-material/ThumbDown";
import { CollapsibleText } from "@component/Common/CollapsibleText";
import { BookReview } from "@/api/bookReviews";

export namespace SingleShortBookReview {
    export type Show = {
        review: BookReview & {
            likes?: number;
            dislikes?: number;
        };
        onLike?: (reviewId: string) => void;
        onDislike?: (reviewId: string) => void;
    };

    export const Show: React.FC<Show> = ({ review, onLike, onDislike }) => {
        const handleLike = () => {
            onLike?.(review.id);
        };

        const handleDislike = () => {
            onDislike?.(review.id);
        };

        return (
            <Box>
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
                                        onClick={handleLike}
                                    >
                                        <ThumbUpIcon fontSize="small" />
                                        <Typography variant="caption">{review.likes ?? 0}</Typography>
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
                                        onClick={handleDislike}
                                    >
                                        <ThumbDownIcon fontSize="small" />
                                        <Typography variant="caption">{review.dislikes ?? 0}</Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        </Box>
                        <Typography component="div" variant="body2" color="text.secondary">
                            <CollapsibleText.Container content={review.content} threshold={50} />
                        </Typography>
                    </Box>
                </Box>
                <Divider sx={{ mt: 2 }} />
            </Box>
        );
    };
}
