import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { CircleAlert as ErrorOutlineRoundedIcon } from "lucide-react";
import * as m from "@rezics/i18n/messages";

interface PinboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const PinboardErrorState: React.FC<PinboardErrorStateProps> = ({
  message,
  onRetry,
}) => {
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
