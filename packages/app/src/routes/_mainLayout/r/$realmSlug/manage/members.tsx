import { createFileRoute } from "@tanstack/react-router";
import { RealmManageMembersPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/manage/members",
)({
  component: RealmManageMembersPage,
});
