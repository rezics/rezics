import * as m from "@rezics/i18n/messages";
import { EmptyState } from "@rezics/ui";
import { Pin as PushPinRoundedIcon } from "lucide-react";
import type React from "react";

interface PinboardEmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

export const PinboardEmptyState: React.FC<PinboardEmptyStateProps> = ({
  title,
  description,
  action,
}) => {
  return (
    <EmptyState
      icon={<PushPinRoundedIcon fontSize="large" />}
      title={title ?? m.pinboard_empty_title()}
      description={description ?? m.pinboard_empty_description()}
      action={action}
    />
  );
};
