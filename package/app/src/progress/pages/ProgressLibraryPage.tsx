import { myProgressPageQuery } from "@rezics/api/progress/progress.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { ProgressLibraryGrid } from "../components/ProgressLibraryGrid";

export function ProgressLibraryPage() {
  const { t } = useTranslation(["common"]);
  const { data, isLoading, isError } = useQuery(
    myProgressPageQuery({ limit: 50 }),
  );
  const rows = data?.rows ?? [];

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
        <ProgressLibraryGrid
          rows={rows}
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
