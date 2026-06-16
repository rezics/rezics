import { createFileRoute } from "@tanstack/react-router";
import { RealmManageOrganizationPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/manage/organization",
)({
  component: RealmManageOrganizationPage,
});
