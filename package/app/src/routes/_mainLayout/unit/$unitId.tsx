import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const UnitPage = lazyRouteComponent(
  () => import('@/page/Unit/UnitPage'),
  'UnitPage',
);

export const Route = createFileRoute('/_mainLayout/unit/$unitId')({
  component: UnitPage,
});
