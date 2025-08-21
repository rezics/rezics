import { Box, Typography, useTheme } from "@mui/material";
import React from "react";

export type AccentBarShowProps = {
    height?: number;
    color?: string;
};

export const AccentBarShow: React.FC<AccentBarShowProps> = ({ height = 24, color }) => {
    const theme = useTheme();

    return (
        <Box
            className="mt-auto mb-auto"
            sx={{
                display: "inline-block",
                width: "4px",
                borderRadius: "2px",
                marginRight: 1,
                verticalAlign: "middle",
                height: `${height}px`,
                backgroundColor: color || theme.palette.primary.main,
            }}
        />
    );
};

export type AccentBarContainerProps = AccentBarShowProps;
export const AccentBarContainer: React.FC<AccentBarContainerProps> = (props) => {
    return <AccentBarShow {...props} />;
};

export type AccentBarWithTextShowProps = {
    height?: number;
    color?: string;
    text: string;
};

export const Show: React.FC<AccentBarWithTextShowProps> = ({ height = 24, color, text }) => {
    const theme = useTheme();

    return (
        <Typography variant="h5" className="font-bold flex items-center">
            <AccentBarShow
                height={height}
                color={color || theme.palette.primary.main}
            />
            <span>{text}</span>
        </Typography>
    );
};

export type AccentBarWithTextContainerProps = AccentBarWithTextShowProps;
export const AccentBarWithTextContainer: React.FC<AccentBarWithTextContainerProps> = (props) => {
    return <Show {...props} />;
};
