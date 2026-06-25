import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen.ts";

export const router = createRouter({
  routeTree,
  basepath: "/admin",
  defaultPreload: "intent",
  // Keep preloaded routes "fresh" for a short period to avoid constant stale/refetch.
  // 让预加载的路由在短时间内保持“新鲜”，以避免持续的过期/重新获取。
  defaultPreloadStaleTime: 30_000,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
