import { createFileRoute } from "@tanstack/react-router";
import { RealmManageWikiPage } from "@/realm";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/manage/wiki")({
  component: RealmManageWikiPage,
});
