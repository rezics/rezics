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
  /** Whether the resolved value is empty (renders the empty copy). 解析出的值是否为空（渲染空状态文案）。 */
  isEmpty?: (value: T) => boolean;
  emptyText?: string;
  /** Re-fetch the whole dashboard; only offered for retryable errors. 重新拉取整个仪表盘；仅在可重试的错误时提供。 */
  onRetry?: () => void;
  children: (value: T) => React.ReactNode;
}

/**
 * Renders one dashboard section, handling the partial-success contract:
 * a retryable error shows a retry affordance, a non-retryable error is
 * hidden (the client fetches that section through its own hook elsewhere),
 * and an empty `ok` value shows neutral empty copy.
 * 渲染单个仪表盘区块，处理部分成功的契约：
 * 可重试的错误显示重试操作，不可重试的错误被隐藏
 *（客户端通过别处的专属 hook 拉取该区块），
 * 空的 `ok` 值显示中性的空状态文案。
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
    // 不可重试（NOT_AGGREGATED）的区块由专属 hook 负责。
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
