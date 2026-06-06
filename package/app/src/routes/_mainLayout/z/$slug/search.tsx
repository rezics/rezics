import { createFileRoute } from "@tanstack/react-router";
import { ZoneSearchPage } from "@/zone";

function ZoneSearchRoute() {
  const { slug } = Route.useParams();
  const { keyword } = Route.useSearch();
  return <ZoneSearchPage slug={slug} initialKeyword={keyword} />;
}

export const Route = createFileRoute("/_mainLayout/z/$slug/search")({
  component: ZoneSearchRoute,
  validateSearch: (search: Record<string, unknown>): { keyword?: string } => ({
    keyword: typeof search.keyword === "string" ? search.keyword : undefined,
  }),
});
