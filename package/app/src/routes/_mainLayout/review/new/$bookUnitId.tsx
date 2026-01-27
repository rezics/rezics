import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewNewPage = lazyRouteComponent(
  () => import('@/page/Review/ReviewNewPage'),
  'ReviewNewPage',
);

export const Route = createFileRoute('/_mainLayout/review/new/$bookUnitId')({
  component: ReviewNewPage,
});

