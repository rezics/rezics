import {
  type AnySchema,
  createRouter,
  type ParsedLocation,
} from "@tanstack/react-router";
import { qc } from "@/app/providers/reactQueryUtil";
import {
  RouteError,
  RouteLoading,
  RouteNotFound,
} from "@/core/routing/routeBoundaries";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: "intent",
  defaultErrorComponent: RouteError,
  defaultPendingComponent: RouteLoading,
  defaultNotFoundComponent: RouteNotFound,
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  // 由于我们使用 React Query，不希望 loader 调用出现过期数据
  // 这样可以确保路由被预加载或访问时总是调用 loader
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  getScrollRestorationKey: (location: ParsedLocation<AnySchema>) => {
    const tab = new URLSearchParams(location.search ?? "").get("tab") ?? "";
    return `${location.pathname}::tab=${tab}`;
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
