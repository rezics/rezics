import { EmptyState } from "@rezics/ui";
import { Pin as PushPinRoundedIcon } from "lucide-react";
import type React from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  pinboard_empty_description,
  pinboard_empty_title,
} from "@rezics/i18n/messages";
const m = {
  pinboard_empty_description,
  pinboard_empty_title,
};

const i18nMessages = {
  pinboard_empty_description,
  pinboard_empty_title,
};

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
  const m = useMessage(i18nMessages);
  return (
    <EmptyState
      icon={<PushPinRoundedIcon fontSize="large" />}
      title={title ?? m.pinboard_empty_title()}
      description={description ?? m.pinboard_empty_description()}
      action={action}
    />
  );
};
