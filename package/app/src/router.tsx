import {
  type AnySchema,
  createRouter,
  type ParsedLocation,
} from "@tanstack/react-router";
import { qc } from "@/app/providers/reactQueryUtil";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: "intent",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
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
