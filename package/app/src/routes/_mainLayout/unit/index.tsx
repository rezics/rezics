import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const UnitsPage = lazyRouteComponent(() => import('@/page/Unit/UnitsPage'), 'UnitsPage');

export const Route = createFileRoute('/_mainLayout/unit/')({
  component: UnitsPage,
});

