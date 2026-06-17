import { bookQueries } from "@rezics/api/book/book";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const ReviewByBookPage = lazyRouteComponent(
  () => import("@/review/pages/ReviewByBookPage"),
  "ReviewByBookPage",
);

export const Route = createFileRoute("/_mainLayout/review/book/$bookId")({
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
  component: ReviewByBookPage,
});
