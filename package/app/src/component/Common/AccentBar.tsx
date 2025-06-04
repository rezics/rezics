import React from 'react';
import { Box, useTheme } from '@mui/material';

interface AccentBarProps {
  height?: number;
  color?: string;
}

export const AccentBar: React.FC<AccentBarProps> = ({ 
  height = 24,
  color
}) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'inline-block',
        width: '4px',
        borderRadius: '2px',
        marginRight: 1,
        verticalAlign: 'middle',
        height: `${height}px`,
        backgroundColor: color || theme.palette.primary.main,
      }}
    />
  );
};