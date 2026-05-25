import { createFileRoute, Outlet } from "@tanstack/react-router";

function BookEditHistoryOutlet() {
  return (
    <main className="mx-auto mt-16 max-w-5xl px-4 pb-16">
      <Outlet />
    </main>
  );
}

export const Route = createFileRoute("/book_/$bookId/edit/history")({
  component: BookEditHistoryOutlet,
});
