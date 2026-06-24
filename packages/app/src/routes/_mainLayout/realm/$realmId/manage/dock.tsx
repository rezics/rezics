import { createFileRoute } from "@tanstack/react-router";
import { RealmManageDockPage } from "@/realm";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage/dock")(
  {
    component: RealmManageDockPage,
  },
);
