import { bookQueries } from "@rezics/contract/api/book/book";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const ExcerptByBookPage = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptByBookPage"),
  "ExcerptByBookPage",
);

export const Route = createFileRoute("/_mainLayout/excerpt/book/$bookId")({
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
  component: ExcerptByBookPage,
});
