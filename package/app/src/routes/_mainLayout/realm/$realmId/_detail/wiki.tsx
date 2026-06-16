import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RealmWikiTab } from "@/realm/components/RealmWikiTab";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/wiki",
)({
  component: () => {
    const { realmId, realm } = useRealmDetail();
    return <RealmWikiTab realm={realm} realmId={realmId} />;
  },
});
