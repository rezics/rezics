import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditMainPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditMainPage",
);

type BookEditSearch = { lang?: string; restoreRevision?: string };

export const Route = createFileRoute("/_editor/book/$bookId/edit/")({
  component: BookEditMainPage,
  validateSearch: (raw: Record<string, unknown>): BookEditSearch => ({
    lang: typeof raw.lang === "string" ? raw.lang : undefined,
    restoreRevision:
      typeof raw.restoreRevision === "string" ? raw.restoreRevision : undefined,
  }),
});
