import type { BookshelfViewConfig } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  useNavigate,
} from "@tanstack/react-router";

const DashboardPage = lazyRouteComponent(
  () => import("@/dashboard"),
  "DashboardPage",
);

type DashboardSearch = {
  /**
   * Bookshelf column override for the dashboard library section. Kept as a
   * string so the router's aggregate search schema stays string-valued (other
   * routes feed it straight into `URLSearchParams`).
   */
  cols?: string;
};

/**
 * Resolve a single-breakpoint bookshelf override from the `cols` URL param.
 * Returns null when absent/invalid so the viewer's stored settings take
 * precedence.
 */
function urlConfigFromSearch(
  search: DashboardSearch,
): BookshelfViewConfig | null {
  const columns = search.cols ? Number(search.cols) : 0;
  if (!Number.isFinite(columns) || columns <= 0) return null;
  return {
    breakpoints: [{ minWidthPx: 0, columns }],
    showTitle: true,
  };
}

function DashboardRoute() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <DashboardPage
      libraryUrlConfig={urlConfigFromSearch(search)}
      onResetLibraryUrlConfig={() =>
        navigate({
          to: "/u/me/dashboard",
          search: (prev: DashboardSearch) => ({ ...prev, cols: undefined }),
        })
      }
    />
  );
}

export const Route = createFileRoute("/_mainLayout/u/me/dashboard")({
  validateSearch: (search: Record<string, unknown>): DashboardSearch => ({
    cols: typeof search.cols === "string" ? search.cols : undefined,
  }),
  component: DashboardRoute,
});
