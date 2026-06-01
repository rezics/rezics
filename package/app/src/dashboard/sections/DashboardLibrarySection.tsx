import { userQueries } from "@rezics/api/user/user.queries";
import type { BookshelfViewConfig, ProgressLibraryRow } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent, CardHeader, CardTitle } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { resolveBookshelfConfig, UseMySettingsButton } from "@/bookshelf-view";
import { progressLibraryRowToBookshelfItem } from "../models/libraryShelf";
import { DashboardLibraryShelfBlock } from "./DashboardLibraryShelfBlock";

export interface DashboardLibrarySectionProps {
  /** Progress-owned library rows; shelf membership is not required. */
  progressRows: readonly ProgressLibraryRow[];
  /** Bookshelf layout from the URL query, if any (highest precedence). */
  urlConfig?: BookshelfViewConfig | null;
  /** Clear the URL override so the viewer's stored settings take effect. */
  onResetUrlConfig?: () => void;
}

/**
 * The dashboard library section: progress-owned rows rendered through the
 * shared `bookshelf` view. Layout follows the `shelf-collection` resolution
 * order — URL override → viewer's `userSettings.library.bookshelf` → default —
 * and exposes the same "use my settings" reset.
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
