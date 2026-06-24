import { createFileRoute } from "@tanstack/react-router";
import { useRealmDetail } from "@/realm";
import { RuleSection } from "@/realm/sections/RuleSection";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/_detail/rules",
)({
  component: () => {
    const { realmId } = useRealmDetail();
    return <RuleSection realmUnitId={realmId} empty="state" />;
  },
});
