import {Box, useTheme} from '@mui/material';
import React from 'react';

export interface AccentBarProps {
  height?: number;
  color?: string;
  width?: number;
  radius?: number;
  className?: string;
}

export const AccentBar: React.FC<AccentBarProps> = ({
  height = 24,
  color,
  width = 4,
  radius = 2,
  className,
}) => {
  const theme = useTheme();

  return (
    <Box
      className={className}
      sx={{
        display: 'inline-block',
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${radius}px`,
        backgroundColor: color ?? theme.palette.primary.main,
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
};
