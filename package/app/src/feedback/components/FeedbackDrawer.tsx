import type { CreateFeedbackInput } from "@rezics/api/feedback/feedback.types";
import {
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@rezics/ui/shadcn";
import type React from "react";
import FeedbackForm from "./FeedbackForm";
import { useMessage } from "@rezics/i18n/react";
import { feedback_submit } from "@rezics/i18n/messages";
const i18nMessages = {
  feedback_submit,
};

type FeedbackDrawerProps = {
  open: boolean;
  onClose: () => void;
  defaultValues?: {
    title?: string;
    content?: string;
    type?: CreateFeedbackInput["type"];
  };
};

const FeedbackDrawer: React.FC<FeedbackDrawerProps> = ({
  open,
  onClose,
  defaultValues,
}) => {
  const m = useMessage(i18nMessages);
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-[min(520px,100vw)] p-0 sm:max-w-none"
      >
        <SheetHeader className="px-4 py-3">
          <SheetTitle>{m.feedback_submit()}</SheetTitle>
        </SheetHeader>
        <Separator />
        <div className="p-4">
          <FeedbackForm defaultValues={defaultValues} onSubmitted={onClose} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FeedbackDrawer;
