import { myProgressPageQuery } from "@rezics/api/progress/progress.queries";
import { userQueries } from "@rezics/api/user/user.queries";
import type { BookshelfViewConfig } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  BookshelfGrid,
  resolveBookshelfConfig,
  UseMySettingsButton,
} from "@/bookshelf-view";
import { progressLibraryRowToBookshelfItem } from "../models/progressBookshelf";

export interface ProgressLibraryPageProps {
  /** Bookshelf layout from the route URL query (highest precedence). 来自路由 URL query 的书架布局（优先级最高）。 */
  libraryUrlConfig?: BookshelfViewConfig | null;
  /** Clear the URL override so the viewer's stored settings take effect. 清除 URL 覆盖，使浏览者已保存的设置生效。 */
  onResetLibraryUrlConfig?: () => void;
}

export function ProgressLibraryPage({
  libraryUrlConfig,
  onResetLibraryUrlConfig,
}: ProgressLibraryPageProps) {
  const { t } = useTranslation(["common"]);
  const { data, isLoading, isError } = useQuery(
    myProgressPageQuery({ limit: 50 }),
  );
  const { data: settings } = useQuery(userQueries.settings());
  const rows = data?.rows ?? [];
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

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-text-secondary">
        <Spinner size="sm" /> {t("common:loading")}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 text-sm text-error-text">{t("common:error")}</div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">Progress</h1>
          <p className="mt-1 text-sm leading-ui text-text-secondary">
            Library items with your current progress.
          </p>
        </div>
        <UseMySettingsButton
          hasUrlOverride={!!libraryUrlConfig}
          onReset={() => onResetLibraryUrlConfig?.()}
        />
      </div>
      <section>
        <BookshelfGrid
          items={items}
          config={config}
          emptyState={
            <div className="py-8 text-sm text-text-secondary">
              No progress yet.
            </div>
          }
        />
      </section>
    </main>
  );
}
