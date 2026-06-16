import { createFileRoute } from "@tanstack/react-router";
import { RealmManageMembersPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/manage/members",
)({
  component: RealmManageMembersPage,
});
