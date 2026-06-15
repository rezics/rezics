import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdRouteLoaderData } from "@/routes/_mainLayout/user/$userId";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/profile")({
  head: ({ matches }) => {
    const userData = userIdRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("settings:nav_profile"),
    );
  },
  component: ProfileLayout,
});
