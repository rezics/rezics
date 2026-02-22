import {
  Dialog,
  DialogTitle,
  DialogContent,
  Typography,
  Button,
} from '@mui/material';
import React from 'react';

export const ConfirmDeleteDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}> = ({open, onClose, onSubmit}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          className: 'min-w-[20rem]',
        },
      }}
    >
      <DialogTitle>确认删除</DialogTitle>
      <DialogContent>
        <Typography>删除后将无法恢复</Typography>
        <Button
          variant="contained"
          color="primary"
          className="w-full !mt-4"
          onClick={onSubmit}
        >
          删除
        </Button>
      </DialogContent>
    </Dialog>
  );
};
