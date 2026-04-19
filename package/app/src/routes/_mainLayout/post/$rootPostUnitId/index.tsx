import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const PostThreadPage = lazyRouteComponent(
  () => import("@/post/pages/PostThreadPage"),
  "PostThreadPage",
);

export const Route = createFileRoute("/_mainLayout/post/$rootPostUnitId/")({
  component: PostThreadPage,
});
