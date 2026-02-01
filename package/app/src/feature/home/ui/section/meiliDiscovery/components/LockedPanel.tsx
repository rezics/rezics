import React from 'react';
import {Box, Paper} from '@mui/material';

export const LockedPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({children, className}) => {
  return (
    <Paper
      className={`${className} p-4 lg:h-[42rem] rounded-lg`}
      sx={{
        height: '32rem',
        backgroundColor: 'transparent',
      }}
      elevation={0}
    >
      <Box className="h-full bg-surface rounded-lg p-3 shadow-sm">
        {children}
      </Box>
    </Paper>
  );
};

