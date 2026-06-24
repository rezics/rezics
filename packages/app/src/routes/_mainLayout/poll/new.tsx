import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const PollNewPage = lazyRouteComponent(() => import("@/poll"), "PollNewPage");

export const Route = createFileRoute("/_mainLayout/poll/new")({
  component: PollNewPage,
});
