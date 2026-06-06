import { useTranslation } from "@rezics/i18n/react";
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
  const { t } = useTranslation(["entity"]);
  return (
    <EmptyState
      icon={<PushPinRoundedIcon fontSize="large" />}
      title={title ?? t("entity:pinboard_empty_title")}
      description={description ?? t("entity:pinboard_empty_description")}
      action={action}
    />
  );
};
