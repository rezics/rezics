import {
  createRootRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';
import {TanStackRouterDevtools} from '@tanstack/react-router-devtools';

export const Route = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  ),
  notFoundComponent: lazyRouteComponent(
    () => import('@/core/page/NotFound'),
    'NotFoundContainer',
  ),
});
