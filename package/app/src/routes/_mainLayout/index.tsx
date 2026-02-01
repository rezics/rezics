import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const HomeContainer = lazyRouteComponent(
  () => import('@/page/Home'),
  'HomeContainer',
);

export const Route = createFileRoute('/_mainLayout/')({
  component: HomeContainer,
});
