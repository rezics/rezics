import { createFileRoute } from "@tanstack/react-router";
import { ZonePortalPage } from "@/zone";

function ZonePortalRoute() {
  const { slug } = Route.useParams();
  return <ZonePortalPage slug={slug} />;
}

export const Route = createFileRoute("/_mainLayout/z/$slug/")({
  component: ZonePortalRoute,
});
