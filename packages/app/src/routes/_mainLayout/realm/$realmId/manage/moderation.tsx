import { createFileRoute } from "@tanstack/react-router";
import { RealmManageModerationPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/realm/$realmId/manage/moderation",
)({
  component: RealmManageModerationPage,
});
