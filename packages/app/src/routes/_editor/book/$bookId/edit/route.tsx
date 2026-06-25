import { bookQueries } from "@rezics/contract/api/book/book.queries";
import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

const BookEditLayout = lazyRouteComponent(
  () => import("@/book-edit/layouts/BookEditLayout"),
  "BookEditLayout",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      bookQueries.detail(params.bookId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
  component: () => (
    <BookEditLayout>
      <Outlet />
    </BookEditLayout>
  ),
});
