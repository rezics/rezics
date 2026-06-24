import { getI18nRuntime } from "@rezics/i18n/runtime";
import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "@/admin/core/layouts/PlaceholderPage";

function PostsPlaceholderPage() {
  return <PlaceholderPage title={getI18nRuntime().i18n.t("admin:nav_posts")} />;
}

export const Route = createFileRoute("/_admin/post/")({
  component: PostsPlaceholderPage,
});
