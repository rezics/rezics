import { createFileRoute } from "@tanstack/react-router";
import { RealmManageDangerPage } from "@/realm";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/manage/danger")(
  {
    component: RealmManageDangerPage,
  },
);
