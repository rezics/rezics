import type { DashboardSafety, DashboardSectionResult } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { DashboardSection } from "../components/DashboardSection";

export interface SafetySectionProps {
  result: DashboardSectionResult<DashboardSafety>;
  onRetry?: () => void;
}

/**
 * Renders account safety/enforcement notices only when there is something to
 * show. A clean account renders nothing so the dashboard stays uncluttered.
 */
export const SafetySection: React.FC<SafetySectionProps> = ({
  result,
  onRetry,
}) => {
  const { t } = useTranslation(["page"]);

  if ("ok" in result && !result.ok.enforcementActive) return null;

  return (
    <DashboardSection
      title={t("page:dashboard_safety")}
      result={result}
      onRetry={onRetry}
    >
      {(safety) => (
        <ul className="flex flex-col gap-1 text-sm text-error-text">
          {safety.notices.map((notice) => (
            <li key={notice.code}>{notice.message}</li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
