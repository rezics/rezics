import { userShelvesQuery } from "@rezics/api/shelf";
import { userQueries } from "@rezics/api/user/user.queries";
import type {
  BookshelfViewConfig,
  ContinueReadingItem,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Card, CardContent, CardHeader, CardTitle } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { resolveBookshelfConfig, UseMySettingsButton } from "@/bookshelf-view";
import { progressByBook } from "../models/libraryShelf";
import { DashboardLibraryShelfBlock } from "./DashboardLibraryShelfBlock";

export interface DashboardLibrarySectionProps {
  /** Continue-reading items, the source of the chapter-completion counter. */
  continueReading: readonly ContinueReadingItem[];
  /** Bookshelf layout from the URL query, if any (highest precedence). */
  urlConfig?: BookshelfViewConfig | null;
  /** Clear the URL override so the viewer's stored settings take effect. */
  onResetUrlConfig?: () => void;
}

/**
 * The dashboard library section: a composition of the viewer's existing
 * shelves rendered through the shared `bookshelf` view, with the readable
 * filter applied by default. Layout follows the `shelf-collection` resolution
 * order — URL override → viewer's `userSettings.library.bookshelf` → default —
 * and exposes the same "use my settings" reset.
 */
export function DashboardLibrarySection({
  continueReading,
  urlConfig,
  onResetUrlConfig,
}: DashboardLibrarySectionProps) {
  const { t } = useTranslation(["page"]);
  const { data: shelves } = useQuery(userShelvesQuery());
  const { data: settings } = useQuery(userQueries.settings());

  const config = useMemo(
    () =>
      resolveBookshelfConfig({
        url: urlConfig ?? null,
        viewer: settings?.library?.bookshelf ?? null,
      }),
    [urlConfig, settings?.library?.bookshelf],
  );
  const progress = useMemo(
    () => progressByBook(continueReading),
    [continueReading],
  );

  const libraryShelves = shelves ?? [];
  if (libraryShelves.length === 0) return null;

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
        {libraryShelves.map((shelf) => (
          <DashboardLibraryShelfBlock
            key={shelf.unitId}
            shelf={shelf}
            config={config}
            readableOnly
            progress={progress}
          />
        ))}
      </CardContent>
    </Card>
  );
}
