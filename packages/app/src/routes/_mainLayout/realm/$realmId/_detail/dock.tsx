import { createFileRoute } from "@tanstack/react-router";
import { RealmDock } from "@/realm-dock";
import { useRealmDetail } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/dock",
)({
  component: () => {
    const { realm } = useRealmDetail();
    return <RealmDock realm={realm} placement="main" variant="page" />;
  },
});
