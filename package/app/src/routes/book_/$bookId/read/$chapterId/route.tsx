import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

const BookReadLayout = lazyRouteComponent(
  () => import("@/book-read/layouts/BookReadLayout"),
  "BookReadLayout",
);

export const Route = createFileRoute("/book_/$bookId/read/$chapterId")({
  validateSearch: (search: Record<string, unknown>) => ({
    path: typeof search.path === "string" ? search.path : undefined,
    title: typeof search.title === "string" ? search.title : undefined,
  }),
  component: () => (
    <BookReadLayout>
      <Outlet />
    </BookReadLayout>
  ),
});
