import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/tag/domain/$unitId')({
  component: Outlet,
  notFoundComponent: lazyRouteComponent(
    () => import('@feature/core/page/NotFound'),
    'NotFoundContainer',
  ),
});
