import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const NotificationPage = lazyRouteComponent(
  () => import("@/inbox/pages/NotificationPage"),
  "NotificationPage",
);

export const Route = createFileRoute("/_mainLayout/inbox/notification")({
  component: NotificationPage,
});
