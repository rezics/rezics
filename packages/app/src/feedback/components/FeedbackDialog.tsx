import type { CreateFeedbackInput } from "@rezics/contract/api/feedback/feedback.types";
import { useTranslation } from "@rezics/i18n/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Separator,
} from "@rezics/ui/shadcn";
import type React from "react";
import { FeedbackForm } from "./FeedbackForm";

type FeedbackDialogProps = {
  open: boolean;
  onClose: () => void;
  defaultValues?: {
    title?: string;
    content?: string;
    type?: CreateFeedbackInput["type"];
  };
};

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  open,
  onClose,
  defaultValues,
}) => {
  const { t } = useTranslation(["community"]);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("community:feedback_submit")}</DialogTitle>
        </DialogHeader>
        <Separator />
        <div className="pt-2">
          <FeedbackForm defaultValues={defaultValues} onSubmitted={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
