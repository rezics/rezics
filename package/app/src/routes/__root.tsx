import {
  createRootRouteWithContext,
  HeadContent,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { qc } from "@/app";
import { titleMeta } from "@/core/routing/documentTitle";

export const Route = createRootRouteWithContext<{ qc: typeof qc }>()({
  head: () => titleMeta(),
  component: () => (
    <>
      <HeadContent />
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  notFoundComponent: lazyRouteComponent(
    () => import("@/core/pages/NotFound"),
    "NotFoundContainer",
  ),
});
