import type {
  DashboardRealmSummary,
  DashboardSectionResult,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { DashboardSection } from "../components/DashboardSection";

export interface RealmsSectionProps {
  result: DashboardSectionResult<DashboardRealmSummary[]>;
  onRetry?: () => void;
}

export const RealmsSection: React.FC<RealmsSectionProps> = ({
  result,
  onRetry,
}) => {
  const { t } = useTranslation(["page"]);
  return (
    <DashboardSection
      title={t("page:dashboard_realms")}
      result={result}
      isEmpty={(realms) => realms.length === 0}
      emptyText={t("page:dashboard_empty_realms")}
      onRetry={onRetry}
    >
      {(realms) => (
        <div className="flex flex-wrap gap-2">
          {realms.map((realm) => {
            const href: string = `/realm/${realm.slug ?? realm.realmId}`;
            return (
              <Link
                key={realm.realmId}
                to={href}
                className="rounded-full border border-border-whisper px-3 py-1 text-sm hover:bg-surface-sunken"
              >
                {realm.name}
              </Link>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
};
