import { createRouter } from "@tanstack/react-router";
import { qc } from "@/app/provider/reactQueryUtil";
import { routeTree } from "./routeTree.gen.ts";

export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: "intent",
  // Keep preloaded routes "fresh" for a short period to avoid constant stale/refetch.
  defaultPreloadStaleTime: 30_000,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
