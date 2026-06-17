import { bookQueries } from "@rezics/api/book/book";
import { useTranslation } from "@rezics/i18n/react";
import { createFileRoute } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";
import { RemarkListSection } from "@/remark";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

export const Route = createFileRoute("/_mainLayout/remark/book/$bookId")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const book = await routeQueryOrNotFound(
      context.qc,
      bookQueries.detail(params.bookId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
    return { book, readContext };
  },
  head: ({ loaderData }) =>
    unitTitleMeta(
      "book",
      loaderData ? titleOfBook(loaderData.book, loaderData.readContext) : null,
    ),
  component: () => {
    const { t } = useTranslation(["search"]);
    const { bookId } = Route.useParams();
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <h2 className="text-xl font-semibold mb-6">
          {t("search:category_remarks")}
        </h2>
        <RemarkListSection targetUnitId={bookId} limit={50} />
      </div>
    );
  },
});
