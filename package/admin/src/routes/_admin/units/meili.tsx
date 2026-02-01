import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/units/meili')({
  component: lazyRouteComponent(
    () => import('@/page/Unit/MeiliUnitsPage'),
    'default',
  ),
});
