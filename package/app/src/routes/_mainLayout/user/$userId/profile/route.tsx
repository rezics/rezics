import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/profile")({
  loader: userIdChildRouteLoader,
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: ProfileLayout,
});
