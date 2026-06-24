import type { Decorator } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useMemo } from "react";

// MOCK: Storybook-only router decorator. Wraps each story in a minimal
// in-memory TanStack Router so components that use <Link> / hooks like
// `useRouterState` resolve without booting the full app router tree.
// MOCK：仅用于 Storybook 的路由装饰器。将每个 story 包裹在一个最小化的
// 内存 TanStack Router 中，使使用 <Link> / 钩子（如 `useRouterState`）的
// 组件无需启动完整的应用路由树即可解析。
export const withRouter: Decorator = (Story) => {
  const RouterHost = () => {
    const router = useMemo(() => {
      const rootRoute = createRootRoute({
        component: () => <Story />,
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
