import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const MeiliPage = lazyRouteComponent(
  () => import('@/page/Meili/MeiliPage'),
  'MeiliPage',
);

export const Route = createFileRoute('/_mainLayout/meili')({
  component: MeiliPage,
});
