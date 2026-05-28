import { useDashboardSummary } from "@rezics/api/dashboard";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import type React from "react";
import { ContinueReadingSection } from "../sections/ContinueReadingSection";
import { RealmsSection } from "../sections/RealmsSection";
import { SafetySection } from "../sections/SafetySection";
import { ShelvesSection } from "../sections/ShelvesSection";

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation(["page", "common"]);
  const { data, isLoading, isError, refetch } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-text-secondary">
        <Spinner size="sm" /> {t("common:loading")}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-sm text-error-text">{t("common:error")}</div>
    );
  }

  const onRetry = () => {
    void refetch();
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-2xl font-bold text-text-primary">
        {t("page:dashboard_title")}
      </h1>

      <SafetySection result={data.safety} onRetry={onRetry} />
      <ContinueReadingSection result={data.continueReading} onRetry={onRetry} />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <ShelvesSection result={data.shelves} onRetry={onRetry} />
        <RealmsSection result={data.realms} onRetry={onRetry} />
      </div>
    </div>
  );
};
