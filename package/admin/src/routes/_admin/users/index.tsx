import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/users/')({
  component: lazyRouteComponent(
    () => import('@/page/User/MeiliUsersPage'),
    'default',
  ),
});

