import { createFileRoute, notFound } from "@tanstack/react-router";
import { RealmManageLayout } from "@/realm";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage")({
  loader: ({ params }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
  },
  component: RealmManageRoute,
});

function RealmManageRoute() {
  const { realmId } = Route.useParams();
  return <RealmManageLayout realmId={realmId} />;
}
