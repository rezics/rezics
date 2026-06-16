import { createFileRoute } from "@tanstack/react-router";
import { RealmManageWikiPage } from "@/realm";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage/wiki")(
  {
    component: RealmManageWikiPage,
  },
);
