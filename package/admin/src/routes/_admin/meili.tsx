import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const MeiliPage = lazyRouteComponent(
  () => import('@/meili/page/MeiliPage'),
  'MeiliPage',
);

export const Route = createFileRoute('/_admin/meili')({
  component: MeiliPage,
});
