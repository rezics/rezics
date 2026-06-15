import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugRouteLoaderData } from "@/routes/_mainLayout/u/$userSlug";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/profile")({
  head: ({ matches }) => {
    const userData = userSlugRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("settings:nav_profile"),
    );
  },
  component: ProfileLayout,
});
