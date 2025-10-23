import {Box, CircularProgress, Typography} from '@mui/material';
import type {FC, ReactNode} from 'react';

export const UserLoading: FC<{height?: number}> = ({height = 256}) => {
  return (
    <Box className="flex items-center justify-center" sx={{height}}>
      <CircularProgress />
    </Box>
  );
};

export const UserError: FC<{message?: ReactNode; height?: number}> = ({
  message = 'Something went wrong',
  height = 256,
}) => {
  return (
    <Box className="flex items-center justify-center" sx={{height}}>
      <Typography color="error">{message}</Typography>
    </Box>
  );
};
