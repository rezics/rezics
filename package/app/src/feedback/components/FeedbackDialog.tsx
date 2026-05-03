import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@rezics/ui/shadcn";
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
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>提交反馈</DialogTitle>
        </DialogHeader>
        <Separator />
        <div className="pt-2">
          <FeedbackForm defaultValues={defaultValues} onSubmitted={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackDialog;
