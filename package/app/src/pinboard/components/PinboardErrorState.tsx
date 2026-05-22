import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { useTranslation } from "@rezics/i18n/react";
import { CircleAlert as ErrorOutlineRoundedIcon } from "lucide-react";

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
      icon={<ErrorOutlineRoundedIcon className="h-9 w-9 text-error-text" />}
      title={t("pinboard.error.title")}
      description={message ?? t("pinboard.error.description")}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common.retry")}
          </Button>
        ) : undefined
      }
    />
  );
};
