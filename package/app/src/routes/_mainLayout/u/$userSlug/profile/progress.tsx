import type { BookshelfViewConfig } from "@rezics/contract";
import {
  createFileRoute,
  lazyRouteComponent,
  useNavigate,
} from "@tanstack/react-router";
import { routeBoundaries } from "@/core";
import { useProfileContext } from "@/user/components/ProfileLayout";

const ProgressLibraryPage = lazyRouteComponent(
  () => import("@/progress"),
  "ProgressLibraryPage",
);

type ProgressSearch = {
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
  const { isCurrentUser } = useProfileContext();
  const search = Route.useSearch();
  const navigate = useNavigate();

  if (!isCurrentUser) return null;

  return (
    <ProgressLibraryPage
      libraryUrlConfig={urlConfigFromSearch(search)}
      onResetLibraryUrlConfig={() =>
        navigate({
          to: "/u/$userSlug/profile/progress",
          search: (prev: ProgressSearch) => ({ ...prev, cols: undefined }),
        })
      }
    />
  );
}

export const Route = createFileRoute(
  "/_mainLayout/u/$userSlug/profile/progress",
)({
  validateSearch: (search: Record<string, unknown>): ProgressSearch => ({
    cols: typeof search.cols === "string" ? search.cols : undefined,
  }),
  component: ProgressRoute,
  ...routeBoundaries(),
});
