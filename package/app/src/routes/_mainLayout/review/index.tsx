import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReviewsPage = lazyRouteComponent(() => import('@/page/Review/ReviewsPage'), 'ReviewsPage');

export const Route = createFileRoute('/_mainLayout/review/')({
  component: ReviewsPage,
});

