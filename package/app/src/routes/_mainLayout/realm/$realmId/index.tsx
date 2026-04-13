import { createFileRoute } from "@tanstack/react-router";
import { RealmPage } from "@/realm/page/RealmPage";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/")({
  component: () => {
    const { realmId } = Route.useParams();
    return <RealmPage realmId={realmId} />;
  },
});
