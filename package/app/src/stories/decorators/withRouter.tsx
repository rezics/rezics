import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import type { Decorator } from "@storybook/react-vite";
import { useMemo } from "react";

// MOCK: Storybook-only router decorator. Wraps each story in a minimal
// in-memory TanStack Router so components that use <Link> / hooks like
// `useRouterState` resolve without booting the full app router tree.
export const withRouter: Decorator = (Story) => {
  const RouterHost = () => {
    const router = useMemo(() => {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Story />
            <Outlet />
          </>
        ),
      });
      return createRouter({
        routeTree: rootRoute,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
    }, []);
    return <RouterProvider router={router as never} />;
  };
  return <RouterHost />;
};
