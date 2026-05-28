import { useTranslation } from "@rezics/i18n/react";
import { EmptyState } from "@rezics/ui";
import { Button } from "@rezics/ui/shadcn";
import { CircleAlert as ErrorOutlineRoundedIcon } from "lucide-react";
import type React from "react";

interface PinboardErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export const PinboardErrorState: React.FC<PinboardErrorStateProps> = ({
  message,
  onRetry,
}) => {
  const { t } = useTranslation(["common", "entity"]);
return (
    <EmptyState
      icon={<ErrorOutlineRoundedIcon className="h-9 w-9 text-error-text" />}
      title={t("entity:pinboard_error_title")}
      description={message ?? t("entity:pinboard_error_description")}
      action={
        onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common:retry")}
          </Button>
        ) : undefined
      }
    />
  );
};
