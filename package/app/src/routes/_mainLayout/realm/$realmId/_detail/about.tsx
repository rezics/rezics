import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RealmAboutTab } from "@/realm/sections/RealmAboutTab";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/about",
)({
  component: () => {
    const { realm, description, membership, showManage } = useRealmDetail();
    return (
      <RealmAboutTab
        realm={realm}
        description={description}
        membership={membership}
        canManage={showManage}
      />
    );
  },
});
