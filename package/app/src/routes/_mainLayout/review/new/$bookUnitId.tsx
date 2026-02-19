import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewNewPage = lazyRouteComponent(
  () => import('@/review/page/ReviewNewPage'),
  'ReviewNewPage',
);

export const Route = createFileRoute('/_mainLayout/review/new/$bookUnitId')({
  component: ReviewNewPage,
});
