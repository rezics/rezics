import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RealmMemberList } from "@/realm/components/RealmMemberList";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/members",
)({
  component: () => {
    const { realmId } = useRealmDetail();
    return <RealmMemberList realmId={realmId} />;
  },
});
