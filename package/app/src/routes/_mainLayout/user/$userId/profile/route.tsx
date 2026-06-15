import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/profile")({
  loader: userIdChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("settings:nav_profile"),
    ),
  component: ProfileLayout,
});
