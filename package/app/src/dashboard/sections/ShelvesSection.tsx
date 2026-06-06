import type {
  DashboardSectionResult,
  DashboardShelfSummary,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { DashboardSection } from "../components/DashboardSection";

export interface ShelvesSectionProps {
  result: DashboardSectionResult<DashboardShelfSummary[]>;
  onRetry?: () => void;
}

export const ShelvesSection: React.FC<ShelvesSectionProps> = ({
  result,
  onRetry,
}) => {
  const { t } = useTranslation(["page"]);
  return (
    <DashboardSection
      title={t("page:dashboard_shelves")}
      result={result}
      isEmpty={(shelves) => shelves.length === 0}
      emptyText={t("page:dashboard_empty_shelves")}
      onRetry={onRetry}
    >
      {(shelves) => (
        <ul className="flex flex-col gap-2">
          {shelves.map((shelf) => {
            const href: string = `/shelf/${shelf.shelfId}`;
            return (
              <li key={shelf.shelfId}>
                <Link
                  to={href}
                  className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-sunken"
                >
                  <span className="line-clamp-1 font-medium text-text-primary">
                    {shelf.title}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {shelf.itemCount}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
};
