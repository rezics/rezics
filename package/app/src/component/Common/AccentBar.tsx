import React from "react";
import { Box, Typography, useTheme } from "@mui/material";

export namespace AccentBar {
    export type Show = {
        height?: number;
        color?: string;
    };

    export const Show: React.FC<Show> = ({ height = 24, color }) => {
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

    export type Container = Show;
    export const Container: React.FC<Container> = (props) => {
        return <Show {...props} />;
    };
}

export namespace AccentBarWithText {
    export type Show = {
        height?: number;
        color?: string;
        text: string;
    };

    export const Show: React.FC<Show> = ({ height = 24, color, text }) => {
        const theme = useTheme();

        return (
            <Typography variant="h5" className="font-bold flex items-center">
                <AccentBar.Show height={height} color={color || theme.palette.primary.main} />
                <span>{text}</span>
            </Typography>
        );
    };

    export type Container = Show;
    export const Container: React.FC<Container> = (props) => {
        return <Show {...props} />;
    };
}
