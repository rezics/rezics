import React from "react";
import { Box, IconButton, useTheme } from "@mui/material";
import { KeyboardArrowUp, KeyboardArrowDown, ChatBubbleOutline, StarBorder, Send } from "@mui/icons-material";
import { proxy, useSnapshot } from "valtio";

interface ReactionBarProps {
    onReply?: () => void;
    className?: string;
}

const state = proxy({ dialogVisible: false });

export const ReactionBar: React.FC<ReactionBarProps> = ({ onReply, className }) => {
    const handleReply = () => {
        state.dialogVisible = true;
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
                <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
                    <KeyboardArrowUp fontSize="inherit" />
                </IconButton>
                <IconButton size="large" sx={{ fontSize: "1.5rem", ml: 1 }}>
                    <KeyboardArrowDown fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size="large" sx={{ fontSize: "1.5rem" }} onClick={handleReply}>
                    <ChatBubbleOutline fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
                    <StarBorder fontSize="inherit" />
                </IconButton>
            </Box>
            <Box>
                <IconButton size="large" sx={{ fontSize: "1.5rem" }}>
                    <Send fontSize="inherit" />
                </IconButton>
            </Box>
        </Box>
    );
};
