import React from "react";
import { Box, Avatar, Typography, Link, Paper } from "@mui/material";
import { proxy, useSnapshot } from "valtio";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";

interface QuoteExcerptProps {
    author?: {
        name: string;
        avatar: string;
    };
    content: string;
    stats?: {
        replies: number;
        likes: number;
        date: string;
    };
    source?: string;
    originalLink?: string;
}

export const QuoteExcerpt: React.FC<QuoteExcerptProps> = ({
    author = {
        name: "Amy Elsner",
        avatar: "/vite.svg",
    },
    content,
    stats = {
        replies: 61,
        likes: 561,
        date: "2013-01-08 14:33:44",
    },
    source = "引自第 5 页",
    originalLink = "#",
}) => {

    const state = proxy({} as QuoteExcerptProps | any);
    state.author = author;
    state.content = content;
    state.stats = stats;
    state.source = source;
    state.originalLink = originalLink;

    const snap = useSnapshot(state);

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 2,
                "& .MuiPaper-root": {
                    borderColor: "divider",
                },
            }}
        >
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                <Avatar src={snap.author.avatar} sx={{ width: 20, height: 20, mr: 1 }} />
                <Typography variant="subtitle2" fontWeight="bold">
                    {snap.author.name}
                </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "flex-start" }}>
                <FormatQuoteIcon
                    sx={{
                        fontSize: 30,
                        color: "text.secondary",
                        mr: 1,
                        mt: 0.5,
                    }}
                />
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6 }}>
                        {snap.content}
                        <Link
                            href={snap.originalLink}
                            sx={{
                                ml: 0.5,
                                color: "primary.main",
                                "&:hover": {
                                    textDecoration: "underline",
                                },
                            }}
                        >
                            (查看原文)
                        </Link>
                    </Typography>

                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            mt: 1.5,
                            color: "text.secondary",
                            fontSize: "0.75rem",
                        }}
                    >
                        <Box sx={{ display: "flex", gap: 1 }}>
                            <Typography variant="caption">{snap.stats.replies} 回复</Typography>
                            <Typography variant="caption">{snap.stats.likes} 赞</Typography>
                            <Typography variant="caption">{snap.stats.date}</Typography>
                        </Box>
                        <Typography variant="caption" color="text.disabled">
                            —— {snap.source}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};
