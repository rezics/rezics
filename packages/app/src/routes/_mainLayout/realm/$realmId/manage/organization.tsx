import { createFileRoute } from "@tanstack/react-router";
import { RealmManageOrganizationPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/manage/organization",
)({
  component: RealmManageOrganizationPage,
});
