import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { normalizeCreatePageSearch } from "@/create";

const CreatePage = lazyRouteComponent(() => import("@/create"), "CreatePage");

export const Route = createFileRoute("/_mainLayout/create/")({
  validateSearch: normalizeCreatePageSearch,
  component: CreatePage,
});
