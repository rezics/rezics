import { bookQueries } from "@rezics/api/book/book";
import { createFileRoute } from "@tanstack/react-router";
import { titleOfBook, unitTitleMeta } from "@/core/routing/documentTitle";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ShelfByBookPage } from "@/shelf";

export const Route = createFileRoute("/_mainLayout/shelf/book/$bookId")({
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
    const { bookId } = Route.useParams();
    return <ShelfByBookPage bookId={bookId} />;
  },
});
