import { createFileRoute } from "@tanstack/react-router";
import { ZoneHomePage } from "@/zone";

function ZoneHomeRoute() {
  const { slug } = Route.useParams();
  return <ZoneHomePage slug={slug} />;
}

export const Route = createFileRoute("/_mainLayout/zone/$slug/")({
  component: ZoneHomeRoute,
});
