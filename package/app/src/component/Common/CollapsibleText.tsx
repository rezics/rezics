import React, { useMemo, useState } from "react";
import { Box, Link, useTheme } from "@mui/material";
import { proxy, useSnapshot } from "valtio";

export namespace CollapsibleText {
    export type Show = {
        content: string;
        threshold?: number;
        isExpanded: boolean;
        onToggle: () => void;
    };

    export const Show: React.FC<Show> = ({ content, threshold = 200, isExpanded, onToggle }) => {
        const theme = useTheme();

        const truncatedContent = useMemo(() => {
            return content.length > threshold ? content.slice(0, threshold) : content;
        }, [content, threshold]);

        return (
            <Box sx={{ position: "relative" }}>
                <Box>
                    {isExpanded ? content : truncatedContent}
                    {content.length > threshold && (
                        <>
                            {!isExpanded && "…"}{" "}
                            <Link
                                component="button"
                                onClick={onToggle}
                                sx={{
                                    fontSize: "0.875rem",
                                    color: theme.palette.primary.main,
                                    textDecoration: "none",
                                    "&:hover": {
                                        textDecoration: "underline",
                                        cursor: "pointer",
                                    },
                                    transition: "color 0.2s",
                                }}
                            >
                                {isExpanded ? "收起" : "展開"}
                            </Link>
                        </>
                    )}
                </Box>
            </Box>
        );
    };

    export type Container = {
        content: string;
        threshold?: number;
    };

    export const Container: React.FC<Container> = ({ content, threshold = 200 }) => {
        const [state] = useState(() => proxy({ isExpanded: false }));
        const snap = useSnapshot(state);

        const toggle = () => {
            state.isExpanded = !state.isExpanded;
        };

        return <Show content={content} threshold={threshold} isExpanded={snap.isExpanded} onToggle={toggle} />;
    };
}
