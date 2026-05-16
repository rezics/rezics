import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const DmInboxPage = lazyRouteComponent(
  () => import("@/inbox/pages/DmInboxPage"),
  "DmInboxPage",
);

export const Route = createFileRoute("/_mainLayout/inbox/dm/")({
  component: DmInboxPage,
});
