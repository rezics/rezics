import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { Pin as PushPinRoundedIcon } from "lucide-react";

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
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<PushPinRoundedIcon fontSize="large" />}
      title={title ?? t("pinboard.empty.title")}
      description={description ?? t("pinboard.empty.description")}
      action={action}
    />
  );
};
