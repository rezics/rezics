import type { ContinueReadingItem } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import type React from "react";
import { ReadingProgressBar } from "@/progress-status";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import {
  continueReadingProgress,
  resumeRouteToHref,
} from "../models/resumeRoute";

export interface ContinueReadingSectionProps {
  items: readonly ContinueReadingItem[];
  title?: React.ReactNode | false;
  emptyText?: React.ReactNode;
  className?: string;
}

export const ContinueReadingSection: React.FC<ContinueReadingSectionProps> = ({
  items,
  title,
  emptyText,
  className,
}) => {
  const { t } = useTranslation(["page"]);
  return (
    <section className={cn("space-y-3", className)}>
      {title !== false ? (
        <h2 className="text-lg font-semibold leading-snug text-text-primary">
          {title ?? t("page:progress_continue_reading")}
        </h2>
      ) : null}
      {items.length === 0 ? (
        <p className="text-sm leading-ui text-text-secondary">
          {emptyText ?? t("page:progress_empty_continue")}
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const progressLabel = t("page:progress_chapters_progress", {
              completed: item.chaptersCompleted,
              total: item.chaptersTotal,
            });
            return (
              <li key={item.bookUnitId}>
                <Link
                  to={resumeRouteToHref(item.resumeRoute)}
                  className="flex h-full gap-3 rounded-md p-2 no-underline hover:bg-surface-sunken"
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
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-sm font-semibold leading-ui text-text-primary">
                      {item.bookTitle}
                    </div>
                    {item.lastReadNodeTitle ? (
                      <div className="line-clamp-1 text-xs leading-dense text-text-secondary">
                        {item.lastReadNodeTitle}
                      </div>
                    ) : item.lastReadAnchorText ? (
                      <div className="line-clamp-1 text-xs leading-dense text-text-secondary">
                        {item.lastReadAnchorText}
                      </div>
                    ) : null}
                    <ReadingProgressBar
                      className="mt-1"
                      value={continueReadingProgress(item)}
                      label={progressLabel}
                      ariaLabel={progressLabel}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
