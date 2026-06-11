import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RealmWikiTab } from "@/realm/components/RealmWikiTab";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/wiki",
)({
  component: () => {
    const { realmId, routeLocation, realm } = useRealmDetail();
    return (
      <RealmWikiTab
        realmId={realmId}
        routeLocation={routeLocation}
        wikiSidebar={realm.extra?.wikiSidebar ?? null}
      />
    );
  },
});
