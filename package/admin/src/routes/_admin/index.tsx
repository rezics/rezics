import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/')({
  component: lazyRouteComponent(() => import('@/page/DashboardPage'), 'default'),
});

