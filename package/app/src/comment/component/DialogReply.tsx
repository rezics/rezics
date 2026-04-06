import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import type React from "react";
import { useDialogStore } from "../state/dialogStore";

export type DialogReplyProps = {
  onSubmit?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  cancelText?: React.ReactNode;
  confirmText?: React.ReactNode;
};

const DialogReply: React.FC<DialogReplyProps> = ({
  onSubmit,
  title,
  children,
  cancelText = "取消",
  confirmText = "确认",
}) => {
  const dialog = useDialogStore();

  const handleClose = () => {
    dialog.setDialogVisible("dialogId", false);
  };

  const handleSubmit = () => {
    onSubmit?.();
    handleClose();
  };

  return (
    <Dialog
      open={dialog.dialogs.dialogId?.visible ?? false}
      onClose={handleClose}
    >
      {title && <DialogTitle>{title}</DialogTitle>}

      <DialogContent>{children}</DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>{cancelText}</Button>

        <Button onClick={handleSubmit} variant="contained" color="primary">
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DialogReply;
