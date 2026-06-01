import { myProgressLibraryQuery } from "@rezics/api/progress/progress.queries";
import { DEFAULT_BOOKSHELF_CONFIG } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { BookshelfGrid } from "@/bookshelf-view";
import { progressLibraryRowToBookshelfItem } from "@/dashboard/models/libraryShelf";
import { Link } from "@/shared/ui/link";

export function ProgressLibraryPage() {
  const { t } = useTranslation(["common"]);
  const { data, isLoading, isError } = useQuery(
    myProgressLibraryQuery({ limit: 50 }),
  );
  const rows = data?.rows ?? [];
  const items = rows.flatMap((row) => {
    const item = progressLibraryRowToBookshelfItem(row);
    return item ? [item] : [];
  });

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
      <h1 className="text-2xl font-bold text-text-primary">Progress</h1>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Library</h2>
        <BookshelfGrid
          items={items}
          config={DEFAULT_BOOKSHELF_CONFIG}
          emptyState={
            <div className="py-8 text-sm text-text-secondary">
              No progress yet.
            </div>
          }
        />
        {rows.some((row) => row.shelves.length > 0) ? (
          <div className="flex flex-wrap gap-2 text-xs text-text-secondary">
            {rows.flatMap((row) =>
              row.shelves.map((shelf) => (
                <Link
                  key={`${row.unit.unitId}:${shelf.shelfUnitId}`}
                  to={`/shelf/${shelf.shelfUnitId}`}
                  className="rounded-md bg-surface-sunken px-2 py-1 hover:text-text-primary"
                >
                  {shelf.title}
                </Link>
              )),
            )}
          </div>
        ) : null}
      </section>
    </main>
  );
}
