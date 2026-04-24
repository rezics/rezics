import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import { Button } from "@mui/material";
import { EmptyState } from "@rezics/ui";
import type React from "react";
import { useTranslation } from "react-i18next";

interface PinboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const PinboardErrorState: React.FC<PinboardErrorStateProps> = ({
  message,
  onRetry,
}) => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={<ErrorOutlineRoundedIcon fontSize="large" color="error" />}
      title={t("pinboard.error.title")}
      description={message ?? t("pinboard.error.description")}
      action={
        onRetry ? (
          <Button variant="outlined" size="small" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        ) : undefined
      }
    />
  );
};
