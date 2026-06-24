import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const NewShelfPage = lazyRouteComponent(
  () => import("@/shelf/pages/NewShelfPage"),
  "NewShelfPage",
);

export const Route = createFileRoute("/_mainLayout/shelf/new")({
  component: NewShelfPage,
});
