import {
  createRootRouteWithContext,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { qc } from "@/app/providers/reactQueryUtil";

export const Route = createRootRouteWithContext<{ qc: typeof qc }>()({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  notFoundComponent: lazyRouteComponent(
    () => import("@/core/pages/NotFound"),
    "NotFoundContainer",
  ),
});
