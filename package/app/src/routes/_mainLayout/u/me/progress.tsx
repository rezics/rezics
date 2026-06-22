import type { BookshelfViewConfig } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  useNavigate,
} from "@tanstack/react-router";

const ProgressLibraryPage = lazyRouteComponent(
  () => import("@/progress"),
  "ProgressLibraryPage",
);

type ProgressSearch = {
  /**
   * Cover-grid column override for the progress page. Kept string-valued for
   * URLSearchParams-compatible search shape.
   */
  cols?: string;
};

function urlConfigFromSearch(
  search: ProgressSearch,
): BookshelfViewConfig | null {
  const columns = search.cols ? Number(search.cols) : 0;
  if (!Number.isFinite(columns) || columns <= 0) return null;
  return {
    breakpoints: [{ minWidthPx: 0, columns }],
    showTitle: true,
  };
}

function ProgressRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <ProgressLibraryPage
      libraryUrlConfig={urlConfigFromSearch(search)}
      onResetLibraryUrlConfig={() =>
        navigate({
          to: "/u/me/progress",
          search: (prev: ProgressSearch) => ({ ...prev, cols: undefined }),
        })
      }
    />
  );
}

export const Route = createFileRoute("/_mainLayout/u/me/progress")({
  validateSearch: (search: Record<string, unknown>): ProgressSearch => ({
    cols: typeof search.cols === "string" ? search.cols : undefined,
  }),
  component: ProgressRoute,
});
