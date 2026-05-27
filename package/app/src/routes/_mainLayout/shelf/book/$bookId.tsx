import { createFileRoute } from "@tanstack/react-router";
import { ShelfByBookPage } from "@/shelf/pages/ShelfByBookPage";

export const Route = createFileRoute("/_mainLayout/shelf/book/$bookId")({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    scope?: "work" | "exact";
  } => ({
    scope:
      search.scope === "work" || search.scope === "exact"
        ? search.scope
        : undefined,
  }),
  component: () => {
    const { bookId } = Route.useParams();
    const { scope } = Route.useSearch();
    return <ShelfByBookPage bookId={bookId} scopeMode={scope} />;
  },
});
