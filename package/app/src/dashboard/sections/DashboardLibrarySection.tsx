import { userQueries } from "@rezics/api/user/user.queries";
import type { BookshelfViewConfig, ProgressLibraryRow } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent, CardHeader, CardTitle } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { resolveBookshelfConfig, UseMySettingsButton } from "@/bookshelf-view";
import { progressLibraryRowToBookshelfItem } from "@/progress";
import { DashboardLibraryShelfBlock } from "./DashboardLibraryShelfBlock";

export interface DashboardLibrarySectionProps {
  /**
   * Progress-owned library rows; shelf membership is not required.
   * 由 progress 拥有的库行；不要求 shelf 成员关系。
   */
  progressRows: readonly ProgressLibraryRow[];
  /**
   * Bookshelf layout from the URL query, if any (highest precedence).
   * 来自 URL 查询的书架布局（如有，优先级最高）。
   */
  urlConfig?: BookshelfViewConfig | null;
  /**
   * Clear the URL override so the viewer's stored settings take effect.
   * 清除 URL 覆盖项，使浏览者存储的设置生效。
   */
  onResetUrlConfig?: () => void;
}

/**
 * The dashboard library section: progress-owned rows rendered through the
 * shared `bookshelf` view. Layout follows the `shelf-collection` resolution
 * order — URL override → viewer's `userSettings.library.bookshelf` → default —
 * and exposes the same "use my settings" reset.
 * 仪表盘库分区：由 progress 拥有的行通过共享的 `bookshelf` 视图渲染。
 * 布局遵循 `shelf-collection` 的解析顺序——URL 覆盖项 → 浏览者的
 * `userSettings.library.bookshelf` → 默认值——并提供相同的“使用我的设置”重置。
 */
export function DashboardLibrarySection({
  progressRows,
  urlConfig,
  onResetUrlConfig,
}: DashboardLibrarySectionProps) {
  const { t } = useTranslation(["page"]);
  const { data: settings } = useQuery(userQueries.settings());

  const config = useMemo(
    () =>
      resolveBookshelfConfig({
        url: urlConfig ?? null,
        viewer: settings?.library?.bookshelf ?? null,
      }),
    [urlConfig, settings?.library?.bookshelf],
  );
  const items = useMemo(
    () =>
      progressRows.flatMap((row) => {
        const item = progressLibraryRowToBookshelfItem(row);
        return item ? [item] : [];
      }),
    [progressRows],
  );
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{t("page:dashboard_library")}</CardTitle>
        <UseMySettingsButton
          hasUrlOverride={!!urlConfig}
          onReset={() => onResetUrlConfig?.()}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <DashboardLibraryShelfBlock items={items} config={config} />
      </CardContent>
    </Card>
  );
}
