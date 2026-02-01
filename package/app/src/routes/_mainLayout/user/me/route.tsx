import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/user/me')({
  component: Outlet,
  notFoundComponent: lazyRouteComponent(
    () => import('@/page/NotFound'),
    'NotFoundContainer',
  ),
});
