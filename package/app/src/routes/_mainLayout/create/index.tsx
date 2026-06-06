import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";
import { normalizeCreatePageSearch } from "@/create/models/shareCreateSearch";

const CreatePage = lazyRouteComponent(() => import("@/create"), "CreatePage");

export const Route = createFileRoute("/_mainLayout/create/")({
  validateSearch: normalizeCreatePageSearch,
  component: CreatePage,
  ...routeBoundaries(),
});
