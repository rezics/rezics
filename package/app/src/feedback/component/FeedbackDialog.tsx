import CloseIcon from "@mui/icons-material/Close";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
} from "@mui/material";
import type { CreateFeedbackInput } from "@rezics/api/feedback/feedback.types";
import type React from "react";
import FeedbackForm from "./FeedbackForm";

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultValues?: {
    title?: string;
    content?: string;
    type?: CreateFeedbackInput["type"];
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
