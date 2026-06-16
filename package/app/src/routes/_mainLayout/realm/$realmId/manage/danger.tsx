import { createFileRoute } from "@tanstack/react-router";
import { RealmManageDangerPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/manage/danger",
)({
  component: RealmManageDangerPage,
});
