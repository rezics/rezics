import type { CreateFeedbackInput } from "@rezics/api/feedback/feedback.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@rezics/ui/shadcn";
import type React from "react";
import FeedbackForm from "./FeedbackForm";
import { useMessage } from "@rezics/i18n/react";
import { feedback_submit } from "@rezics/i18n/messages";
const m = {
  feedback_submit,
};

const i18nMessages = {
  feedback_submit,
};

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
  const m = useMessage(i18nMessages);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{m.feedback_submit()}</DialogTitle>
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
