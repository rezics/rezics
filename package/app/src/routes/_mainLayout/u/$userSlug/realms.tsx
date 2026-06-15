import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugChildRouteLoader } from "@/routes/_mainLayout/u/$userSlug";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/realms")({
  loader: userSlugChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("shell:navigation_realms"),
    ),
  component: RealmListPage,
});
