import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Divider,
  Box,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FeedbackForm from './FeedbackForm';
import type {CreateFeedbackInput} from '@rezics/api/feedback/feedback.types';

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultValues?: {
    title?: string;
    content?: string;
    type?: CreateFeedbackInput['type'];
  };
};

const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  onClose,
  defaultValues,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm" // roughly similar width control as Drawer
    >
      <DialogTitle className="flex items-center justify-between">
        提交反馈
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <Divider />
      <DialogContent>
        <Box className="pt-2">
          <FeedbackForm defaultValues={defaultValues} onSubmitted={onClose} />
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
