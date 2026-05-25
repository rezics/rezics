import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { CircleAlert as ErrorOutlineRoundedIcon } from "lucide-react";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  common_retry,
  pinboard_error_description,
  pinboard_error_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_retry,
  pinboard_error_description,
  pinboard_error_title,
};

interface PinboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const PinboardErrorState: React.FC<PinboardErrorStateProps> = ({
  message,
  onRetry,
}) => {
  const m = useMessage(i18nMessages);
  return (
    <EmptyState
      icon={<ErrorOutlineRoundedIcon className="h-9 w-9 text-error-text" />}
      title={m.pinboard_error_title()}
      description={message ?? m.pinboard_error_description()}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {m.common_retry()}
          </Button>
        ) : undefined
      }
    />
  );
};
