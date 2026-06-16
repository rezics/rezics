import { createFileRoute } from "@tanstack/react-router";
import { RealmManageModerationPage } from "@/realm";

export const Route = createFileRoute(
  "/_mainLayout/r/$realmSlug/manage/moderation",
)({
  component: RealmManageModerationPage,
});
