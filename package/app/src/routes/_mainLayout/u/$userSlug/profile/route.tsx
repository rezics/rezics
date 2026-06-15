import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugChildRouteLoader } from "@/routes/_mainLayout/u/$userSlug";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/profile")({
  loader: userSlugChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("settings:nav_profile"),
    ),
  component: ProfileLayout,
});
