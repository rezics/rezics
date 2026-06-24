import { createFileRoute } from "@tanstack/react-router";
import { RealmManageProfilePage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/manage/profile",
)({
  component: RealmManageProfilePage,
});
