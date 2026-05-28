import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { releaseWorkUnitId } from "@/book-library/models/releaseWork";
import { RemarkListSection } from "@/remark";

export const Route = createFileRoute("/_mainLayout/remark/book/$bookId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    scope?: "work" | "exact";
  } => ({
    scope:
      search.scope === "work" || search.scope === "exact"
        ? search.scope
        : undefined,
  }),
  component: () => {
    const { t } = useTranslation(["search"]);
const { bookId } = Route.useParams();
    const { scope } = Route.useSearch();
    const { data: bookInfo } = useQuery({
      ...bookQueries.detail(bookId),
      enabled: Boolean(bookId),
    });
    const workUnitId =
      scope === "exact" ? undefined : releaseWorkUnitId(bookInfo);
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">
          {t("search:category_remarks")}
        </h2>
        <RemarkListSection
          targetUnitId={bookId}
          workUnitId={workUnitId}
          limit={50}
        />
      </div>
    );
  },
});
