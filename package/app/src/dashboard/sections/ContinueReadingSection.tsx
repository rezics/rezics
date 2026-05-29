import type {
  ContinueReadingItem,
  DashboardSectionResult,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { ReadingProgressBar } from "@/progress-status";
import { Link } from "@/shared/ui/link";
import { DashboardSection } from "../components/DashboardSection";
import { continueReadingProgress, resumeRouteToHref } from "../models";

export interface ContinueReadingSectionProps {
  result: DashboardSectionResult<ContinueReadingItem[]>;
  onRetry?: () => void;
}

export const ContinueReadingSection: React.FC<ContinueReadingSectionProps> = ({
  result,
  onRetry,
}) => {
  const { t } = useTranslation(["page"]);
  return (
    <DashboardSection
      title={t("page:dashboard_continue_reading")}
      result={result}
      isEmpty={(items) => items.length === 0}
      emptyText={t("page:dashboard_empty_continue")}
      onRetry={onRetry}
    >
      {(items) => (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.bookUnitId}>
              <Link
                to={resumeRouteToHref(item.resumeRoute)}
                className="flex gap-3 rounded-md p-2 hover:bg-surface-sunken"
              >
                {item.bookCoverUrl ? (
                  <img
                    src={item.bookCoverUrl}
                    alt={item.bookTitle}
                    className="h-20 w-14 flex-none rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-20 w-14 flex-none rounded bg-surface-sunken" />
                )}
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-text-primary">
                    {item.bookTitle}
                  </div>
                  {item.lastReadNodeTitle ? (
                    <div className="line-clamp-1 text-xs text-text-secondary">
                      {item.lastReadNodeTitle}
                    </div>
                  ) : null}
                  <ReadingProgressBar
                    className="mt-1"
                    value={continueReadingProgress(item)}
                    label={t("page:dashboard_chapters_progress", {
                      completed: item.chaptersCompleted,
                      total: item.chaptersTotal,
                    })}
                    ariaLabel={t("page:dashboard_chapters_progress", {
                      completed: item.chaptersCompleted,
                      total: item.chaptersTotal,
                    })}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
};
