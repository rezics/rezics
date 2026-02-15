import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/tag/book/$bookId')({
  component: Outlet,
  notFoundComponent: lazyRouteComponent(
    () => import('@/core/page/NotFound'),
    'NotFoundContainer',
  ),
});
