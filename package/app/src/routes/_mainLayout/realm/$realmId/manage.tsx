import { createFileRoute } from "@tanstack/react-router";
import { RealmManagePage } from "@/realm/page/RealmManagePage";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage")({
  component: () => {
    const { realmId } = Route.useParams();
    return <RealmManagePage realmId={realmId} />;
  },
});
