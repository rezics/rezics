import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/units/')({
  component: lazyRouteComponent(
    () => import('@/page/Unit/UnitsPage'),
    'default',
  ),
});

