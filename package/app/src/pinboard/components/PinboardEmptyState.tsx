import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "react-i18next";

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
