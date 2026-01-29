import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/_admin/users/meili')({
  component: lazyRouteComponent(
    () => import('@/page/User/MeiliUsersPage'),
    'default',
  ),
})
