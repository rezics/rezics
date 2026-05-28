import type { DashboardSectionResult } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@rezics/ui/shadcn";
import type React from "react";

export interface DashboardSectionProps<T> {
  title: string;
  result: DashboardSectionResult<T>;
  /** Whether the resolved value is empty (renders the empty copy). */
  isEmpty?: (value: T) => boolean;
  emptyText?: string;
  /** Re-fetch the whole dashboard; only offered for retryable errors. */
  onRetry?: () => void;
  children: (value: T) => React.ReactNode;
}

/**
 * Renders one dashboard section, handling the partial-success contract:
 * a retryable error shows a retry affordance, a non-retryable error is
 * hidden (the client fetches that section through its own hook elsewhere),
 * and an empty `ok` value shows neutral empty copy.
 */
export function DashboardSection<T>({
  title,
  result,
  isEmpty,
  emptyText,
  onRetry,
  children,
}: DashboardSectionProps<T>) {
  const { t } = useTranslation(["common"]);

  if ("error" in result) {
    // Non-retryable (NOT_AGGREGATED) sections are owned by dedicated hooks.
    if (!result.error.retryable) return null;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm text-text-secondary">
          <span>{t("common:error")}</span>
          {onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              {t("common:retry")}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const value = result.ok;
  const empty = isEmpty ? isEmpty(value) : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-text-secondary">
            {emptyText ?? t("common:none")}
          </p>
        ) : (
          children(value)
        )}
      </CardContent>
    </Card>
  );
}
