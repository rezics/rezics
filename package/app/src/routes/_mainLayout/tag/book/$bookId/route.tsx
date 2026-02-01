import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/tag/book/$bookId')({
  component: Outlet,
  notFoundComponent: lazyRouteComponent(
    () => import('@feature/core/page/NotFound'),
    'NotFoundContainer',
  ),
});
