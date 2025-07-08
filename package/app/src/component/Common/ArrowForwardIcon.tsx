import React from "react";
import { Box, styled, Typography } from "@mui/material";
import { ArrowForwardIos } from "@mui/icons-material";

const LinkWithIcon = styled(Box)(({ theme }) => ({
    display: "inline-flex", // 行内 flex，配合文字更自然
    alignItems: "center", // 垂直居中
    cursor: "pointer",
    color: theme.palette.text.primary,
    // 仅在 hover 时给类名为 `.arrow-icon` 的子元素染色
    "&:hover .arrow-icon": {
        color: theme.palette.primary.main,
    },
}));

export namespace ArrowForwardIcon {
    export type Show = {
        size?: number;
        color?: string;
        children?: React.ReactNode;
    };

    export const Show: React.FC<Show> = ({ size = 24, children }) => {
        return (
            <LinkWithIcon>
                {/* 文本部分，用 Typography 能保证行高一致 */}
                <Typography component="span">{children}</Typography>
                {/* 图标部分，初始继承父级 text color */}
                <ArrowForwardIos className="arrow-icon font-bold" sx={{ fontSize: size, ml: 0.5 }} />
            </LinkWithIcon>
        );
    };

    export type Container = Show;
    export const Container: React.FC<Container> = (props) => {
        return <Show {...props} />;
    };
}
