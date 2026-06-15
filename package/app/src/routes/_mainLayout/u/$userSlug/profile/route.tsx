import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userSlugChildRouteLoader } from "@/routes/_mainLayout/u/$userSlug";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/profile")({
  loader: userSlugChildRouteLoader,
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: ProfileLayout,
});
