import { createFileRoute } from "@tanstack/react-router";
import { ZonePortalPage } from "@/zone";

function ZoneCustomPageRoute() {
  const { slug, pageSlug } = Route.useParams();
  return <ZonePortalPage slug={slug} pageSlug={pageSlug} />;
}

export const Route = createFileRoute("/_mainLayout/z/$slug/pages/$pageSlug")({
  component: ZoneCustomPageRoute,
});
