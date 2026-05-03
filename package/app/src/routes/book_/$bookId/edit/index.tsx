import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditMainPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditMainPage",
);

type BookEditSearch = { lang?: string };

export const Route = createFileRoute("/book_/$bookId/edit/")({
  component: BookEditMainPage,
  validateSearch: (raw: Record<string, unknown>): BookEditSearch => ({
    lang: typeof raw.lang === "string" ? raw.lang : undefined,
  }),
});
