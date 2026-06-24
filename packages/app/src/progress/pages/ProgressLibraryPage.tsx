import { myProgressPageQuery } from "@rezics/contract/api/progress/progress.queries";
import { userQueries } from "@rezics/contract/api/user/user.queries";
import {
  type BookshelfViewConfig,
  type UserUnitProgressStatus,
  userUnitProgressStatusValues,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BookshelfGrid,
  resolveBookshelfConfig,
  UseMySettingsButton,
} from "@/bookshelf-view";
import { progressStatusLabel } from "@/progress-status/models/status";
import { useRequireAuth } from "@/user/pages/useAuth";
import { progressLibraryRowToBookshelfItem } from "../models/progressBookshelf";

export interface ProgressLibraryPageProps {
  /** Bookshelf layout from the route URL query (highest precedence). 来自路由 URL query 的书架布局（优先级最高）。 */
  libraryUrlConfig?: BookshelfViewConfig | null;
  /** Clear the URL override so the viewer's stored settings take effect. 清除 URL 覆盖，使浏览者已保存的设置生效。 */
  onResetLibraryUrlConfig?: () => void;
}

/**
 * User progress page displaying a status overview and a responsive work grid.
 * Cards point to the best resume route when one exists, so "continue" remains
 * a card behavior rather than a separate page section.
 * 用户进度页面，展示状态概览和响应式作品网格。卡片在存在恢复路线时会指向
 * 最合适的继续位置，因此“继续”是卡片行为，而不是独立页面区块。
 *
 * Mobile <640px:
 * +--[Title]---[⚙]--+
 * | Subtitle        |
 * | +--+--+         |
 * | |st|st| status  |
 * | |at|at| cards   |
 * | +--+--+         |
 * | Works           |
 * | +--+--+ Grid    |
 * | |  |  |         |
 * +-----------------+
 *
 * Tablet 640-1023px:
 * +------[Title] [⚙]------+
 * | Subtitle              |
 * | +--+--+--+--+--+      |
 * | |st|st|st|st|st|      |
 * | +--+--+--+--+--+      |
 * | Works                 |
 * | +--+--+--+ Grid       |
 * | |  |  |  |            |
 * +-----------------------+
 *
 * Desktop 1024-1535px:
 * +-------[Title] [⚙]------+
 * | Subtitle              |
 * | +--+--+--+--+--+      |
 * | |st|st|st|st|st|      |
 * | +--+--+--+--+--+      |
 * | Works                 |
 * | +--+--+--+--+ Grid    |
 * | |  |  |  |  |         |
 * +-----------------------+
 *
 * Ultra-wide >=1536px:
 * +-------[Title] [⚙]-------+
 * | Subtitle               |
 * | +--+--+--+--+--+       |
 * | |st|st|st|st|st|       |
 * | +--+--+--+--+--+       |
 * | Works                  |
 * | +--+--+--+--+--+ Grid  |
 * | |  |  |  |  |  |       |
 * +------------------------+
 */
export function ProgressLibraryPage({
  libraryUrlConfig,
  onResetLibraryUrlConfig,
}: ProgressLibraryPageProps) {
  useRequireAuth();
  const { t } = useTranslation(["common", "page"]);
  const libraryQuery = useQuery(myProgressPageQuery({ limit: 50 }));
  const { data: settings } = useQuery(userQueries.settings());
  const rows = libraryQuery.data?.rows ?? [];
  const config = useMemo(
    () =>
      resolveBookshelfConfig({
        url: libraryUrlConfig ?? null,
        viewer: settings?.library?.bookshelf ?? null,
      }),
    [libraryUrlConfig, settings?.library?.bookshelf],
  );
  const items = useMemo(
    () =>
      rows.flatMap((row) => {
        const item = progressLibraryRowToBookshelfItem(row);
        return item ? [item] : [];
      }),
    [rows],
  );
  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      userUnitProgressStatusValues.map((status) => [status, 0]),
    ) as Record<UserUnitProgressStatus, number>;
    for (const row of rows) {
      counts[row.progress.status] += 1;
    }
    return counts;
  }, [rows]);

  if (libraryQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-text-secondary">
        <Spinner size="sm" /> {t("common:loading")}
      </div>
    );
  }

  if (libraryQuery.isError) {
    return (
      <div className="p-8 text-sm text-error-text">{t("common:error")}</div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">
            {t("page:progress_title")}
          </h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            {t("page:progress_subtitle")}
          </p>
        </div>
        <UseMySettingsButton
          hasUrlOverride={!!libraryUrlConfig}
          onReset={() => onResetLibraryUrlConfig?.()}
        />
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold leading-snug text-text-primary">
          {t("page:progress_overview")}
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {userUnitProgressStatusValues.map((status) => (
            <div
              key={status}
              className="rounded-md bg-surface-subtle px-3 py-2"
            >
              <div className="text-xs leading-dense text-text-secondary">
                {progressStatusLabel(status)}
              </div>
              <div className="mt-1 text-lg font-semibold leading-ui text-text-primary">
                {statusCounts[status]}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold leading-snug text-text-primary">
            {t("page:progress_library")}
          </h2>
        </div>
        <BookshelfGrid
          items={items}
          config={config}
          emptyState={
            <div className="py-8 text-sm text-text-secondary">
              {t("page:progress_empty_library")}
            </div>
          }
        />
      </section>
    </main>
  );
}
