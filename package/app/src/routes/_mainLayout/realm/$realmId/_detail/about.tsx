import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RealmAboutTab } from "@/realm/sections/RealmAboutTab";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/about",
)({
  component: () => {
    const { realm, membership, showManage } = useRealmDetail();
    return (
      <RealmAboutTab
        realm={realm}
        membership={membership}
        canManage={showManage}
      />
    );
  },
});
