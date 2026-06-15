import {
  createRootRouteWithContext,
  HeadContent,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { qc } from "@/app";
import { productTitleMeta } from "@/core/routing/documentTitle";

export const Route = createRootRouteWithContext<{ qc: typeof qc }>()({
  head: () => productTitleMeta(),
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
