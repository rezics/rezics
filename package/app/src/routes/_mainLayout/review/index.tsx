import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewsPage = lazyRouteComponent(
  () => import('@/review/page/ReviewsPage'),
  'ReviewsPage',
);

export const Route = createFileRoute('/_mainLayout/review/')({
  component: ReviewsPage,
});
