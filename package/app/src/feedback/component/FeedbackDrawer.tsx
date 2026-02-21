import React from 'react';
import {Drawer, Box, Typography, IconButton, Divider} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FeedbackForm from './FeedbackForm';
import type {CreateFeedbackInput} from '@package/api/feedback/feedback.types';

type FeedbackDrawerProps = {
  open: boolean;
  onClose: () => void;
  defaultValues?: {
    title?: string;
    content?: string;
    type?: CreateFeedbackInput['type'];
  };
};

const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({
  open,
  onClose,
  defaultValues,
}) => {
  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box className="w-[min(520px,100vw)]" role="presentation">
        <Box className="flex items-center justify-between px-4 py-3">
          <Typography variant="h6">提交反馈</Typography>
          <IconButton aria-label="close" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <Box className="p-4">
          <FeedbackForm defaultValues={defaultValues} onSubmitted={onClose} />
        </Box>
      </Box>
    </Drawer>
  );
};

export default FeedbackDrawer;
