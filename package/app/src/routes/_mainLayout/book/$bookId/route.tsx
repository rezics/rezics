import { bookQueries } from "@rezics/api/book/book";
import type { BookDTO } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  notFound,
  Outlet,
} from "@tanstack/react-router";
import {
  loaderDataByRouteId,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import {
  type ResolvedReadLanguageContext,
  resolveRouteReadLanguageContext,
} from "@/shared/models/readLanguageContext";

const BookDetailLayout = lazyRouteComponent(
  () => import("@/book-library"),
  "BookDetailLayout",
);

export const Route = createFileRoute("/_mainLayout/book/$bookId")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const book = await context.qc
      .ensureQueryData(
        bookQueries.detail(params.bookId, {
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }),
      )
      .catch(() => {
        throw notFound();
      });
    return { book, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfBook(loaderData.book, loaderData.readContext) : null,
    ),
  component: () => (
    <BookDetailLayout>
      <Outlet />
    </BookDetailLayout>
  ),
  notFoundComponent: lazyRouteComponent(
    () => import("@/core/pages/NotFound"),
    "NotFoundContainer",
  ),
});

export type BookRouteLoaderData = {
  book: BookDTO;
  readContext: ResolvedReadLanguageContext;
};

export function bookRouteLoaderData(
  matches: readonly { routeId: string; loaderData?: unknown }[],
) {
  return loaderDataByRouteId<BookRouteLoaderData>(
    matches,
    "/_mainLayout/book/$bookId",
  );
}
