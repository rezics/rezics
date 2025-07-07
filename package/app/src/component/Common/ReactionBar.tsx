import React from "react";
import { Box, IconButton } from "@mui/material";
import { KeyboardArrowUp, KeyboardArrowDown, ChatBubbleOutline, StarBorder, Send } from "@mui/icons-material";

interface ReactionBarProps {
    onReply?: () => void;
    className?: string;
    size?: "small" | "medium" | "large";
    fontSize?: string;
}

export const ReactionBar: React.FC<ReactionBarProps> = ({
    onReply,
    className,
    size = "large",
    fontSize = "1.5rem",
}) => {
    const handleReply = () => {
        onReply?.();
    };

    return (
        <Box
            sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                maxWidth: "24rem", // max-w-sm
                mx: "auto",
            }}
            className={className}
        >
            <Box>
                <IconButton size={size} sx={{ fontSize }}>
                    <KeyboardArrowUp fontSize="inherit" />
                </IconButton>
                <IconButton size={size} sx={{ fontSize, ml: 1 }}>
                    <KeyboardArrowDown fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size={size} sx={{ fontSize }} onClick={handleReply}>
                    <ChatBubbleOutline fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size={size} sx={{ fontSize }}>
                    <StarBorder fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size={size} sx={{ fontSize }}>
                    <Send fontSize="inherit" />
                </IconButton>
            </Box>
        </Box>
    );
};
