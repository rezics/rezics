import React from "react";
import { Box, Typography, useTheme } from "@mui/material";

interface AccentBarProps {
    height?: number;
    color?: string;
}

interface AccentBarWithTextProps extends AccentBarProps {
    text: string;
}

export const AccentBar: React.FC<AccentBarProps> = ({ height = 24, color }) => {
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

export const AccentBarWithText: React.FC<AccentBarWithTextProps> = ({ height = 24, color, text }) => {
    const theme = useTheme();

    return (
        <Typography variant="h5" className="font-bold flex items-center">
            <AccentBar height={height} color={color || theme.palette.primary.main} />
            {text}
        </Typography>
    );
};
